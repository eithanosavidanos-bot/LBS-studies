"use server";

import { getSession } from "@/lib/auth";
import { getCourse, hasCourseAccess } from "@/lib/courses";
import { gradeQuestion, MOCK_TEST_SIZE, parseTestKey } from "@/lib/questions/grading";
import type { AnswerResult } from "@/lib/questions/types";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { QuestionRow } from "@/lib/types";

const QUESTION_COLUMNS = "id, course_id, chapter_n, type, prompt, payload, explanation";

/** Grades one answer for instant feedback. RLS only returns questions the user may see. */
export async function checkAnswer(questionId: string, response: unknown): Promise<AnswerResult | { error: string }> {
  if (!(await getSession())) return { error: "Your session has ended. Sign in again." };
  const supabase = await createClient();
  const { data } = await supabase.from("questions").select(QUESTION_COLUMNS).eq("id", questionId).maybeSingle<QuestionRow>();
  if (!data) return { error: "That question isn't available." };
  return gradeQuestion(data, response);
}

export interface TestResult {
  pct: number;
  right: number;
  total: number;
  results: (AnswerResult & { id: string })[];
}

/**
 * Re-grades the whole test on the server and saves the best score. The score
 * comes from the server's grading, never from the browser.
 */
export async function finishTest(
  slug: string,
  testKey: string,
  answers: { id: string; response: unknown }[],
): Promise<TestResult | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Your session has ended. Sign in again." };
  const chapter = parseTestKey(testKey);
  const course = await getCourse(slug);
  if (chapter === undefined || !course || !(await hasCourseAccess(course.id))) return { error: "That test isn't available." };

  const ids = [...new Set(answers.map((a) => a.id))];
  if (ids.length !== answers.length || ids.length === 0) return { error: "That test doesn't look right. Start it again." };

  const supabase = await createClient();
  const { data } = await supabase.from("questions").select(QUESTION_COLUMNS).eq("course_id", course.id).in("id", ids);
  const byId = new Map((data as QuestionRow[] | null)?.map((q) => [q.id, q]) ?? []);
  if (byId.size !== ids.length) return { error: "That test doesn't look right. Start it again." };

  // A chapter test must cover every question of that chapter; a mock test must
  // be a full-size random draw. This stops a partial run being saved as a score.
  if (chapter === null) {
    const { count } = await supabase.from("questions").select("id", { count: "exact", head: true }).eq("course_id", course.id);
    if (ids.length !== Math.min(MOCK_TEST_SIZE, count ?? 0)) return { error: "That test doesn't look right. Start it again." };
  } else {
    const { count } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("course_id", course.id)
      .eq("chapter_n", chapter);
    if ([...byId.values()].some((q) => q.chapter_n !== chapter) || ids.length !== count)
      return { error: "That test doesn't look right. Start it again." };
  }

  const results = answers.map((a) => ({ id: a.id, ...gradeQuestion(byId.get(a.id)!, a.response) }));
  const right = results.filter((r) => r.ok).length;
  const pct = Math.round((right / results.length) * 100);

  await createAdminClient().rpc("record_score", {
    p_user_id: session.user.id,
    p_course_id: course.id,
    p_test_key: testKey,
    p_pct: pct,
  });
  return { pct, right, total: results.length, results };
}
