"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Rocket } from "lucide-react";
import { promoteInsight, updateInsight } from "@/lib/actions/insights";
import {
  INSIGHT_KINDS,
  INSIGHT_KIND_META,
  STANCES,
  STANCE_META,
} from "@/lib/domain/archaeology";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { Modal, SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/actions/shared";
import type { Insight } from "@/lib/db/schema";

function Status({ state }: { state: ActionResult | null }) {
  if (state?.error) {
    return (
      <span className="mr-auto flex items-center gap-1.5 text-[11.5px] text-bad">
        <AlertCircle size={12} /> {state.error}
      </span>
    );
  }
  if (state?.ok) return <span className="mr-auto text-[11.5px] text-good">Saved.</span>;
  return null;
}

/**
 * The model proposes; this form is where the user takes ownership. Saving sets
 * `edited`, after which re-extraction will never overwrite these fields again.
 */
export function EditInsightForm({ insight }: { insight: Insight }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateInsight, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={insight.id} />

      <div className="px-4 py-3.5 grid gap-3">
        <Field label="Title" htmlFor="title" required>
          <Input id="title" name="title" defaultValue={insight.title} required />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Kind" htmlFor="kind">
            <Select id="kind" name="kind" defaultValue={insight.kind}>
              {INSIGHT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {INSIGHT_KIND_META[kind].icon} {INSIGHT_KIND_META[kind].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Stance"
            htmlFor="stance"
            hint="How firmly you actually said it — not how confident the extractor was."
          >
            <Select id="stance" name="stance" defaultValue={insight.stance}>
              {STANCES.map((stance) => (
                <option key={stance} value={stance}>
                  {STANCE_META[stance].label} — {STANCE_META[stance].hint}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Summary" htmlFor="summary">
          <Textarea id="summary" name="summary" rows={2} defaultValue={insight.summary ?? ""} />
        </Field>

        <Field label="Detail" htmlFor="detail">
          <Textarea id="detail" name="detail" rows={4} defaultValue={insight.detail ?? ""} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label="Said it would happen"
            htmlFor="dueDate"
            hint="Commitments only."
          >
            <Input id="dueDate" name="dueDate" type="date" defaultValue={insight.dueDate ?? ""} />
          </Field>
        </div>

        <Field label="Your notes" htmlFor="notes" hint="Never touched by extraction.">
          <Textarea id="notes" name="notes" rows={2} defaultValue={insight.notes ?? ""} />
        </Field>
      </div>

      <div className="px-4 py-2.5 border-t border-line flex items-center justify-end gap-2 bg-canvas/40">
        <Status state={state} />
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Promotion is the one bridge from a recovered thought into the pipeline. It
 * asks the few questions that turn an idea into something startable, then hands
 * off to the existing build machinery.
 */
export function PromoteButton({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false);

  if (insight.opportunityId) return null;

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Rocket size={13} />
        Turn into a build
      </Button>
      {open ? <PromoteModal insight={insight} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PromoteModal({ insight, onClose }: { insight: Insight; onClose: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState<ActionResult | null, FormData>(promoteInsight, null);

  useEffect(() => {
    if (state?.ok && state.id) {
      onClose();
      router.push(`/opportunities/${state.id}`);
    }
  }, [state, onClose, router]);

  return (
    <Modal
      open
      onClose={onClose}
      width="md"
      title="Turn this into a build"
      description="It joins the pipeline as a build, and the evidence comes with it."
    >
      <form action={formAction} className="contents">
        <input type="hidden" name="id" value={insight.id} />

        <div className="p-4 grid gap-3.5 max-h-[62vh] overflow-y-auto">
          <Field label="What are you building?" htmlFor="promote-title" required>
            <Input
              id="promote-title"
              name="title"
              defaultValue={insight.title}
              required
              data-autofocus
            />
          </Field>

          <Field
            label="What does shipping it prove?"
            htmlFor="whatItProves"
            hint="The reason it is worth the weekend."
          >
            <Textarea
              id="whatItProves"
              name="whatItProves"
              rows={2}
              placeholder="That I can ship a working ingestion pipeline end to end."
            />
          </Field>

          <Field
            label="First step"
            htmlFor="firstStep"
            hint="One concrete move, so a stalled build has an obvious restart."
          >
            <Input id="firstStep" name="firstStep" placeholder="Sketch the schema" />
          </Field>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Scope" htmlFor="scopeEstimate">
              <Input id="scopeEstimate" name="scopeEstimate" placeholder="A weekend" />
            </Field>
            <Field label="Target date" htmlFor="deadline">
              <Input id="deadline" name="deadline" type="date" />
            </Field>
          </div>

          {state?.error ? (
            <p className="flex items-start gap-2 text-[12px] text-bad">
              <AlertCircle size={13} className="mt-px shrink-0" />
              {state.error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-line bg-canvas/40">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <SubmitButton pendingLabel="Promoting…">Create the build</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
