import { redirect } from "next/navigation";
import { countUsers } from "@/lib/auth/guard";
import { databaseLabel } from "@/lib/db";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await countUsers()) > 0) redirect("/login");

  return (
    <AuthShell
      title="Claim this instance"
      subtitle="One account owns this command center. Create it now — nobody else can claim it afterwards."
      footer={<>Storage: {databaseLabel()}. Your data never leaves this machine unless you point it at a hosted database.</>}
    >
      <AuthForm mode="setup" />
    </AuthShell>
  );
}
