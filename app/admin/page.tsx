import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { decryptCode } from "@/lib/invite-codes";
import { createAdminClient } from "@/lib/supabase/server";
import { CopyButton, NewCodeForm, PdfManager, WithdrawButton } from "@/components/admin/AdminControls";

export const metadata = { title: "Admin" };

interface CodeRow {
  id: string;
  label: string;
  code_ciphertext: string;
  course_id: string | null;
  created_at: string;
  revoked_at: string | null;
  code_redemptions: { user_id: string | null; redeemed_at: string } | { user_id: string | null; redeemed_at: string }[] | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminPage() {
  await requireAdmin();
  // Owner-only page: the service-role client is fine here because
  // requireAdmin() has checked the role on the server.
  const admin = createAdminClient();
  const secret = env.inviteCodeSecret();

  const [{ data: courses }, { data: codes }, { data: profiles }, { data: scores }, { data: chapterRows }, users] =
    await Promise.all([
      admin.from("courses").select("id, code, name, pdf_path").order("position"),
      admin
        .from("invite_codes")
        .select("id, label, code_ciphertext, course_id, created_at, revoked_at, code_redemptions(user_id, redeemed_at)")
        .order("created_at", { ascending: false }),
      admin.from("profiles").select("id, name, role, created_at"),
      admin.from("best_scores").select("user_id, course_id, test_key, best_pct, attempts, updated_at"),
      admin.from("chapters").select("course_id"),
      listAllUsers(admin),
    ]);

  const courseCode = new Map((courses ?? []).map((c) => [c.id, c.code]));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const emailById = new Map(users.map((u) => [u.id, u.email ?? ""]));
  const chaptersPerCourse = new Map<string, number>();
  for (const r of chapterRows ?? []) chaptersPerCourse.set(r.course_id, (chaptersPerCourse.get(r.course_id) ?? 0) + 1);

  const codeList = ((codes ?? []) as CodeRow[]).map((c) => {
    const red = Array.isArray(c.code_redemptions) ? c.code_redemptions[0] : c.code_redemptions;
    const holder = red?.user_id ? profileById.get(red.user_id) : undefined;
    return {
      ...c,
      plain: decryptCode(c.code_ciphertext, secret) ?? "(can't decrypt: secret changed?)",
      redeemed: Boolean(red),
      holderId: red?.user_id ?? null,
      holder: holder ? `${holder.name}${emailById.get(holder.id) ? ` · ${emailById.get(holder.id)}` : ""}` : red ? "Deleted account" : "",
    };
  });

  // Students: everyone who redeemed a code, with their access and progress.
  const students = (profiles ?? [])
    .filter((p) => p.role === "student")
    .map((p) => {
      const theirCodes = codeList.filter((c) => c.holderId === p.id);
      const active = theirCodes.some((c) => !c.revoked_at);
      const theirScores = (scores ?? []).filter((s) => s.user_id === p.id);
      const last = theirScores.reduce<string | null>((m, s) => (!m || s.updated_at > m ? s.updated_at : m), null);
      return { ...p, email: emailById.get(p.id) ?? "", active, scores: theirScores, last };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const statusOf = (c: (typeof codeList)[number]) =>
    c.revoked_at ? ["revoked", "Withdrawn"] : c.redeemed ? ["active", "In use"] : ["unused", "Not used yet"];

  return (
    <>
      <div className="eyebrow">Owner only</div>
      <h1 style={{ marginTop: 6 }}>Admin</h1>
      <p className="lede">
        Create one code per student and send it to them privately. A code works once: the first person to use it gets
        an account, and the code stops working for anyone else. Withdrawing a code locks that student out straight
        away.
      </p>

      <section className="sheet section-gap">
        <h3>Create a code</h3>
        <NewCodeForm courses={(courses ?? []).map((c) => ({ id: c.id, code: c.code }))} />
      </section>

      <section className="sheet section-gap">
        <h3>
          Access codes{" "}
          <span className="muted mono" style={{ fontWeight: 400, fontSize: 13 }}>
            ({codeList.length})
          </span>
        </h3>
        {codeList.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>For</th>
                  <th>Code</th>
                  {(courses?.length ?? 0) > 1 && <th>Course</th>}
                  <th>Status</th>
                  <th>Account</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {codeList.map((c) => {
                  const [kind, text] = statusOf(c);
                  return (
                    <tr key={c.id}>
                      <td>{c.label}</td>
                      <td className="code">{c.plain}</td>
                      {(courses?.length ?? 0) > 1 && <td>{c.course_id ? courseCode.get(c.course_id) : "All"}</td>}
                      <td>
                        <span className={`pill ${kind}`}>{text}</span>
                      </td>
                      <td>{c.holder}</td>
                      <td className="muted">{fmtDate(c.created_at)}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {!c.revoked_at && (
                          <>
                            {!c.redeemed && <CopyButton value={c.plain} />} <WithdrawButton id={c.id} label={c.label} />
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No codes yet. Create the first one above, for example for yourself to test the sign-up.</p>
        )}
      </section>

      <section className="sheet section-gap">
        <h3>
          Students{" "}
          <span className="muted mono" style={{ fontWeight: 400, fontSize: 13 }}>
            ({students.length})
          </span>
        </h3>
        {students.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Access</th>
                  <th>Progress (best scores)</th>
                  <th>Last test</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      <br />
                      <span className="muted" style={{ fontSize: 13 }}>
                        {s.email}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${s.active ? "active" : "revoked"}`}>{s.active ? "Active" : "No access"}</span>
                    </td>
                    <td>
                      {(courses ?? []).map((course) => {
                        const mine = s.scores.filter((x) => x.course_id === course.id);
                        if (!mine.length) return null;
                        const chapters = mine.filter((x) => x.test_key.startsWith("ch")).length;
                        const mock = mine.find((x) => x.test_key === "mock");
                        return (
                          <div key={course.id} style={{ marginBottom: 4 }}>
                            <span className="muted" style={{ fontSize: 13 }}>
                              {course.code}: {chapters}/{chaptersPerCourse.get(course.id) ?? 0} chapters
                              {mock ? ` · mock best ${mock.best_pct}%` : ""}
                            </span>
                            <div className="scorecells">
                              {mine
                                .filter((x) => x.test_key.startsWith("ch"))
                                .sort((a, b) => Number(a.test_key.slice(2)) - Number(b.test_key.slice(2)))
                                .map((x) => (
                                  <span key={x.test_key} title={`${x.attempts} attempt(s)`}>
                                    {x.test_key.slice(2)}: {x.best_pct}%
                                  </span>
                                ))}
                            </div>
                          </div>
                        );
                      })}
                      {s.scores.length === 0 && <span className="muted">No tests yet</span>}
                    </td>
                    <td className="muted">{s.last ? fmtDate(s.last) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No students yet.</p>
        )}
      </section>

      <section className="sheet section-gap">
        <h3>Book files</h3>
        <p className="muted" style={{ margin: "6px 0 0", fontFamily: "var(--body)" }}>
          Only attach a copy of the book if you have the publisher&apos;s permission to share it with your students. The
          file is stored privately: only signed-in students with access to the course can open it, through a link that
          expires after five minutes.
        </p>
        {(courses ?? []).map((c) => (
          <div key={c.id} style={{ marginTop: 14 }}>
            <b>{c.code}</b> <span className="muted">· {c.pdf_path ? "PDF attached" : "No PDF"}</span>
            <PdfManager courseId={c.id} hasPdf={Boolean(c.pdf_path)} />
          </div>
        ))}
      </section>
    </>
  );
}

async function listAllUsers(admin: ReturnType<typeof createAdminClient>) {
  const all: { id: string; email?: string }[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    all.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return all;
}
