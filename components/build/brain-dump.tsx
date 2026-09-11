"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Sparkles, Wand2 } from "lucide-react";
import { createBuild, structureDump, type StructureResult } from "@/lib/actions/builds";
import { Button, Field, Input, Panel, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/actions/shared";

/**
 * Capture in two steps: dump, then review.
 *
 * The dump box asks for nothing — no title, no category, no fields — because
 * anything it asked for is a reason to not write the idea down at all. Gemini
 * does the structuring afterwards, and its output lands in an editable form
 * rather than the database, so a bad reading costs one correction instead of a
 * wrong row you discover a month later.
 *
 * With no key, or with Gemini down, the review step still opens with the title
 * guessed from the first line and the dump preserved verbatim. The idea is
 * never the thing that gets lost.
 */
export function BrainDump({ aiEnabled }: { aiEnabled: boolean }) {
  const [structured, formAction] = useActionState<StructureResult | null, FormData>(
    structureDump,
    null,
  );
  // "Start over" dismisses the result object itself rather than resetting the
  // action; the next submission produces a new object, so review reopens.
  const [dismissed, setDismissed] = useState<StructureResult | null>(null);

  if (structured?.ok && structured.draft && structured !== dismissed) {
    return (
      <ReviewForm
        draft={structured.draft}
        dump={structured.dump ?? ""}
        onBack={() => setDismissed(structured)}
      />
    );
  }

  return (
    <Panel>
      <form action={formAction} className="p-4">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <label htmlFor="brainDump" className="text-[13px] font-semibold">
            Dump the idea
          </label>
          <span className="text-[11px] text-ink-faint">
            {aiEnabled ? "Messy is fine — Gemini structures it" : "Messy is fine"}
          </span>
        </div>

        <Textarea
          id="brainDump"
          name="brainDump"
          rows={6}
          required
          autoFocus
          placeholder={PLACEHOLDER}
          className="text-[13px] leading-relaxed"
        />

        {structured?.error ? (
          <p className="flex items-start gap-2 text-[12px] text-bad mt-2">
            <AlertCircle size={13} className="mt-px shrink-0" />
            {structured.error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 mt-3">
          <SubmitButton pendingLabel={aiEnabled ? "Reading it…" : "Capturing…"}>
            {aiEnabled ? (
              <>
                <Wand2 size={13} /> Structure it
              </>
            ) : (
              "Capture it"
            )}
          </SubmitButton>
        </div>
      </form>
    </Panel>
  );
}

const PLACEHOLDER = `just had an idea — turn the CRM into an actual product. opportunity.co. sourcing would run off the anthropic api instead of me pasting research in by hand, and what kind of lead you get is decided by whatever we learn during onboarding. needs multi-tenant + real postgres first...`;

function ReviewForm({
  draft,
  dump,
  onBack,
}: {
  draft: NonNullable<StructureResult["draft"]>;
  dump: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<ActionResult | null>(null);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createBuild, null);

  if (state !== saved) setSaved(state);

  useEffect(() => {
    if (state?.ok && state.id) router.push(`/opportunities/${state.id}`);
  }, [state, router]);

  return (
    <Panel>
      <form action={formAction} className="p-4 grid gap-3.5">
        <input type="hidden" name="brainDump" value={dump} />

        <div className="flex items-center gap-2 text-[11.5px] text-ink-faint">
          {draft.source === "gemini" ? (
            <>
              <Sparkles size={13} className="text-cat-build shrink-0" />
              <span>Structured by Gemini — correct anything it got wrong.</span>
            </>
          ) : (
            <>
              <AlertCircle size={13} className="text-duesoon shrink-0" />
              <span>
                {draft.error
                  ? `Saved without structuring: ${draft.error}`
                  : "Gemini is not configured, so this is unstructured — fill in what matters."}
              </span>
            </>
          )}
        </div>

        <Field label="Build" htmlFor="title" required>
          <Input id="title" name="title" defaultValue={draft.title} required autoFocus />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="What problem it solves" htmlFor="problemObserved">
            <Textarea
              id="problemObserved"
              name="problemObserved"
              rows={2}
              defaultValue={draft.problem ?? ""}
            />
          </Field>
          <Field label="What gets built" htmlFor="proposedSolution">
            <Textarea
              id="proposedSolution"
              name="proposedSolution"
              rows={2}
              defaultValue={draft.solution ?? ""}
            />
          </Field>
        </div>

        <Field
          label="What it proves"
          htmlFor="whatItProves"
          hint="The application it supports, or the skill it demonstrates."
        >
          <Input id="whatItProves" name="whatItProves" defaultValue={draft.whatItProves ?? ""} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="First step"
            htmlFor="firstStep"
            hint="Small and physical. This is what restarts it when it stalls."
          >
            <Input id="firstStep" name="firstStep" defaultValue={draft.firstStep ?? ""} />
          </Field>
          <Field label="Scope" htmlFor="scopeEstimate">
            <Input
              id="scopeEstimate"
              name="scopeEstimate"
              placeholder="A weekend"
              defaultValue={draft.scopeEstimate ?? ""}
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Stack" htmlFor="skills" hint="Comma separated.">
            <Input id="skills" name="skills" defaultValue={draft.stack.join(", ")} />
          </Field>
          <Field
            label="Remind me in"
            htmlFor="checkInDays"
            hint="Days until this comes back to the follow-up desk."
          >
            <Input
              id="checkInDays"
              name="checkInDays"
              type="number"
              min={0}
              max={365}
              defaultValue={7}
            />
          </Field>
        </div>

        {draft.openQuestions.length ? (
          <div>
            <p className="text-[11.5px] text-ink-muted mb-1.5">
              Open questions Gemini spotted — kept as notes, not answers:
            </p>
            <Textarea
              name="notes"
              rows={draft.openQuestions.length + 1}
              defaultValue={draft.openQuestions.map((question) => `- ${question}`).join("\n")}
              className="text-[12px]"
            />
          </div>
        ) : (
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>
        )}

        <details className="text-[11.5px]">
          <summary className="cursor-pointer text-ink-faint hover:text-ink-muted">
            Original dump — stored with the build, exactly as typed
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-ink-muted bg-canvas border border-line rounded-md p-2.5 leading-relaxed">
            {dump}
          </p>
        </details>

        {state?.error ? (
          <p className="flex items-start gap-2 text-[12px] text-bad">
            <AlertCircle size={13} className="mt-px shrink-0" />
            {state.error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft size={13} /> Start over
          </Button>
          <SubmitButton pendingLabel="Saving…">Save build</SubmitButton>
        </div>
      </form>
    </Panel>
  );
}
