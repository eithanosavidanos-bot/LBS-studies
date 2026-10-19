// Imports course content from content/<slug>/course.json and questions.json.
//
//   npm run seed            # every folder in content/
//   npm run seed -- pmb     # one course
//
// Safe to re-run: the course and chapters are upserted, and questions with
// source = 'seed' are replaced. Questions added another way are kept.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { adminClient } from "./_env";
import { getQuestionType } from "../lib/questions/types";

interface CourseFile {
  course: { slug: string; code: string; name: string; position?: number };
  book?: Record<string, string>;
  parts?: Record<string, string>;
  chapters: {
    n: number;
    part?: number;
    title: string;
    pages?: string;
    outline?: string[];
    summary?: string[];
    terms?: [string, string][];
  }[];
}

interface SeedQuestion {
  ch?: number | null;
  type: string;
  q: string;
  why?: string;
  [field: string]: unknown;
}

const supabase = adminClient();

async function seedCourse(dir: string) {
  const course = JSON.parse(readFileSync(join(dir, "course.json"), "utf8")) as CourseFile;
  const questionsPath = join(dir, "questions.json");
  const questions = existsSync(questionsPath)
    ? (JSON.parse(readFileSync(questionsPath, "utf8")) as SeedQuestion[])
    : [];

  // Validate everything before writing anything.
  const chapterNumbers = new Set(course.chapters.map((c) => c.n));
  const questionRows = questions.map((q, i) => {
    const where = `${dir}/questions.json #${i + 1}`;
    if (!q.q) throw new Error(`${where}: missing "q"`);
    if (q.ch != null && !chapterNumbers.has(q.ch)) throw new Error(`${where}: unknown chapter ${q.ch}`);
    let payload;
    try {
      payload = getQuestionType(q.type).parsePayload(q);
    } catch (e) {
      throw new Error(`${where}: ${(e as Error).message}`);
    }
    return { chapter_n: q.ch ?? null, type: q.type, prompt: q.q, payload, explanation: q.why ?? "", source: "seed", position: i };
  });

  const { data: courseRow, error: courseErr } = await supabase
    .from("courses")
    .upsert(
      {
        slug: course.course.slug,
        code: course.course.code,
        name: course.course.name,
        position: course.course.position ?? 0,
        book: course.book ?? {},
        parts: course.parts ?? {},
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (courseErr) throw courseErr;
  const courseId = courseRow.id as string;

  const { error: chErr } = await supabase.from("chapters").upsert(
    course.chapters.map((c) => ({
      course_id: courseId,
      n: c.n,
      part: c.part ?? 0,
      title: c.title,
      pages: c.pages ?? "",
      outline: c.outline ?? [],
      summary: c.summary ?? [],
      terms: c.terms ?? [],
    })),
    { onConflict: "course_id,n" },
  );
  if (chErr) throw chErr;

  const { error: rmChErr } = await supabase
    .from("chapters")
    .delete()
    .eq("course_id", courseId)
    .not("n", "in", `(${[...chapterNumbers].join(",")})`);
  if (rmChErr) throw rmChErr;

  const { error: delErr } = await supabase.from("questions").delete().eq("course_id", courseId).eq("source", "seed");
  if (delErr) throw delErr;
  if (questionRows.length) {
    const { error: qErr } = await supabase.from("questions").insert(questionRows.map((q) => ({ ...q, course_id: courseId })));
    if (qErr) throw qErr;
  }

  console.log(`✓ ${course.course.code}: ${course.chapters.length} chapters, ${questionRows.length} questions`);
}

async function main() {
  const root = join(process.cwd(), "content");
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const slugs = only.length ? only : readdirSync(root).filter((d) => existsSync(join(root, d, "course.json")));
  for (const slug of slugs) await seedCourse(join(root, slug));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
