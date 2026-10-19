// Creates the owner account (or promotes an existing user) without an invite code.
//
//   npm run create-admin -- --email you@example.com --password 'a-long-password' --name "Your Name"
//
// If the email already has an account, --password is optional and only the
// role is changed.
import { adminClient, arg } from "./_env";

const email = arg("email");
const password = arg("password");
const name = arg("name") ?? "Course owner";

async function findUserId(supabase: ReturnType<typeof adminClient>, target: string): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
}

async function main() {
  if (!email) {
    console.error("Usage: npm run create-admin -- --email you@example.com --password '...' --name \"Your Name\"");
    process.exit(1);
  }
  const supabase = adminClient();
  let userId = await findUserId(supabase, email);

  if (!userId) {
    if (!password || password.length < 10) {
      console.error("New account: pass --password with at least 10 characters.");
      process.exit(1);
    }
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
    console.log(`Created user ${email}`);
  }

  const { error } = await supabase.from("profiles").upsert({ id: userId, name, role: "admin" }, { onConflict: "id" });
  if (error) throw error;
  console.log(`✓ ${email} is now an admin. Sign in at /login.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
