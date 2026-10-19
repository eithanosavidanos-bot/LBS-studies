import Link from "next/link";
import { getBestScores, getQuestionCounts } from "@/lib/courses";
import { MOCK_TEST_SIZE } from "@/lib/questions/grading";
import { loadCourse } from "../course";

export const metadata = { title: "Exam practice" };

export default async function ExamPickerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { session, course, chapters } = await loadCourse(slug);
  const [counts, best] = await Promise.all([getQuestionCounts(course.id), getBestScores(course.id, session.user.id)]);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="eyebrow">{course.code} · Exam practice</div>
      <h1 style={{ marginTop: 6 }}>Practise like the real test.</h1>
      <p className="lede">
        Questions come in three formats: true or false, multiple choice (a, b, c, d) and fill the gap. You get feedback
        and an explanation after each answer. Your best score per test is saved.
      </p>
      {total === 0 ? (
        <p className="empty">No practice questions yet for this course.</p>
      ) : (
        <div className="examgrid">
          <Link className="pick all" href={`/c/${slug}/exam/mock`}>
            <b>Mixed mock test</b>
            <span className="muted">{Math.min(MOCK_TEST_SIZE, total)} random questions from all chapters</span>
            <span className="best">{best.mock != null ? `Best: ${best.mock}%` : "Not tried yet"}</span>
          </Link>
          {chapters
            .filter((c) => (counts.get(c.n) ?? 0) > 0)
            .map((c) => (
              <Link key={c.n} className="pick" href={`/c/${slug}/exam/ch${c.n}`}>
                <b>
                  {c.n}. {c.title}
                </b>
                <span className="muted">{counts.get(c.n)} questions</span>
                <span className="best">{best[`ch${c.n}`] != null ? `Best: ${best[`ch${c.n}`]}%` : ""}</span>
              </Link>
            ))}
        </div>
      )}
    </>
  );
}
