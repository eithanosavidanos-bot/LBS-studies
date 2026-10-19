"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export interface RailChapter {
  n: number;
  part: number;
  title: string;
}

interface Props {
  chapters: RailChapter[];
  parts: Record<string, string>;
  current: number;
  base: string; // e.g. /c/pmb/summaries
  best: Record<string, number>;
}

/** Chapter list on wide screens, a select on phones. */
export function ChapterRail({ chapters, parts, current, base, best }: Props) {
  const router = useRouter();
  return (
    <>
      <aside className="rail" aria-label="Chapters">
        {chapters.map((c, i) => {
          const newPart = i === 0 || chapters[i - 1].part !== c.part;
          const header = newPart ? <div className="part">{parts[String(c.part)] ?? ""}</div> : null;
          const score = best[`ch${c.n}`];
          return (
            <Fragment key={c.n}>
              {header}
              <Link className="chbtn" href={`${base}/${c.n}`} aria-current={c.n === current ? "true" : undefined}>
                <span className="n">{String(c.n).padStart(2, "0")}</span>
                <span className="t">{c.title}</span>
                <span className="s">{score != null ? `${score}%` : ""}</span>
              </Link>
            </Fragment>
          );
        })}
      </aside>
      <select
        className="chselect"
        aria-label="Chapter"
        value={current}
        onChange={(e) => router.push(`${base}/${e.target.value}`)}
      >
        {chapters.map((c) => (
          <option key={c.n} value={c.n}>
            {c.n}. {c.title}
          </option>
        ))}
      </select>
    </>
  );
}
