// Tutor prompt and request validation. Pure functions, unit-tested.
import { stripTags } from "@/lib/sanitize";
import type { Chapter, Course } from "@/lib/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function courseNotes(chapters: Chapter[]): string {
  return chapters
    .map((c) =>
      [
        `CHAPTER ${c.n}: ${c.title}${c.pages ? ` (book pp. ${c.pages})` : ""}`,
        `Sections: ${c.outline.join("; ")}`,
        `Summary: ${stripTags(c.summary.join(" "))}`,
        `Key terms: ${c.terms.map(([t, d]) => `${t} = ${d}`).join("; ")}`,
      ].join("\n"),
    )
    .join("\n\n");
}

/**
 * The stable part of the system prompt (role, rules, all course notes). It is
 * identical for every student of a course, so it is cached between requests.
 */
export function tutorSystemPrompt(course: Course, chapters: Chapter[]): string {
  const b = course.book;
  const book = b.title ? `the textbook "${b.title}"${b.edition ? ` (${b.edition}` : ""}${b.authors ? `, ${b.authors})` : b.edition ? ")" : ""}` : "its course materials";
  return `You are the AI tutor on a study website for the university course ${course.code} (${course.name}), which uses ${book}. Help the student prepare for the exam.

Rules: Base your answers on the course notes below and on standard business and management knowledge consistent with the book. If something isn't in the notes, say so briefly and still help with general knowledge. Never claim to quote the book word for word, and don't reproduce long passages of it. Be clear and concise (short paragraphs or bullet points, under about 250 words unless asked for more). Use plain language and a real-world example when it helps. If the student asks to be quizzed, ask one question at a time (true/false, multiple choice a-d, or fill the gap), wait for their answer, then give feedback. Write in plain text with simple Markdown (bold, italics, bullet lists); no tables or headings.

COURSE NOTES
${courseNotes(chapters)}`;
}

/** The per-request part, kept after the cache breakpoint. */
export function tutorContextNote(chapter: Chapter | undefined): string {
  return chapter
    ? `The student is currently looking at Chapter ${chapter.n}: ${chapter.title}.`
    : "The student is not looking at a specific chapter right now.";
}

export type ValidationResult =
  | { ok: true; messages: ChatMessage[] }
  | { ok: false; status: number; error: string };

/** Checks an untrusted chat history from the browser. */
export function validateMessages(input: unknown, maxMessages: number, maxChars: number): ValidationResult {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, status: 400, error: "Ask a question first." };
  if (input.length > maxMessages) {
    return { ok: false, status: 413, error: "This conversation is getting long. Start a new chat to keep going." };
  }
  const messages: ChatMessage[] = [];
  for (let i = 0; i < input.length; i++) {
    const m = input[i] as Partial<ChatMessage> | null;
    const expected = i % 2 === 0 ? "user" : "assistant";
    if (!m || m.role !== expected || typeof m.content !== "string" || !m.content.trim()) {
      return { ok: false, status: 400, error: "Something went wrong with this chat. Start a new chat." };
    }
    if (m.role === "user" && m.content.length > maxChars) {
      return { ok: false, status: 413, error: `Please keep questions under ${maxChars} characters.` };
    }
    messages.push({ role: m.role, content: m.content.slice(0, maxChars * 4) });
  }
  if (messages[messages.length - 1].role !== "user") {
    return { ok: false, status: 400, error: "Ask a question first." };
  }
  return { ok: true, messages };
}
