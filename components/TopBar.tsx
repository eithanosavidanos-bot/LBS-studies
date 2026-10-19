"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

interface Props {
  signedIn: boolean;
  name: string | null;
  isAdmin: boolean;
  defaultSlug: string | null;
}

export function TopBar({ signedIn, name, isAdmin, defaultSlug }: Props) {
  const pathname = usePathname();
  const inCourse = /^\/c\/([^/]+)(?:\/([^/]+))?/.exec(pathname);
  const slug = inCourse?.[1] ?? defaultSlug;
  const section = inCourse?.[2] ?? (pathname === "/" ? "home" : pathname.startsWith("/admin") ? "admin" : "");

  const tabs: [string, string, string][] = name
    ? [
        ["home", "Courses", "/"],
        ...(slug
          ? ([
              ["book", "Book", `/c/${slug}/book`],
              ["summaries", "Summaries", `/c/${slug}/summaries`],
              ["exam", "Exam practice", `/c/${slug}/exam`],
            ] as [string, string, string][])
          : []),
        ...(isAdmin ? ([["admin", "Admin", "/admin"]] as [string, string, string][]) : []),
      ]
    : [];

  return (
    <div className="bar">
      <div className="wrap">
        <Link className="brand" href="/">
          <b>PMB Study Room</b>
          <span>Business in Context · 8e</span>
        </Link>
        {tabs.length > 0 && (
          <nav className="tabs" aria-label="Sections">
            {tabs.map(([key, label, href]) => (
              <Link key={key} className="tab" href={href} aria-current={section === key ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
        )}
        <span className="spacer" />
        {signedIn && (
          <span className="who">
            {name && (
              <span className="name">
                <span className="dot" />
                {isAdmin ? `${name} · owner` : name}
              </span>
            )}
            <form action="/auth/signout" method="post">
              <button className="btn small">Sign out</button>
            </form>
          </span>
        )}
        <ThemeToggle />
      </div>
    </div>
  );
}

/** Static placeholder while the signed-in bar loads. */
export function TopBarShell() {
  return (
    <div className="bar">
      <div className="wrap">
        <Link className="brand" href="/">
          <b>PMB Study Room</b>
          <span>Business in Context · 8e</span>
        </Link>
      </div>
    </div>
  );
}
