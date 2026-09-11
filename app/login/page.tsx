import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Pick up where you left off. Follow-ups are waiting."
      footer={
        <>
          No account yet?{" "}
          <Link href="/setup" className="text-accent hover:text-accent-hot hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
