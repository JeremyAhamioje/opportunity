import { redirect } from "next/navigation";
import { countUsers } from "@/lib/auth/guard";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // A fresh install has no owner yet — send the first visitor to setup.
  if ((await countUsers()) === 0) redirect("/setup");

  return (
    <AuthShell
      title="Sign in"
      subtitle="Pick up where you left off. Follow-ups are waiting."
    >
      <AuthForm mode="login" />
    </AuthShell>
  );
}
