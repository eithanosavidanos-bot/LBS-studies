import { requireSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { RedeemForm } from "@/components/AuthForms";

export const metadata = { title: "Access code" };

export default async function RedeemPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const session = await requireSession();
  const { reason } = await searchParams;
  const text =
    reason === "withdrawn"
      ? "Your access code has been withdrawn, so the course is locked. Ask the course owner for a new code."
      : reason === "course"
        ? "Your account doesn't include this course yet. Enter the code the course owner gave you for it."
        : "Enter the personal code the course owner gave you to unlock your courses.";
  return (
    <div className="authwrap">
      <RedeemForm name={session.profile?.name ?? null} reason={text} codeExample={`${env.inviteCodePrefix()}-XXXX-XXXX`} />
    </div>
  );
}
