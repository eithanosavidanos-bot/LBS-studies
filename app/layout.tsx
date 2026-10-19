import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { listCourses } from "@/lib/courses";
import { TopBar, TopBarShell } from "@/components/TopBar";
import { TutorDrawer } from "@/components/TutorDrawer";

export const metadata: Metadata = {
  title: { default: "PMB Study Room", template: "%s · PMB Study Room" },
  description: "Chapter guides, summaries, exam practice and an AI tutor for your course.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#172027" },
  ],
};

// Applies a saved light/dark choice before first paint, to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The page shell is static; everything that depends on who is signed in
  // streams in through the Suspense boundaries.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400..700;1,8..60,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <Suspense fallback={<TopBarShell />}>
          <SessionTopBar />
        </Suspense>
        <main className="wrap">
          <Suspense fallback={<p className="muted">Loading…</p>}>{children}</Suspense>
        </main>
        <Suspense fallback={null}>
          <SessionTutor />
        </Suspense>
      </body>
    </html>
  );
}

async function firstCourseSlug(): Promise<string | null> {
  const courses = await listCourses();
  return courses[0]?.slug ?? null;
}

async function SessionTopBar() {
  const session = await getSession();
  return (
    <TopBar
      signedIn={Boolean(session)}
      name={session?.profile?.name ?? null}
      isAdmin={session?.profile?.role === "admin"}
      defaultSlug={session?.profile ? await firstCourseSlug() : null}
    />
  );
}

async function SessionTutor() {
  const session = await getSession();
  if (!session?.profile) return null;
  return <TutorDrawer defaultSlug={await firstCourseSlug()} />;
}
