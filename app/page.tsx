import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getBestScores, getChapters, getQuestionCounts, hasCourseAccess, listCourses } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Your courses" };

export default async function HomePage() {
  const session = await requireSession();
  if (!session.profile) redirect("/redeem");

  const courses = await listCourses();
  const withAccess = await Promise.all(courses.map(async (c) => ({ course: c, open: await hasCourseAccess(c.id) })));
  const open = withAccess.filter((x) => x.open).map((x) => x.course);
  const locked = withAccess.filter((x) => !x.open).map((x) => x.course);

  if (open.length === 0 && session.profile.role !== "admin") {
    const supabase = await createClient();
    const { count } = await supabase.from("code_redemptions").select("code_id", { count: "exact", head: true });
    redirect(count ? "/redeem?reason=withdrawn" : "/redeem");
  }

  const cards = await Promise.all(
    open.map(async (course) => {
      const [chapters, counts, best] = await Promise.all([
        getChapters(course.id),
        getQuestionCounts(course.id),
        getBestScores(course.id, session.user.id),
      ]);
      const questions = [...counts.values()].reduce((a, b) => a + b, 0);
      const practised = Object.keys(best).filter((k) => k.startsWith("ch")).length;
      return { course, chapters: chapters.length, questions, practised };
    }),
  );

  const firstName = session.profile.name.split(" ")[0];
  return (
    <>
      <div className="eyebrow">Your courses</div>
      <h1 style={{ marginTop: 6 }}>Welcome, {firstName}.</h1>
      <p className="lede">
        Pick a course to open its book guide, chapter summaries and exam practice. The tutor button in the corner works
        on every page.
      </p>
      <div className="courses">
        {cards.map(({ course, chapters, questions, practised }) => (
          <Link key={course.id} className="course" href={`/c/${course.slug}/summaries`}>
            <span className="eyebrow">Course</span>
            <span className="code">{course.code}</span>
            <span style={{ fontFamily: "var(--body)", fontSize: 16 }}>{course.book.title ?? course.name}</span>
            {course.book.authors && (
              <span className="muted" style={{ fontSize: 13 }}>
                {course.book.authors}
                {course.book.edition ? ` · ${course.book.edition}` : ""}
              </span>
            )}
            <span className="chips">
              <span className="chip">{chapters} chapters</span>
              <span className="chip">{questions} practice questions</span>
              <span className="chip">{practised}/{chapters} chapters practised</span>
            </span>
          </Link>
        ))}
        {locked.map((course) => (
          <Link key={course.id} className="course soon" href="/redeem?reason=course">
            <span className="eyebrow">Locked</span>
            <span className="code">{course.code}</span>
            <span>{course.name}. Enter an access code to unlock it.</span>
          </Link>
        ))}
        {session.profile.role === "admin" && (
          <div className="course soon">
            <span className="eyebrow">Next course</span>
            <span className="code">+</span>
            <span>Add a folder under content/ and run the seed script to add a course.</span>
          </div>
        )}
      </div>
    </>
  );
}
