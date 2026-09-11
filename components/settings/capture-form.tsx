"use client";

import { useActionState, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { regenerateIngestToken, revokeIngestToken } from "@/lib/actions/conversations";
import { Button } from "@/components/ui";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/actions/shared";

/**
 * The device token for the browser extension.
 *
 * Shown exactly once, because only its hash is stored. That is the same reason
 * regenerating is offered as the revocation path: there is nothing to "view
 * again", so losing it and making a new one is the intended recovery.
 */
export function CaptureTokenForm({
  hint,
  createdAt,
  origin,
}: {
  hint: string | null;
  createdAt: Date | null;
  origin: string;
}) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    regenerateIngestToken,
    null,
  );
  const [copied, setCopied] = useState(false);
  const token = state?.ok ? state.id : null;

  return (
    <div className="px-4 py-3.5 grid gap-3">
      {token ? (
        <div className="rounded-[6px] border border-good/35 bg-good/[0.07] p-3 grid gap-2">
          <p className="text-[11.5px] text-good font-medium">
            Copy this now — it cannot be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 font-mono text-[11.5px] text-ink bg-canvas rounded-[4px] px-2 py-1.5 break-all">
              {token}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={() => {
                void navigator.clipboard?.writeText(token).then(() => setCopied(true));
              }}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}

      <dl className="grid gap-2">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[12px] text-ink-muted">Endpoint</dt>
          <dd className="font-mono text-[11.5px] text-ink-faint truncate">{origin}/api/ingest</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-[12px] text-ink-muted">Token</dt>
          <dd className="text-[11.5px] text-ink-faint">
            {hint ? (
              <span className="font-mono">{hint}…</span>
            ) : (
              <span className="text-ink-faint">none generated</span>
            )}
          </dd>
        </div>
        {createdAt ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-[12px] text-ink-muted">Created</dt>
            <dd className="num text-[11.5px] text-ink-faint">
              {createdAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="text-[11px] text-ink-faint leading-relaxed border-t border-line/70 pt-2.5">
        The extension sends this as a bearer token — never your password, and never a session
        cookie. Generating a new one immediately revokes every extension using the old one.
      </p>

      <div className="flex items-center gap-2">
        {state?.error ? (
          <span className="mr-auto text-[11.5px] text-bad">{state.error}</span>
        ) : null}
        {hint ? (
          <form action={revokeIngestToken} className="mr-auto">
            <ConfirmSubmit variant="ghost" size="xs" confirmLabel="Revoke it">
              Revoke
            </ConfirmSubmit>
          </form>
        ) : null}
        <form action={formAction}>
          <SubmitButton variant={hint ? "secondary" : "primary"} pendingLabel="Generating…">
            <KeyRound size={13} />
            {hint ? "Generate a new token" : "Generate token"}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
