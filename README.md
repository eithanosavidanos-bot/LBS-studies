# PMB Study Room

A study site for university courses, starting with **PMB** (*Business in Context*, 8th ed., Needle & Burns). Students get chapter guides, summaries, exam practice and an AI tutor. Access is by personal invite code only.

Built with Next.js 16 (App Router, TypeScript), Supabase (Postgres, Auth, Storage, row-level security) and the Anthropic API.

- `docs/brief.md`: the original project brief.
- `docs/prototype.html`: the single-file prototype the design is ported from.

## What's in it

| Area | Where |
|---|---|
| Courses home | `app/page.tsx` |
| Book guide (outline, pages, key terms, optional PDF) | `app/c/[slug]/book/` |
| Summaries | `app/c/[slug]/summaries/` |
| Exam practice (chapter tests, 15-question mock) | `app/c/[slug]/exam/`, `components/ExamRunner.tsx`, `lib/actions/exam.ts` |
| AI tutor (streaming, rate-limited) | `components/TutorDrawer.tsx`, `app/api/tutor/route.ts`, `lib/tutor.ts` |
| Sign-up with invite code, login, magic link | `app/signup`, `app/login`, `app/redeem`, `lib/actions/auth.ts` |
| Admin (codes, students and progress, book PDF) | `app/admin/`, `lib/actions/admin.ts` |
| Database schema, RLS, server-only functions | `supabase/migrations/` |
| Content | `content/<course>/course.json`, `content/<course>/questions.json` |

## Run it locally

