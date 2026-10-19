import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

function intFrom(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  inviteCodeSecret: () => required("INVITE_CODE_SECRET"),
  inviteCodePrefix: () => (process.env.INVITE_CODE_PREFIX || "PMB").toUpperCase(),
  anthropicApiKey: () => required("ANTHROPIC_API_KEY"),
  anthropicBaseUrl: () => process.env.ANTHROPIC_BASE_URL || undefined,
  tutorModel: () => process.env.TUTOR_MODEL || "claude-opus-5-5",
  tutorMessagesPerHour: () => intFrom("TUTOR_MESSAGES_PER_HOUR", 30),
  tutorMaxMessages: () => intFrom("TUTOR_MAX_MESSAGES", 24),
  tutorMaxChars: () => intFrom("TUTOR_MAX_CHARS", 4000),
};
