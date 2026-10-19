// Summaries are owner-written HTML with a few inline tags (<mark>, <b>, <i>).
// Escape everything, then re-enable only those tags, without attributes.
const ALLOWED = ["mark", "b", "i", "em", "strong"];

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function sanitizeInline(html: string): string {
  let out = escapeHtml(html);
  for (const tag of ALLOWED) {
    out = out.replace(new RegExp(`&lt;(/?)${tag}&gt;`, "gi"), `<$1${tag}>`);
  }
  return out;
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}
