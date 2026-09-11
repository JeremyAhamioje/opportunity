"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { setupAccount, signIn } from "@/lib/actions/auth";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/actions/shared";

export function AuthForm({ mode }: { mode: "login" | "setup" }) {
  const action = mode === "setup" ? setupAccount : signIn;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      {mode === "setup" ? (
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" placeholder="Jeremy" data-autofocus />
        </Field>
      ) : null}

      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          data-autofocus={mode === "login" ? true : undefined}
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        hint={mode === "setup" ? "At least 10 characters, with a number or symbol." : undefined}
      >
        <Input
          id="password"
          name="password"
          type="password"
          required
          autoComplete={mode === "setup" ? "new-password" : "current-password"}
        />
      </Field>

      {mode === "setup" ? (
        <Field label="Confirm password" htmlFor="confirm" required>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
          />
        </Field>
      ) : null}

      {state?.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-[12px] text-bad bg-[#2a1319] border border-[#4a2029] rounded-md px-2.5 py-2"
        >
          <AlertCircle size={13} className="mt-px shrink-0" />
          {state.error}
        </p>
      ) : null}

      <SubmitButton
        size="md"
        className="w-full mt-1"
        pendingLabel={mode === "setup" ? "Creating…" : "Signing in…"}
      >
        {mode === "setup" ? "Create account" : "Sign in"}
      </SubmitButton>
    </form>
  );
}
