import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Landing } from "@/components/Landing";
import { SignInForm } from "@/components/AuthForms";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (await getSession()) redirect("/");
  const sp = await searchParams;
  const notice =
    sp.link === "expired" ? "That sign-in link has expired or was already used. Request a new one." :
    sp.created ? "Your account is ready. Sign in to continue." : undefined;
  return (
    <div className="gate">
      <Landing />
      <SignInForm next={sp.next ?? "/"} notice={notice} />
    </div>
  );
}
