import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Chapter, Course } from "@/lib/types";

const COURSE_COLUMNS = "id, slug, code, name, book, parts, position, pdf_path";

/** Published courses (all signed-in users may see the list). */
export const listCourses = cache(async (): Promise<Course[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select(COURSE_COLUMNS).order("position");
  return (data ?? []) as Course[];
});

export const getCourse = cache(async (slug: string): Promise<Course | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select(COURSE_COLUMNS).eq("slug", slug).maybeSingle();
  return (data as Course) ?? null;
});

/** Asks the database (same function RLS uses) whether the user may open a course. */
export const hasCourseAccess = cache(async (courseId: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_course_access", { p_course_id: courseId });
  return !error && data === true;
});

/** Chapters of a course. RLS returns nothing unless the user has access. */
export const getChapters = cache(async (courseId: string): Promise<Chapter[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("id, course_id, n, part, title, pages, outline, summary, terms")
    .eq("course_id", courseId)
    .order("n");
  return (data ?? []) as Chapter[];
});

export const getQuestionCounts = cache(async (courseId: string): Promise<Map<number | null, number>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("questions").select("chapter_n").eq("course_id", courseId);
  const counts = new Map<number | null, number>();
  for (const row of data ?? []) counts.set(row.chapter_n, (counts.get(row.chapter_n) ?? 0) + 1);
  return counts;
});

export const getBestScores = cache(async (courseId: string, userId: string): Promise<Record<string, number>> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("best_scores")
    .select("test_key, best_pct")
    .eq("course_id", courseId)
    .eq("user_id", userId);
  return Object.fromEntries((data ?? []).map((r) => [r.test_key, r.best_pct]));
});

export function partLabel(course: Course, part: number): string {
  return course.parts[String(part)] ?? "";
}
