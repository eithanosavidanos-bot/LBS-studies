"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth";
import { hashCode, isWellFormed } from "@/lib/invite-codes";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  info?: string;
}

const CODE_ERRORS: Record<string, string> = {
  invalid_code: "That code isn't valid. Check for typos, or ask the course owner for a new one.",
  code_used: "That code has already been used. Each code works for one person only.",
  code_revoked: "That code has been withdrawn. Ask the course owner for a new one.",
};

function codeErrorFrom(message: string | undefined): string {
  const key = Object.keys(CODE_ERRORS).find((k) => message?.includes(k));
  return key ? CODE_ERRORS[key] : "Something went wrong while checking the code. Try again in a moment.";
}

function safeNext(next: FormDataEntryValue | null): string {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") ? n : "/";
}

/** Quick lookup so obviously bad codes fail before an account is created. */
async function precheckCode(code: string): Promise<string | null> {
  const prefix = env.inviteCodePrefix();
  if (!isWellFormed(code, prefix)) return `Enter the full code, for example ${prefix}-7KQ2-XM4D.`;
  const admin = createAdminClient();
  const { data } = await admin
    .from("invite_codes")
    .select("id, revoked_at, code_redemptions(code_id)")
    .eq("code_hash", hashCode(code, env.inviteCodeSecret()))
    .maybeSingle();
  if (!data) return CODE_ERRORS.invalid_code;
  if (data.revoked_at) return CODE_ERRORS.code_revoked;
  const redeemed = Array.isArray(data.code_redemptions) ? data.code_redemptions.length > 0 : Boolean(data.code_redemptions);
  if (redeemed) return CODE_ERRORS.code_used;
  return null;
}

export async function signUp(_prev: FormState, form: FormData): Promise<FormState> {
  const code = String(form.get("code") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!name) return { error: "Enter your name so the course owner knows who you are." };
  if (name.length > 80) return { error: "That name is too long." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address." };
  if (password.length < 10) return { error: "Choose a password of at least 10 characters." };

  const codeProblem = await precheckCode(code);
  if (codeProblem) return { error: codeProblem };

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (created.error || !created.data.user) {
    const exists = created.error?.code === "email_exists" || /already/i.test(created.error?.message ?? "");
    return {
      error: exists
        ? "An account with this email already exists. Sign in, then add your code on the next screen."
        : "We couldn't create your account. Try again in a moment.",
    };
  }
  const userId = created.data.user.id;

  // The database binds the code to this user in one transaction. If two people
  // race with the same code, exactly one wins; the loser's account is removed.
  const { error: redeemError } = await admin.rpc("redeem_invite_code", {
    p_code_hash: hashCode(code, env.inviteCodeSecret()),
    p_user_id: userId,
    p_name: name,
  });
  if (redeemError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: codeErrorFrom(redeemError.message) };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) redirect("/login?created=1");
  redirect("/");
}

/** For a signed-in user without access (new code after a withdrawal, or a second course). */
export async function redeemCode(_prev: FormState, form: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const code = String(form.get("code") ?? "");
  const name = String(form.get("name") ?? session.profile?.name ?? "").trim();
  if (!name) return { error: "Enter your name so the course owner knows who you are." };

  const codeProblem = await precheckCode(code);
  if (codeProblem) return { error: codeProblem };

  const { error } = await createAdminClient().rpc("redeem_invite_code", {
    p_code_hash: hashCode(code, env.inviteCodeSecret()),
    p_user_id: session.user.id,
    p_name: name.slice(0, 80),
  });
  if (error) return { error: codeErrorFrom(error.message) };
  redirect("/");
}

export async function signIn(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Wrong email or password." };
  redirect(safeNext(form.get("next")));
}

export async function sendMagicLink(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter your email address first." };
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  // shouldCreateUser: false, so a magic link can never create an account
  // without an invite code.
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(form.get("next")))}` },
  });
  // Same answer whether or not the account exists.
  return { info: "If an account exists for that email, a sign-in link is on its way." };
}
