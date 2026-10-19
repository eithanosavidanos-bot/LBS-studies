import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { Landing } from "@/components/Landing";
import { SignUpForm } from "@/components/AuthForms";

export const metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await getSession()) redirect("/");
  return (
    <div className="gate">
      <Landing />
      <SignUpForm codeExample={`${env.inviteCodePrefix()}-XXXX-XXXX`} />
    </div>
  );
}
