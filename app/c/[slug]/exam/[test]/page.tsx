import { notFound } from "next/navigation";
import { MOCK_TEST_SIZE, parseTestKey, shuffle, toPublicQuestion } from "@/lib/questions/grading";
import { createClient } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";
import { ExamRunner } from "@/components/ExamRunner";
import { loadCourse } from "../../course";

export const metadata = { title: "Test" };

export default async function TestPage({ params }: { params: Promise<{ slug: string; test: string }> }) {
  const { slug, test } = await params;
  const chapterN = parseTestKey(test);
  if (chapterN === undefined) notFound();
  const { course, chapters } = await loadCourse(slug);

  const supabase = await createClient();
  let query = supabase
    .from("questions")
    .select("id, course_id, chapter_n, type, prompt, payload, explanation")
    .eq("course_id", course.id);
  if (chapterN !== null) query = query.eq("chapter_n", chapterN);
  const { data } = await query;
  const pool = shuffle((data ?? []) as QuestionRow[]);
  const picked = chapterN === null ? pool.slice(0, MOCK_TEST_SIZE) : pool;
  if (!picked.length) notFound();

  const chapter = chapters.find((c) => c.n === chapterN);
  const title = chapter ? `Chapter ${chapter.n} · ${chapter.title}` : "Mixed mock test";

  return (
    <ExamRunner
      key={crypto.randomUUID()} // fresh state for "Try again"
      slug={slug}
      testKey={test}
      title={title}
      chapterLabel={chapter ? `Chapter ${chapter.n}` : null}
      // Answers and explanations stay on the server until a question is answered.
      questions={picked.map(toPublicQuestion)}
    />
  );
}
