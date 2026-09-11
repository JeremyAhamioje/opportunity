import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";

/**
 * Open registration. Anyone can create an account, and it starts empty —
 * every table is keyed on `user_id` and every query, page and server action is
 * scoped to the signed-in user, so a new account inherits nothing.
 */
export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Your own pipeline, empty and private. Nothing is shared with other accounts."
      footer={
        <>
          Already have one?{" "}
          <Link href="/login" className="text-accent hover:text-accent-hot hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <AuthForm mode="setup" />
    </AuthShell>
  );
}
