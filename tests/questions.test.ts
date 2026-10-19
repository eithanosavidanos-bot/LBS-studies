import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gradeQuestion, parseTestKey, toPublicQuestion } from "@/lib/questions/grading";
import { getQuestionType, normalizeGapAnswer } from "@/lib/questions/types";
import type { QuestionRow } from "@/lib/types";

function row(type: string, payload: Record<string, unknown>): QuestionRow {
  return { id: "q1", course_id: "c1", chapter_n: 1, type, prompt: "Q", payload, explanation: "Because." };
}

describe("question types", () => {
  it("grades true/false", () => {
    const q = row("tf", { a: false });
    expect(gradeQuestion(q, false)).toMatchObject({ ok: true, answer: "False", correct: false });
    expect(gradeQuestion(q, true).ok).toBe(false);
    expect(gradeQuestion(q, "false").ok).toBe(false); // wrong type counts as wrong
  });

  it("grades multiple choice", () => {
    const q = row("mcq", { o: ["A", "B", "C", "D"], a: 2 });
    expect(gradeQuestion(q, 2)).toMatchObject({ ok: true, answer: "c) C", correct: 2 });
    expect(gradeQuestion(q, 1).ok).toBe(false);
    expect(gradeQuestion(q, -1).ok).toBe(false);
  });

  it("grades fill the gap leniently", () => {
    const q = row("gap", { acc: ["systems", "system"] });
    expect(gradeQuestion(q, "  Systems. ").ok).toBe(true);
    expect(gradeQuestion(q, "SYSTEM").ok).toBe(true);
    expect(gradeQuestion(q, "contingency").ok).toBe(false);
    expect(normalizeGapAnswer("Laissez-faire!")).toBe("laissezfaire");
  });

  it("never sends the answer to the browser", () => {
    for (const q of [row("tf", { a: true }), row("mcq", { o: ["x", "y"], a: 1 }), row("gap", { acc: ["word"] })]) {
      const pub = toPublicQuestion(q);
      expect(JSON.stringify(pub)).not.toMatch(/"a"|"acc"|word|Because/);
    }
  });

  it("rejects invalid payloads and unknown types", () => {
    expect(() => getQuestionType("mcq").parsePayload({ o: ["x", "y"], a: 5 })).toThrow();
    expect(() => getQuestionType("tf").parsePayload({ a: "yes" })).toThrow();
    expect(() => getQuestionType("essay")).toThrow(/Unknown question type/);
  });

  it("parses test keys", () => {
    expect(parseTestKey("mock")).toBeNull();
    expect(parseTestKey("ch12")).toBe(12);
    expect(parseTestKey("ch0")).toBeUndefined();
    expect(parseTestKey("all")).toBeUndefined();
  });

  it("accepts every question in the PMB seed file", () => {
    const seed = JSON.parse(readFileSync("content/pmb/questions.json", "utf8")) as Record<string, unknown>[];
    expect(seed.length).toBeGreaterThan(0);
    for (const q of seed) expect(() => getQuestionType(q.type as string).parsePayload(q)).not.toThrow();
  });
});
