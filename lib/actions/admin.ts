"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { encryptCode, generateCode, hashCode } from "@/lib/invite-codes";
import { createAdminClient } from "@/lib/supabase/server";

export interface CreateCodeState {
  code?: string;
  label?: string;
  error?: string;
}

/** Creates one invite code. The plain code is returned once for display. */
export async function createInviteCode(_prev: CreateCodeState, form: FormData): Promise<CreateCodeState> {
  const session = await assertAdmin();
  const label = String(form.get("label") ?? "").trim().slice(0, 80) || "Unnamed student";
  const courseId = String(form.get("course") ?? "") || null;
  const secret = env.inviteCodeSecret();
  const admin = createAdminClient();

  // A clash of 40-bit random codes is very unlikely, but retry just in case.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode(env.inviteCodePrefix());
    const { error } = await admin.from("invite_codes").insert({
      code_hash: hashCode(code, secret),
      code_ciphertext: encryptCode(code, secret),
      label,
      course_id: courseId,
      created_by: session.user.id,
    });
    if (!error) {
      revalidatePath("/admin");
      return { code, label };
    }
    if (error.code !== "23505") return { error: "The code couldn't be saved. Try again." };
  }
  return { error: "The code couldn't be saved. Try again." };
}

/** Withdraws a code. The student who used it loses access immediately (RLS checks revoked_at). */
export async function revokeInviteCode(id: string): Promise<{ error?: string }> {
  await assertAdmin();
  const { error } = await createAdminClient()
    .from("invite_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("revoked_at", null);
  if (error) return { error: "Couldn't withdraw that code. Try again." };
  revalidatePath("/admin");
  return {};
}

// --- Book PDF hook ----------------------------------------------------------
// Only for owners who have permission to share the book with their students.
// The browser uploads straight to the private bucket with a one-time signed
// upload URL, so large files don't pass through the server.

const BUCKET = "course-files";

export async function createPdfUpload(courseId: string): Promise<{ path?: string; token?: string; error?: string }> {
  await assertAdmin();
  const path = `${courseId}/book-${Date.now()}.pdf`;
  const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "Couldn't start the upload. Check that the course-files bucket exists." };
  return { path: data.path, token: data.token };
}

export async function attachCoursePdf(courseId: string, path: string): Promise<{ error?: string }> {
  await assertAdmin();
  if (!path.startsWith(`${courseId}/`) || !path.endsWith(".pdf")) return { error: "Invalid file." };
  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("pdf_path").eq("id", courseId).single();
  const { error } = await admin.from("courses").update({ pdf_path: path }).eq("id", courseId);
  if (error) return { error: "Couldn't attach the file." };
  if (course?.pdf_path && course.pdf_path !== path) await admin.storage.from(BUCKET).remove([course.pdf_path]);
  revalidatePath("/admin");
  return {};
}

export async function removeCoursePdf(courseId: string): Promise<{ error?: string }> {
  await assertAdmin();
  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("pdf_path").eq("id", courseId).single();
  const { error } = await admin.from("courses").update({ pdf_path: null }).eq("id", courseId);
  if (error) return { error: "Couldn't remove the file." };
  if (course?.pdf_path) await admin.storage.from(BUCKET).remove([course.pdf_path]);
  revalidatePath("/admin");
  return {};
}
