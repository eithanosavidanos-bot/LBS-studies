"use client";

/** Switches between light and dark, overriding the system setting. */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const current =
      root.dataset.theme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this page only.
    }
  }
  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Switch light or dark mode" title="Light / dark">
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M12 3a9 9 0 1 0 9 9A9 9 0 0 0 12 3Zm0 16V5a7 7 0 0 1 0 14Z" />
      </svg>
    </button>
  );
}
