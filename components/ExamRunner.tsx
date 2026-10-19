"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { checkAnswer, finishTest, type TestResult } from "@/lib/actions/exam";
import { QUESTION_TYPES, GAP, type AnswerResult, type PublicQuestion } from "@/lib/questions/types";
import { QUESTION_INPUTS, QuestionText } from "./questions";
import { AskButton } from "./AskButton";

interface Props {
  slug: string;
  testKey: string;
  title: string;
  chapterLabel: string | null;
  questions: PublicQuestion[];
}

interface Entry {
  response: unknown;
  result: AnswerResult | null;
}

export function ExamRunner({ slug, testKey, title, chapterLabel, questions }: Props) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [log, setLog] = useState<Entry[]>([]);
  const [final, setFinal] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const q = questions[index];
  const entry = log[index];
  const isMock = chapterLabel === null;

  function answer(response: unknown) {
    if (entry || busy) return;
    setError(null);
    setLog((l) => Object.assign([...l], { [index]: { response, result: null } }));
    startTransition(async () => {
      const res = await checkAnswer(q.id, response);
      if ("error" in res) {
        setError(res.error);
        setLog((l) => l.slice(0, index)); // let them try again
        return;
      }
      setLog((l) => Object.assign([...l], { [index]: { response, result: res } }));
    });
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      window.scrollTo(0, 0);
      return;
    }
    startTransition(async () => {
      const res = await finishTest(
        slug,
        testKey,
        questions.map((qq, i) => ({ id: qq.id, response: log[i]?.response })),
      );
      if ("error" in res) setError(res.error);
      else setFinal(res);
      window.scrollTo(0, 0);
    });
  }

  if (final) {
    const wrong = questions.filter((_, i) => !final.results[i].ok);
    const explain = wrong
      .map((qq) => `${qq.prompt.replace(GAP, "___")} (correct: ${final.results[questions.indexOf(qq)].answer})`)
      .join(" | ");
    return (
      <div className="sheet">
        <div className="eyebrow">{isMock ? "Mixed mock test" : chapterLabel} · Result</div>
        <div style={{ display: "flex", gap: 24, alignItems: "end", flexWrap: "wrap", marginTop: 10 }}>
          <span className="score">{final.pct}%</span>
          <span className="muted" style={{ paddingBottom: 10 }}>
            {final.right} of {final.total} correct
          </span>
        </div>
        <ul className="review">
          {questions.map((qq, i) => (
            <li key={qq.id}>
              <span className={final.results[i].ok ? "ok" : "no"}>{final.results[i].ok ? "✓" : "✗"}</span>
              <span>
                {qq.prompt.replace(GAP, "___")}
                <br />
                <span className="muted">Answer: {final.results[i].answer}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="actions">
          <button className="btn primary" onClick={() => router.refresh()}>
            Try again
          </button>
          <Link className="btn" href={`/c/${slug}/exam`}>
            Choose another test
          </Link>
          {wrong.length > 0 && (
            <AskButton prompt={`I got these wrong in a practice test, please explain each one: ${explain}`}>
              Explain my mistakes
            </AskButton>
          )}
        </div>
      </div>
    );
  }

  const Input = QUESTION_INPUTS[q.type];
  const answered = Boolean(entry?.result);
  return (
    <div className="sheet">
      <div className="qhead">
        <div className="eyebrow">{title}</div>
        <span className="mono muted">
          {index + 1} / {questions.length}
        </span>
      </div>
      <div className="progress">
        <i style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>
      <span className="qtype">{QUESTION_TYPES[q.type]?.label ?? q.type}</span>
      {isMock && q.chapter != null && <span className="qtype" style={{ marginLeft: 6 }}>Ch. {q.chapter}</span>}
      <QuestionText prompt={q.prompt} />
      {Input ? (
        <Input key={q.id} data={q.data} response={entry?.response} result={entry?.result ?? null} busy={busy} onAnswer={answer} />
      ) : (
        <p className="msg err">This question type can&apos;t be shown yet.</p>
      )}
      {error && (
        <div className="msg err" role="alert" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}
      {entry?.result && (
        <>
          <div className={`feedback ${entry.result.ok ? "ok" : "no"}`} role="status">
            <b>{entry.result.ok ? "Correct." : `Not quite. The answer is ${entry.result.answer}.`}</b> {entry.result.why}
          </div>
          <div className="actions">
            <button className="btn primary" onClick={next} disabled={busy} autoFocus>
              {index + 1 < questions.length ? "Next question" : busy ? "Scoring…" : "See my score"}
            </button>
          </div>
        </>
      )}
      <div className="actions" style={{ marginTop: entry?.result ? 10 : 26 }}>
        <Link className="linkbtn" href={`/c/${slug}/exam`}>
          Leave test
        </Link>
      </div>
    </div>
  );
}
