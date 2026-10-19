# PMB Study Room: project brief

A study website where university students prepare for the PMB exam (textbook: *Business in Context*, 8th ed., Needle & Burns, Cengage 2023, ISBN 978-1-4737-8670-7). More courses will be added later, so build everything course-agnostic.

`prototype/index.html` is a working single-page prototype. Use it as the blueprint for features, content and look (colors, fonts, layout). `content/course.json` holds the chapter guide and summaries, and `content/questions.json` holds the practice questions. Load these into the database with a seed script. Don't hard-code them in components.

## Features

1. **Courses home.** A list of courses, starting with PMB. Clicking a course opens its sections.
2. **Book guide.** For each chapter: its part, page range, section outline and key terms. **Do not upload or display the copyrighted book text.** Leave a hook so the owner can later attach a PDF for a course if they get permission (owner upload, logged-in students only, never public).
3. **Summaries.** One summary per chapter plus key terms, with "Test yourself" and "Next chapter" actions.
4. **Exam practice.** Three question types:
   - `tf`: true/false (`a` is a boolean)
   - `mcq`: options a–d (`o` = options, `a` = index of the correct option)
   - `gap`: fill the gap (`____` marks the gap; `acc` = accepted answers, lowercase)
   Each question has `why` (an explanation). Give one question at a time with instant feedback, then a score screen with a review list. Offer a per-chapter test and a 15-question mixed mock test. Save each student's best score per test. The owner will supply real exam-style questions later, so make question types easy to extend.
5. **AI tutor.** A chat drawer available on every page. It runs **server-side** through the Anthropic API (key in an env var, never sent to the browser). The system prompt includes the course notes from the database and the chapter the student is viewing (see the prompt in `ask()` in the prototype). Stream responses. Rate-limit per user (for example 30 messages per hour, configurable) and cap the conversation length.
6. **Invite-code accounts** (the most important rule):
   - Only the owner (admin role) can create codes, one per student, with a label (the student's name). Format `PMB-XXXX-XXXX` using an alphabet without ambiguous characters.
   - Store only a **hash** of each code server-side. Show the plain code to the owner once at creation, and keep it visible in the owner's admin list.
   - Sign-up requires a valid, unused code. Redeem it **atomically in a database transaction** with a unique constraint, so a code binds to exactly one user and can never be used again, even if it is shared.
   - The owner can see each code's status (unused / in use by whom / withdrawn) and withdraw a code, which revokes that student's access.
   - Students log in afterwards with email + password (or a magic link). Codes can optionally be tied to a course for future multi-course access.
7. **Admin page** (owner only): manage codes, see students and their progress, and later manage questions and summaries.

## Suggested stack

- Next.js (App Router, TypeScript) deployed on Vercel
- Supabase for Postgres, auth and row-level security (or another Postgres + auth provider if preferred)
- Anthropic API for the tutor (`ANTHROPIC_API_KEY`)
- Keep secrets in `.env.local`, and commit a `.env.example`

## Quality bar

- Mobile-friendly. Light and dark mode.
- Enforce all access checks on the server or through RLS, never only in the UI.
- A seed script imports `content/*.json`.
- A README explaining how to run locally, set env vars, create the first admin account, and deploy.