You need Node 20.12+ and a Supabase project (a free one is fine; the [Supabase CLI](https://supabase.com/docs/guides/local-development) local stack also works).

1. **Install:** `npm install`
2. **Environment:** `cp .env.example .env.local` and fill it in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase → Project settings → API. The newer "publishable" key works in the same variable.
   - `SUPABASE_SERVICE_ROLE_KEY`: same page (or the newer "secret" key). **Server only.**
   - `INVITE_CODE_SECRET`: generate one with `openssl rand -base64 32`. Keep it stable: changing it invalidates every unused code.
   - `ANTHROPIC_API_KEY`: from console.anthropic.com. **Server only.**
   - Optional: `TUTOR_MODEL` (default `claude-opus-5-5`), `TUTOR_MESSAGES_PER_HOUR` (default 30), `TUTOR_MAX_MESSAGES` (conversation cap, default 24), `TUTOR_MAX_CHARS` (default 4000), `INVITE_CODE_PREFIX` (default `PMB`).
3. **Database:** easiest is to paste `supabase/setup.sql` (tables, security rules and all course content) into Supabase → SQL Editor and click Run, once. Alternatively apply `supabase/migrations/` with `supabase db push` and then run `npm run seed`. After editing `content/`, regenerate the SQL with `npm run seed:sql` (writes `supabase/seed.sql`), or run `npm run seed`.
4. **Supabase Auth settings** (Dashboard → Authentication):
   - **Turn off "Allow new users to sign up".** Accounts are only created by the server after a valid code. Turning it off stops anyone creating a bare account through the public API (such an account would see nothing anyway, because of RLS).
   - URL configuration: set **Site URL** to your site and add `http://localhost:3000/auth/callback` (plus your production `/auth/callback`) to **Redirect URLs**. This makes magic links work.
5. **Content:** `npm run seed` imports every folder in `content/`, or `npm run seed -- pmb` imports one course. It's safe to re-run: chapters are upserted and seeded questions are replaced.
6. **First admin:**
   ```bash
   npm run create-admin -- --email you@example.com --password 'a-long-password' --name "Your Name"
   ```
   This creates the owner account without a code, or promotes an existing account. Without a terminal: create the user under Supabase → Authentication → Users → Add user (tick "Auto Confirm User"), then run `supabase/make-admin.sql` in the SQL Editor with your email filled in.
7. **Start:** `npm run dev`, open http://localhost:3000, sign in, go to **Admin** and create a code for yourself to try the student sign-up.

## How access works

- **Invite codes** look like `PMB-7KQ2-XM4D`. They use 8 characters from an alphabet without look-alikes (no I, O, 0 or 1), giving 40 random bits.
- The database stores an **HMAC-SHA256 hash** of each code, used for lookups. It also stores an AES-256-GCM encrypted copy, so the admin list can show the code again. Both use keys derived from `INVITE_CODE_SECRET`, which only the server has. The plain code is never stored.
- **Redemption is atomic.** `redeem_invite_code()` locks the code row and inserts into `code_redemptions`, whose primary key is the code id. A second use breaks that key and fails, however close together the two attempts are. Tested with 20 parallel redemptions: exactly one wins. If the account was created but the code loses the race, the server deletes that account again.
- **Withdrawing** a code sets `revoked_at`. Every content policy goes through `has_course_access()`, which ignores withdrawn codes, so the student loses access on their next request. The admin can give them a new code later.
- **Codes per course:** with more than one course, the admin can create a code for one course or for all of them. A student can add more codes later at `/redeem`.
- **RLS everywhere:** clients can only *read*, and only their own data or courses they have access to. All writes go through server code with the service role, after a server-side check: redeeming, saving scores and tutor rate limiting. The functions that do these writes can only be executed by the service role.
- **Scores can't be faked:** answers are graded on the server (`lib/actions/exam.ts`), and the browser never receives an answer before the student has answered. The final score is re-graded on the server, and only a complete test is saved.
- **Magic links** use `shouldCreateUser: false`, so they can never create an account.

## The AI tutor

`POST /api/tutor` checks the session and course access, validates the chat history, and enforces the hourly limit with an atomic database function. It then streams the reply from the Anthropic API. The system prompt holds the course notes from the database and is marked for prompt caching, so repeat questions are cheaper. The chapter the student is viewing is added after the cached part. Long conversations are capped (`TUTOR_MAX_MESSAGES`), and the student is asked to start a new chat.

The tutor uses the `claude-opus-5-5` model at `low` effort, which suits chat well. Server-side refusal fallback is turned on, so if the model declines a request, the API retries it on a fallback model. Set `TUTOR_MODEL` to change the model. For example, `claude-haiku-5-5` costs much less per message.

## Content

- **Add a course:** create `content/<slug>/course.json` (see `content/pmb/course.json`; the `course` block sets slug, code, name and order) and `questions.json`, then run `npm run seed -- <slug>`.
- **Question format:** `{ "ch": 1, "type": "tf" | "mcq" | "gap", "q": "...", "why": "...", ...type fields }`
  - `tf`: `a` is a boolean
  - `mcq`: `o` is the list of options, `a` is the index of the correct one
  - `gap`: `____` in `q` marks the gap; `acc` lists the accepted answers (matched case-insensitively, ignoring punctuation)
- **Add a question type:** add a definition to `lib/questions/types.ts` (parse, public view, grading, answer text) and an input component to `components/questions/index.tsx`. Database and seeding need no changes.
- Summaries may use `<mark>`, `<b>` and `<i>`. Any other HTML is escaped.

## Book PDF (only with permission)

The book text is copyrighted and is not part of the site. If you get permission to share a PDF with your students, upload it under **Admin → Book files**. It goes into a private Storage bucket (`course-files`, created by the migration). Signed-in students with access to the course then see a link on the Book page, which serves the file through a signed URL that expires after 5 minutes. The file is never public. If uploads fail, raise the file size limit in Supabase Storage settings.

## Deploy (Vercel)

1. Push the repo to GitHub and import it in Vercel.
2. Add all variables from `.env.example` under Project → Settings → Environment Variables.
3. In Supabase Auth, set Site URL to the Vercel domain and add `https://<your-domain>/auth/callback` to Redirect URLs.
4. Deploy. After content changes, run `npm run seed` locally against the production keys. The seed reads `.env.local`, or variables set in your shell.

## Checks

```bash
npm run lint
npm run typecheck
npm test        # unit tests: codes, grading, tutor validation, HTML safety
npm run build
```
