import { createAdminClient } from "@/lib/supabase/server";

/** Left column of the sign-in / sign-up pages: what the site offers. */
export async function Landing() {
  // Chapter titles are a public table of contents; nothing else is read here.
  const { data } = await createAdminClient()
    .from("chapters")
    .select("n, title, courses!inner(position, published)")
    .eq("courses.published", true)
    .order("position", { referencedTable: "courses" })
    .order("n")
    .limit(40);
  const titles = (data ?? []).slice(0, 6);
  const more = (data ?? []).length - titles.length;
  return (
    <div>
      <div className="eyebrow">PMB · Principles of Management &amp; Business</div>
      <h1 style={{ marginTop: 8 }}>Everything for the PMB exam, in one place.</h1>
      <p className="lede">
        Chapter guides for <i>Business in Context</i>, short summaries of every chapter, an AI tutor that knows the
        course, and exam practice with true/false, multiple-choice and fill-the-gap questions.
      </p>
      {titles.length > 0 && (
        <ul className="toc-preview">
          {titles.map((c) => (
            <li key={c.n}>
              <span>{String(c.n).padStart(2, "0")}</span>
              {c.title}
            </li>
          ))}
          {more > 0 && (
            <li>
              <span>…</span>and {more} more chapters
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
