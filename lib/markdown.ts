import { escapeHtml } from "@/lib/sanitize";

/**
 * Minimal Markdown for tutor replies: **bold**, *italic*, bullet/numbered
 * lists and paragraphs. The text is escaped first, so the result is safe HTML.
 */
export function renderTutorMarkdown(text: string): string {
  const lines = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .split("\n");
  let out = "";
  let list = false;
  for (const line of lines) {
    const m = /^\s*(?:[-•*]|\d+\.)\s+(.*)/.exec(line);
    if (m) {
      if (!list) {
        out += "<ul>";
        list = true;
      }
      out += `<li>${m[1]}</li>`;
      continue;
    }
    if (list) {
      out += "</ul>";
      list = false;
    }
    if (line.trim()) out += `<p>${line.replace(/^#+\s*/, "")}</p>`;
  }
  return out + (list ? "</ul>" : "");
}
