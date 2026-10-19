import Link from "next/link";
import { getBestScores, partLabel } from "@/lib/courses";
import { ChapterRail } from "@/components/ChapterRail";
import { AskButton } from "@/components/AskButton";
import { loadChapter } from "../../course";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { n } = await params;
  return { title: `Book guide · Chapter ${n}` };
}

export default async function BookChapterPage({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params;
  const { session, course, chapters, chapter: c } = await loadChapter(slug, n);
  const best = await getBestScores(course.id, session.user.id);
  const b = course.book;

  return (
    <>
      <div className="notice">
        <p>
          <b>The book:</b> {b.title}
          {b.edition ? `, ${b.edition}` : ""}. {b.authors}. {b.publisher}.{" "}
          {b.isbn && <span className="mono">ISBN {b.isbn}</span>}
        </p>
        {course.pdf_path ? (
          <p className="muted">
            The course owner has made a copy of the book available to enrolled students.{" "}
            <a className="link" href={`/c/${slug}/book/pdf`} target="_blank" rel="noopener">
              Open the PDF
            </a>{" "}
            (for your own study only, please don&apos;t share it).
          </p>
        ) : (
          <p className="muted">
            The full text is copyrighted, so it isn&apos;t shared here. Use your own copy or the library&apos;s. This
            guide maps each chapter so you know what to read and where.
          </p>
        )}
      </div>
      <div className="desk">
        <ChapterRail chapters={chapters} parts={course.parts} current={c.n} base={`/c/${slug}/book`} best={best} />
        <article className="sheet">
          <div className="eyebrow">{partLabel(course, c.part)}</div>
          <h1 style={{ marginTop: 6 }}>
            {c.n}. {c.title}
          </h1>
          <div className="meta">
            {c.pages && <span className="mono">Book pages {c.pages}</span>}
            <span>{c.outline.length} main sections</span>
          </div>
          <h3>What the chapter covers</h3>
          <ol className="outline">
            {c.outline.map((o, i) => (
              <li key={i}>
                <span className="k">
                  {c.n}.{i + 1}
                </span>
                <span>{o}</span>
              </li>
            ))}
          </ol>
          {c.terms.length > 0 && (
            <div className="section-gap">
              <h3>Key terms to look out for</h3>
              <div className="terms" style={{ marginTop: 12 }}>
                {c.terms.map(([term, def]) => (
                  <div className="term" key={term}>
                    <b>{term}</b>
                    <span>{def}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="actions">
            <Link className="btn primary" href={`/c/${slug}/summaries/${c.n}`}>
              Read the summary
            </Link>
            <Link className="btn" href={`/c/${slug}/exam/ch${c.n}`}>
              Practise this chapter
            </Link>
            <AskButton prompt={`Give me a study plan for Chapter ${c.n}, ${c.title}: what should I focus on for the exam?`}>
              Ask the tutor about it
            </AskButton>
          </div>
        </article>
      </div>
    </>
  );
}
