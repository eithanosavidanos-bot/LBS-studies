"use client";

// Input UI for each question type, keyed like QUESTION_TYPES in
// lib/questions/types.ts. A new type needs an entry here too.
import { useState } from "react";
import { GAP, LETTERS, type AnswerResult } from "@/lib/questions/types";

export interface InputProps {
  data: Record<string, unknown>;
  /** The student's response once given (undefined while unanswered). */
  response: unknown;
  result: AnswerResult | null;
  busy: boolean;
  onAnswer: (response: unknown) => void;
}

function optionClass(isPicked: boolean, result: AnswerResult | null, isCorrect: boolean) {
  if (!result) return "opt";
  if (isCorrect) return "opt right";
  return isPicked ? "opt wrong" : "opt";
}

function TrueFalseInput({ response, result, busy, onAnswer }: InputProps) {
  const answered = response !== undefined;
  const correct = result?.correct;
  return (
    <div className="tf">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          className={optionClass(response === v, result, correct === v)}
          disabled={answered || busy}
          onClick={() => onAnswer(v)}
        >
          {v ? "True" : "False"}
        </button>
      ))}
    </div>
  );
}

function MultipleChoiceInput({ data, response, result, busy, onAnswer }: InputProps) {
  const options = (data.o as string[]) ?? [];
  const answered = response !== undefined;
  const correctIndex = result?.correct;
  return (
    <div className="opts">
      {options.map((o, k) => (
        <button
          key={k}
          className={optionClass(response === k, result, correctIndex === k)}
          disabled={answered || busy}
          onClick={() => onAnswer(k)}
        >
          <span className="l">{LETTERS[k]})</span>
          <span>{o}</span>
        </button>
      ))}
    </div>
  );
}

function FillGapInput({ response, busy, onAnswer }: InputProps) {
  const [value, setValue] = useState("");
  if (response !== undefined) {
    return (
      <p className="muted" style={{ fontFamily: "var(--body)" }}>
        Your answer: <b>{String(response) || "(blank)"}</b>
      </p>
    );
  }
  return (
    <form
      className="gapform"
      onSubmit={(e) => {
        e.preventDefault();
        onAnswer(value.trim());
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete="off"
        autoFocus
        placeholder="Type the missing word"
        aria-label="Missing word"
        maxLength={200}
      />
      <button className="btn primary" disabled={busy}>
        Check
      </button>
    </form>
  );
}

export const QUESTION_INPUTS: Record<string, (props: InputProps) => React.ReactNode> = {
  tf: TrueFalseInput,
  mcq: MultipleChoiceInput,
  gap: FillGapInput,
};

/** Question text, with the gap drawn as a line for fill-the-gap questions. */
export function QuestionText({ prompt }: { prompt: string }) {
  const parts = prompt.split(GAP);
  return (
    <p className="qtext">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && <span className="gapline">&nbsp;</span>}
        </span>
      ))}
    </p>
  );
}
