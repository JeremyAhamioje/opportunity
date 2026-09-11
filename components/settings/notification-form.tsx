"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Mail, Send } from "lucide-react";
import { sendDigestNow, updateNotifications } from "@/lib/actions/notifications";
import { Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/actions/shared";
import type { Settings } from "@/lib/db/schema";

/**
 * Two forms, kept separate on purpose: saving preferences must never send mail,
 * and sending a test must never quietly persist a half-filled form.
 */
export function NotificationForm({
  config,
  accountEmail,
  configured,
  sharedSender,
}: {
  config: Settings;
  accountEmail: string;
  /** RESEND_API_KEY is present. Without it the controls are shown but disabled. */
  configured: boolean;
  /** Still on onboarding@resend.dev, which can only reach the Resend account owner. */
  sharedSender: boolean;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateNotifications,
    null,
  );
  const [enabled, setEnabled] = useState(config.notifyEnabled);

  return (
    <div>
      <form action={formAction}>
        <div className="px-4 py-3.5 flex flex-col gap-3.5">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="notifyEnabled"
              checked={enabled}
              disabled={!configured}
              onChange={(event) => setEnabled(event.target.checked)}
              className="size-[15px] mt-px accent-[var(--color-accent)] disabled:opacity-40"
            />
            <span className="min-w-0">
              <span className="block text-[12.5px]">Email me a daily digest</span>
              <span className="block text-[11.5px] text-ink-faint leading-snug mt-0.5">
                Overdue follow-ups, anything due today, deadlines inside a week, and builds
                waiting on you — with the same &ldquo;do this next&rdquo; the dashboard shows.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              name="notifyOnlyWhenDue"
              defaultChecked={config.notifyOnlyWhenDue}
              disabled={!configured}
              className="size-[15px] mt-px accent-[var(--color-accent)] disabled:opacity-40"
            />
            <span className="min-w-0">
              <span className="block text-[12.5px]">Stay quiet on empty days</span>
              <span className="block text-[11.5px] text-ink-faint leading-snug mt-0.5">
                A mail that arrives every morning saying &ldquo;nothing to do&rdquo; is one you
                stop opening — and then you miss the one that mattered.
              </span>
            </span>
          </label>

          <Field
            label="Send to"
            htmlFor="notifyEmail"
            hint={`Leave empty to use your account address (${accountEmail}).`}
          >
            <Input
              id="notifyEmail"
              name="notifyEmail"
              type="email"
              disabled={!configured}
              defaultValue={config.notifyEmail ?? ""}
              placeholder={accountEmail}
            />
          </Field>
        </div>

        <div className="px-4 py-2.5 border-t border-line flex items-center justify-end gap-2 bg-canvas/40">
          {state?.error ? (
            <span className="mr-auto text-[11.5px] text-bad">{state.error}</span>
          ) : state?.ok ? (
            <span className="mr-auto text-[11.5px] text-good">Saved.</span>
          ) : null}
          <SubmitButton disabled={!configured}>Save</SubmitButton>
        </div>
      </form>

      <SendNow configured={configured} />

      <div className="px-4 py-3 border-t border-line flex flex-col gap-2">
        {!configured ? (
          <p className="flex items-start gap-2 text-[11.5px] text-ink-faint leading-relaxed">
            <AlertCircle size={13} className="mt-px shrink-0" />
            <span>
              <code className="text-ink-muted">RESEND_API_KEY</code> is not set. Every reminder
              still works inside the app — this only carries them out of the building.
            </span>
          </p>
        ) : null}

        {configured && sharedSender ? (
          <p className="flex items-start gap-2 text-[11.5px] text-duesoon leading-relaxed">
            <AlertCircle size={13} className="mt-px shrink-0" />
            <span>
              Sending from Resend&apos;s shared address, which can only deliver to the address
              that owns the Resend account. Verify a domain and set{" "}
              <code className="text-ink-muted">EMAIL_FROM</code> to send anywhere else.
            </span>
          </p>
        ) : null}

        {config.lastDigestError ? (
          <p className="flex items-start gap-2 text-[11.5px] text-bad leading-relaxed">
            <AlertCircle size={13} className="mt-px shrink-0" />
            <span>Last attempt failed: {config.lastDigestError}</span>
          </p>
        ) : config.lastDigestSentAt ? (
          <p className="flex items-center gap-2 text-[11.5px] text-ink-faint">
            <Mail size={12} className="shrink-0" />
            Last digest sent {config.lastDigestSentAt}.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SendNow({ configured }: { configured: boolean }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(sendDigestNow, null);

  return (
    <form
      action={formAction}
      className="px-4 py-2.5 border-t border-line flex items-center gap-2"
    >
      <span className="text-[11.5px] text-ink-faint flex-1 leading-snug">
        Sends today&apos;s real digest now — not a sample — whether or not anything is due.
      </span>
      {state?.error ? (
        <span className="text-[11.5px] text-bad max-w-[300px] leading-snug">{state.error}</span>
      ) : state?.ok ? (
        <span className="text-[11.5px] text-good">{state.id}</span>
      ) : null}
      <SubmitButton variant="secondary" disabled={!configured} pendingLabel="Sending…">
        <Send size={12} /> Send now
      </SubmitButton>
    </form>
  );
}
