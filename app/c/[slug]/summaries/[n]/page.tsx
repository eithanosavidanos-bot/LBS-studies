import Link from "next/link";
import { getBestScores, partLabel } from "@/lib/courses";
import { sanitizeInline, stripTags } from "@/lib/sanitize";
import { ChapterRail } from "@/components/ChapterRail";
import { AskButton } from "@/components/AskButton";
import { loadChapter } from "../../course";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { n } = await params;
  return { title: `Summary · Chapter ${n}` };
}

export default async function SummaryPage({ params }: { params: Promise<{ slug: string; n: string }> }) {
  const { slug, n } = await params;
  const { session, course, chapters, chapter: c } = await loadChapter(slug, n);
  const best = await getBestScores(course.id, session.user.id);
  const words = stripTags(c.summary.join(" ")).split(/\s+/).length;
  const next = chapters[chapters.findIndex((x) => x.n === c.n) + 1];

  return (
    <div className="desk">
      <ChapterRail chapters={chapters} parts={course.parts} current={c.n} base={`/c/${slug}/summaries`} best={best} />
      <article className="sheet">
        <div className="eyebrow">{partLabel(course, c.part)} · Summary</div>
        <h1 style={{ marginTop: 6 }}>
          {c.n}. {c.title}
        </h1>
        <div className="meta">
          {c.pages && <span className="mono">Book pages {c.pages}</span>}
          <span>About {Math.max(1, Math.round(words / 200))} min read</span>
        </div>
        <div className="reading">
          {c.summary.map((p, i) => (
            <p key={i} dangerouslySetInnerHTML={{ __html: sanitizeInline(p) }} />
          ))}
        </div>
        {c.terms.length > 0 && (
          <div className="section-gap">
            <h3>Key terms</h3>
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
          <Link className="btn primary" href={`/c/${slug}/exam/ch${c.n}`}>
            Test yourself on Chapter {c.n}
          </Link>
          <AskButton prompt={`Explain Chapter ${c.n} (${c.title}) to me in simple terms with one real-world example.`}>
            Explain it more simply
          </AskButton>
          {next && (
            <Link className="btn" href={`/c/${slug}/summaries/${next.n}`}>
              Next chapter →
            </Link>
          )}
        </div>
      </article>
    </div>
  );
}
