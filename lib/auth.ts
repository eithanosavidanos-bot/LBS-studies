import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface Session {
  user: User;
  profile: Profile | null; // null: signed in but never redeemed a code
}

/** The signed-in user (verified with Supabase Auth), or null. Cached per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, role")
    .eq("id", data.user.id)
    .maybeSingle<Profile>();
  return { user: data.user, profile };
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin(): Promise<Session & { profile: Profile }> {
  const session = await requireSession();
  if (session.profile?.role !== "admin") redirect("/");
  return session as Session & { profile: Profile };
}

/** For server actions and route handlers: throws instead of redirecting. */
export async function assertAdmin(): Promise<Session & { profile: Profile }> {
  const session = await getSession();
  if (session?.profile?.role !== "admin") throw new Error("Not allowed");
  return session as Session & { profile: Profile };
}
