// Question types. Each type knows how to read itself from the seed JSON,
// what part of it is safe to show before answering, and how to grade a
// response. Grading always happens on the server.
//
// To add a type: write a definition below, add it to QUESTION_TYPES, and add
// an input component in components/questions/index.tsx.

export interface QuestionType<Payload, PublicPayload, Response> {
  /** Shown above the question, e.g. "Multiple choice". */
  label: string;
  /** Reads the type-specific fields from a seed/JSON record. Throws on bad data. */
  parsePayload(raw: Record<string, unknown>): Payload;
  /** What the browser may see before the student answers. Never includes the answer. */
  toPublic(payload: Payload): PublicPayload;
  /** Validates an untrusted response from the browser. Null if malformed. */
  parseResponse(input: unknown): Response | null;
  grade(payload: Payload, response: Response): boolean;
  /** The correct answer as text, for feedback and the review list. */
  answerText(payload: Payload): string;
  /** The correct response, if the input UI can highlight it (e.g. the right option). */
  correctResponse?(payload: Payload): Response;
}

function fail(msg: string): never {
  throw new Error(msg);
}

// --- true / false -----------------------------------------------------------

export const trueFalse: QuestionType<{ a: boolean }, Record<string, never>, boolean> = {
  label: "True or false",
  parsePayload: (raw) => (typeof raw.a === "boolean" ? { a: raw.a } : fail("tf: `a` must be a boolean")),
  toPublic: () => ({}),
  parseResponse: (input) => (typeof input === "boolean" ? input : null),
  grade: (p, r) => p.a === r,
  answerText: (p) => (p.a ? "True" : "False"),
  correctResponse: (p) => p.a,
};

// --- multiple choice --------------------------------------------------------

export const LETTERS = "abcdefgh";

export const multipleChoice: QuestionType<{ o: string[]; a: number }, { o: string[] }, number> = {
  label: "Multiple choice",
  parsePayload: (raw) => {
    const o = raw.o;
    if (!Array.isArray(o) || o.length < 2 || o.length > LETTERS.length || !o.every((x) => typeof x === "string"))
      fail("mcq: `o` must be 2-8 strings");
    const a = raw.a;
    if (typeof a !== "number" || !Number.isInteger(a) || a < 0 || a >= o.length)
      fail("mcq: `a` must be the index of the correct option");
    return { o, a };
  },
  toPublic: (p) => ({ o: p.o }),
  parseResponse: (input) => (typeof input === "number" && Number.isInteger(input) && input >= 0 ? input : null),
  grade: (p, r) => p.a === r,
  answerText: (p) => `${LETTERS[p.a]}) ${p.o[p.a]}`,
  correctResponse: (p) => p.a,
};

// --- fill the gap -----------------------------------------------------------

/** Lowercase, letters/digits/spaces only, single spaces. */
export function normalizeGapAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const fillGap: QuestionType<{ acc: string[] }, Record<string, never>, string> = {
  label: "Fill the gap",
  parsePayload: (raw) => {
    const acc = raw.acc;
    if (!Array.isArray(acc) || acc.length === 0 || !acc.every((x) => typeof x === "string"))
      fail("gap: `acc` must be a non-empty list of accepted answers");
    return { acc: acc.map(normalizeGapAnswer) };
  },
  toPublic: () => ({}),
  parseResponse: (input) => (typeof input === "string" && input.length <= 200 ? input : null),
  grade: (p, r) => p.acc.includes(normalizeGapAnswer(r)),
  answerText: (p) => p.acc[0],
};

// --- registry ---------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const QUESTION_TYPES: Record<string, QuestionType<any, any, any>> = {
  tf: trueFalse,
  mcq: multipleChoice,
  gap: fillGap,
};

export function getQuestionType(type: string) {
  const def = QUESTION_TYPES[type];
  if (!def) throw new Error(`Unknown question type "${type}"`);
  return def;
}

/** The gap marker in prompts. */
export const GAP = "____";

/** Question as sent to the browser before it is answered. */
export interface PublicQuestion {
  id: string;
  type: string;
  chapter: number | null;
  prompt: string;
  data: Record<string, unknown>;
}

/** Server's verdict on one answer. */
export interface AnswerResult {
  ok: boolean;
  answer: string;
  why: string;
  correct?: unknown;
}
