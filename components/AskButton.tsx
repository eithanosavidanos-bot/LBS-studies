"use client";

export const TUTOR_ASK_EVENT = "tutor:ask";

/** Opens the tutor drawer and sends `prompt` as the student's message. */
export function AskButton({ prompt, children, className = "btn" }: { prompt: string; children: React.ReactNode; className?: string }) {
  return (
    <button className={className} onClick={() => window.dispatchEvent(new CustomEvent(TUTOR_ASK_EVENT, { detail: prompt }))}>
      {children}
    </button>
  );
}
