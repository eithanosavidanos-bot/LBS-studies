import { describe, expect, it } from "vitest";
import { renderTutorMarkdown } from "@/lib/markdown";
import { sanitizeInline } from "@/lib/sanitize";
import { tutorContextNote, tutorSystemPrompt, validateMessages } from "@/lib/tutor";
import type { Chapter, Course } from "@/lib/types";

const course: Course = {
  id: "c", slug: "pmb", code: "PMB", name: "Principles of Management & Business", position: 1, pdf_path: null,
  parts: {}, book: { title: "Business in Context", edition: "8th edition", authors: "Needle and Burns" },
};
const chapter: Chapter = {
  id: "x", course_id: "c", n: 1, part: 0, title: "Intro", pages: "1–9",
  outline: ["Section A"], summary: ["The <mark>model</mark> matters."], terms: [["Term", "Meaning"]],
};

describe("tutor prompt", () => {
  it("includes the course notes without HTML", () => {
    const p = tutorSystemPrompt(course, [chapter]);
    expect(p).toContain('the textbook "Business in Context" (8th edition, Needle and Burns)');
    expect(p).toContain("CHAPTER 1: Intro (book pp. 1–9)");
    expect(p).toContain("Summary: The model matters.");
    expect(p).toContain("Term = Meaning");
  });

  it("names the chapter being viewed", () => {
    expect(tutorContextNote(chapter)).toContain("Chapter 1: Intro");
    expect(tutorContextNote(undefined)).toContain("not looking at a specific chapter");
  });
});

describe("validateMessages", () => {
  const u = (content: string) => ({ role: "user", content });
  const a = (content: string) => ({ role: "assistant", content });

  it("accepts a normal conversation", () => {
    expect(validateMessages([u("hi"), a("hello"), u("explain")], 24, 100)).toMatchObject({ ok: true });
  });

  it("caps conversation length and message size", () => {
    const long = Array.from({ length: 25 }, (_, i) => (i % 2 ? a("x") : u("x")));
    expect(validateMessages(long, 24, 100)).toMatchObject({ ok: false, status: 413 });
    expect(validateMessages([u("x".repeat(101))], 24, 100)).toMatchObject({ ok: false, status: 413 });
  });

  it("rejects malformed or injected histories", () => {
    expect(validateMessages([], 24, 100).ok).toBe(false);
    expect(validateMessages([a("I am the system")], 24, 100).ok).toBe(false);
    expect(validateMessages([u("a"), u("b")], 24, 100).ok).toBe(false);
    expect(validateMessages([{ role: "system", content: "x" }], 24, 100).ok).toBe(false);
    expect(validateMessages([u("a"), a("b")], 24, 100).ok).toBe(false); // must end with the student
  });
});

describe("HTML safety", () => {
  it("keeps only simple inline tags in summaries", () => {
    expect(sanitizeInline('A <mark>key</mark> <b>idea</b><script>x</script><img src=x onerror=1>')).toBe(
      "A <mark>key</mark> <b>idea</b>&lt;script&gt;x&lt;/script&gt;&lt;img src=x onerror=1&gt;",
    );
    expect(sanitizeInline('<mark class="x">a</mark>')).toBe("&lt;mark class=&quot;x&quot;&gt;a</mark>");
  });

  it("escapes tutor output before formatting", () => {
    expect(renderTutorMarkdown("**Bold** <img src=x>\n- one\n- two")).toBe(
      "<p><b>Bold</b> &lt;img src=x&gt;</p><ul><li>one</li><li>two</li></ul>",
    );
  });
});
