# PMB Study Room

The original brief is in `docs/brief.md` and the design source is `docs/prototype.html`. The README covers setup and the security model.

@AGENTS.md

Rules to keep:
- Never put copyrighted book text in the repo or the site. Summaries and questions are original study notes.
- Every access check happens on the server or in RLS. Client tables are read-only. Writes use the service-role client, and only after `requireAdmin` / `assertAdmin` / a course access check.
- Answers must not reach the browser before the student answers (`toPublic` in `lib/questions/types.ts`).
- Keep everything course-agnostic: no hard-coded "pmb" outside `content/` and copy.
- Next.js 16 with Cache Components: per-user data sits inside `<Suspense>` (see `app/layout.tsx`). `createClient()` calls `connection()`.
- Run `npm run lint && npm run typecheck && npm test && npm run build` before committing.
