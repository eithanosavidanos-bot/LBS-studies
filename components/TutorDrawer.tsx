"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { renderTutorMarkdown } from "@/lib/markdown";
import { TUTOR_ASK_EVENT } from "./AskButton";

interface Bubble {
  role: "user" | "assistant";
  content: string;
  failed?: boolean; // error replies are shown but not sent back to the model
}

/** Works out which course and chapter the student is looking at from the URL. */
function contextFromPath(pathname: string): { course: string | null; chapter: number | null } {
  const m = /^\/c\/([^/]+)(?:\/(?:book|summaries)\/(\d+)|\/exam\/ch(\d+))?/.exec(pathname);
  if (!m) return { course: null, chapter: null };
  const n = m[2] ?? m[3];
  return { course: m[1], chapter: n ? Number(n) : null };
}

export function TutorDrawer({ defaultSlug }: { defaultSlug: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { course, chapter } = contextFromPath(pathname);
  const courseSlug = course ?? defaultSlug;

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [chat, open]);

  const ask = useCallback(
    async (text: string) => {
      text = text.trim();
      if (!text || busy) return;
      setOpen(true);
      // Only successful exchanges go back to the model.
      const history: Bubble[] = [];
      for (let i = 0; i + 1 < chat.length; i += 2) {
        if (!chat[i + 1].failed) history.push(chat[i], chat[i + 1]);
      }
      const messages = [...history, { role: "user" as const, content: text }].map(({ role, content }) => ({ role, content }));
      setChat((c) => [...c, { role: "user", content: text }, { role: "assistant", content: "" }]);
      setBusy(true);

      const update = (content: string, failed = false) =>
        setChat((c) => [...c.slice(0, -1), { role: "assistant", content, failed }]);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/tutor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ course: courseSlug, chapter, messages }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          update(data.error ?? "Something went wrong getting an answer. Try again.", true);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let full = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
          update(full);
        }
        if (!full.trim()) update("I didn't get an answer. Try again.", true);
      } catch {
        if (!controller.signal.aborted) update("Something went wrong getting an answer. Try again.", true);
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, chat, chapter, courseSlug],
  );

  useEffect(() => {
    const onAsk = (e: Event) => ask((e as CustomEvent<string>).detail);
    window.addEventListener(TUTOR_ASK_EVENT, onAsk);
    return () => window.removeEventListener(TUTOR_ASK_EVENT, onAsk);
  }, [ask]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function newChat() {
    abortRef.current?.abort();
    setChat([]);
  }

  if (!open) {
    return (
      <button
        className="fab"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <i />
        Ask the tutor
      </button>
    );
  }

  const suggestions = [
    "Explain the agency problem",
    "Difference between an MNE and a TNC",
    chapter ? `Quiz me on Chapter ${chapter}` : "Quiz me on this course",
    "What is the BCG matrix?",
  ];

  return (
    <>
      <div className="drawer-backdrop" onClick={() => setOpen(false)} />
      <aside className="drawer" role="dialog" aria-label="AI tutor">
        <header>
          <h3>Tutor</h3>
          <button className="btn small" onClick={newChat} disabled={!chat.length}>
            New chat
          </button>
          <button className="btn small" onClick={() => setOpen(false)} aria-label="Close tutor">
            Close
          </button>
        </header>
        <div className="chat" ref={chatRef} aria-live="polite">
          {chat.length === 0 ? (
            <div className="bubble assistant">
              <p>
                Hi! I&apos;m your course tutor. Ask me about any chapter, ask for an explanation in simpler words, or
                say &quot;quiz me&quot; to practise.
              </p>
            </div>
          ) : (
            chat.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="bubble user">
                  {m.content}
                </div>
              ) : (
                <div
                  key={i}
                  className={m.failed ? "bubble sys" : "bubble assistant"}
                  dangerouslySetInnerHTML={{ __html: renderTutorMarkdown(m.content || "Thinking…") }}
                />
              ),
            )
          )}
        </div>
        {chat.length === 0 && (
          <div className="suggest">
            {suggestions.map((s) => (
              <button key={s} onClick={() => ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            // While an answer is streaming, keep the text so it isn't lost.
            if (busy || !input.trim()) return;
            ask(input);
            setInput("");
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask about the course…"
            aria-label="Your question"
          />
          <button className="btn primary" disabled={busy}>
            Send
          </button>
        </form>
      </aside>
    </>
  );
}
