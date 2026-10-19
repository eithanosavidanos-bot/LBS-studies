import "server-only";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getChapters, getCourse, hasCourseAccess } from "@/lib/courses";

/**
 * Loads a course for a page, enforcing access on the server: unknown course
 * -> 404, no access -> the access-code page. RLS enforces the same rule again
 * on every query.
 */
export async function loadCourse(slug: string) {
  const session = await requireSession();
  if (!session.profile) redirect("/redeem");
  const course = await getCourse(slug);
  if (!course) notFound();
  if (!(await hasCourseAccess(course.id))) redirect("/redeem?reason=course");
  const chapters = await getChapters(course.id);
  return { session, course, chapters };
}

export async function loadChapter(slug: string, nParam: string) {
  const data = await loadCourse(slug);
  const chapter = data.chapters.find((c) => String(c.n) === nParam);
  if (!chapter) notFound();
  return { ...data, chapter };
}
