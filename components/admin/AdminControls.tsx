"use client";

import { useActionState, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  attachCoursePdf,
  createInviteCode,
  createPdfUpload,
  removeCoursePdf,
  revokeInviteCode,
} from "@/lib/actions/admin";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn small"
      onClick={() =>
        navigator.clipboard.writeText(value).then(
          () => setCopied(true),
          () => setCopied(false),
        )
      }
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function NewCodeForm({ courses }: { courses: { id: string; code: string }[] }) {
  const [state, action, pending] = useActionState(createInviteCode, {});
  return (
    <>
      <form className="admin-new" action={action}>
        <input name="label" placeholder="Student's name (for your list)" aria-label="Student's name" maxLength={80} />
        {courses.length > 1 && (
          <select name="course" aria-label="Course access">
            <option value="">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} only
              </option>
            ))}
          </select>
        )}
        <button className="btn primary" disabled={pending}>
          {pending ? "Creating…" : "Create code"}
        </button>
      </form>
      {state.code && (
        <div className="newcode">
          <span className="c">{state.code}</span>
          <CopyButton value={state.code} />
          <span className="muted" style={{ fontSize: 13 }}>
            For {state.label}. Send it to them privately. It&apos;s also in the list below.
          </span>
        </div>
      )}
      {state.error && (
        <div className="msg err" style={{ marginTop: 12 }}>
          {state.error}
        </div>
      )}
    </>
  );
}

export function WithdrawButton({ id, label }: { id: string; label: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        className="btn small"
        disabled={pending}
        onClick={() => {
          if (!confirming) return setConfirming(true);
          start(async () => {
            const res = await revokeInviteCode(id);
            if (res.error) setError(res.error);
          });
        }}
        aria-label={confirming ? `Confirm withdrawing the code for ${label}` : `Withdraw the code for ${label}`}
      >
        {pending ? "Withdrawing…" : confirming ? "Confirm withdraw" : "Withdraw"}
      </button>
      {error && <span className="msg err">{error}</span>}
    </>
  );
}

export function PdfManager({ courseId, hasPdf }: { courseId: string; hasPdf: boolean }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function upload(file: File) {
    if (file.type !== "application/pdf") return setMessage("Choose a PDF file.");
    start(async () => {
      setMessage("Uploading…");
      const ticket = await createPdfUpload(courseId);
      if (!ticket.path || !ticket.token) return setMessage(ticket.error ?? "Upload failed.");
      const { error } = await createClient()
        .storage.from("course-files")
        .uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: "application/pdf" });
      if (error) return setMessage("Upload failed. Check the file size limit in Supabase Storage.");
      const res = await attachCoursePdf(courseId, ticket.path);
      setMessage(res.error ?? "PDF attached. Enrolled students now see a link on the Book page.");
    });
  }

  return (
    <div className="row" style={{ marginTop: 10 }}>
      <label className="btn small" style={{ cursor: pending ? "wait" : "pointer" }}>
        {hasPdf ? "Replace PDF" : "Upload PDF"}
        <input
          type="file"
          accept="application/pdf"
          className="sr-only"
          disabled={pending}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
      </label>
      {hasPdf && (
        <button
          className="btn small"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await removeCoursePdf(courseId);
              setMessage(res.error ?? "PDF removed.");
            })
          }
        >
          Remove PDF
        </button>
      )}
      {message && <span className="muted" style={{ fontSize: 13 }}>{message}</span>}
    </div>
  );
}
