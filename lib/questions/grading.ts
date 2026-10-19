import type { QuestionRow } from "@/lib/types";
import { getQuestionType, type AnswerResult, type PublicQuestion } from "./types";

export function toPublicQuestion(q: QuestionRow): PublicQuestion {
  const def = getQuestionType(q.type);
  return { id: q.id, type: q.type, chapter: q.chapter_n, prompt: q.prompt, data: def.toPublic(def.parsePayload(q.payload)) };
}

/** Grades an untrusted response. A malformed response counts as wrong. */
export function gradeQuestion(q: QuestionRow, response: unknown): AnswerResult {
  const def = getQuestionType(q.type);
  const payload = def.parsePayload(q.payload);
  const parsed = def.parseResponse(response);
  return {
    ok: parsed !== null && def.grade(payload, parsed),
    answer: def.answerText(payload),
    why: q.explanation,
    correct: def.correctResponse?.(payload),
  };
}

export const MOCK_TEST_SIZE = 15;

export function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** "mock" or "ch3" -> chapter number (null for the mock test), or undefined if invalid. */
export function parseTestKey(key: string): number | null | undefined {
  if (key === "mock") return null;
  const m = /^ch([1-9][0-9]{0,2})$/.exec(key);
  return m ? Number(m[1]) : undefined;
}
