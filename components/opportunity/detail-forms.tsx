"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { RefObject } from "react";
import { addResponse } from "@/lib/actions/opportunities";
import { createAction } from "@/lib/actions/tasks";
import { addContact } from "@/lib/actions/companies";
import { ACTION_TYPES, ACTION_TYPE_META, SENTIMENTS, SENTIMENT_META } from "@/lib/domain/types";
import { addDays, today } from "@/lib/domain/dates";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/actions/shared";

/**
 * Collapses the form and clears it once a save succeeds. The state comparison
 * happens during render (no cascading pass) and the DOM reset in an effect,
 * which is the half that genuinely touches an external system.
 */
function useCloseOnSuccess(
  state: ActionResult | null,
  formRef: RefObject<HTMLFormElement | null>,
  setOpen: (open: boolean) => void,
) {
  const [seen, setSeen] = useState(state);

  if (state !== seen) {
    setSeen(state);
    if (state?.ok) setOpen(false);
  }

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state, formRef]);
}

/** Shared shell: a collapsed "+ Add …" button that expands into a form. */
function Expandable({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return (
      <div className="px-4 py-2.5">
        <Button type="button" variant="ghost" size="sm" onClick={onToggle}>
          <Plus size={12} /> {label}
        </Button>
      </div>
    );
  }
  return <div className="px-4 py-3.5 border-t border-line bg-canvas/30">{children}</div>;
}

/* -------------------------------------------------------------------------- */
/*  Record a response (brief §10 — "Add Response")                            */
/* -------------------------------------------------------------------------- */

export function ResponseForm({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addResponse, null);

  useCloseOnSuccess(state, formRef, setOpen);

  return (
    <Expandable label="Add response" open={open} onToggle={() => setOpen(true)}>
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Received" htmlFor="receivedAt">
            <Input id="receivedAt" name="receivedAt" type="date" defaultValue={today()} />
          </Field>
          <Field label="Type" htmlFor="sentiment">
            <Select id="sentiment" name="sentiment" defaultValue="positive">
              {SENTIMENTS.map((value) => (
                <option key={value} value={value}>
                  {SENTIMENT_META[value].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Channel" htmlFor="channel">
            <Input id="channel" name="channel" placeholder="Email / LinkedIn" />
          </Field>
        </div>
        <Field label="What did they say?" htmlFor="summary" required>
          <Textarea
            id="summary"
            name="summary"
            required
            rows={3}
            data-autofocus
            placeholder="Paste or summarise the reply. A rejection is still data — log it."
          />
        </Field>
        {state?.error ? <p className="text-[12px] text-bad">{state.error}</p> : null}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton>Save response</SubmitButton>
        </div>
      </form>
    </Expandable>
  );
}

/* -------------------------------------------------------------------------- */
/*  Create an action (brief §9)                                               */
/* -------------------------------------------------------------------------- */

export function ActionForm({ opportunityId }: { opportunityId: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(createAction, null);

  useCloseOnSuccess(state, formRef, setOpen);

  return (
    <Expandable label="Add action" open={open} onToggle={() => setOpen(true)}>
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="opportunityId" value={opportunityId} />
        <div className="grid sm:grid-cols-[150px_1fr_150px] gap-3">
          <Field label="Type" htmlFor="type">
            <Select id="type" name="type" defaultValue="email">
              {ACTION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {ACTION_TYPE_META[value].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="What needs doing?" htmlFor="title">
            <Input
              id="title"
              name="title"
              data-autofocus
              placeholder="Email the ops lead with the invoice demo"
            />
          </Field>
          <Field label="Due" htmlFor="dueDate">
            <Input id="dueDate" name="dueDate" type="date" defaultValue={addDays(today(), 1)} />
          </Field>
        </div>
        {state?.error ? <p className="text-[12px] text-bad">{state.error}</p> : null}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton>Add action</SubmitButton>
        </div>
      </form>
    </Expandable>
  );
}

/* -------------------------------------------------------------------------- */
/*  Add a contact (brief §8)                                                  */
/* -------------------------------------------------------------------------- */

export function ContactForm({
  companyId,
  opportunityId,
}: {
  companyId?: string | null;
  opportunityId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(addContact, null);

  useCloseOnSuccess(state, formRef, setOpen);

  return (
    <Expandable label="Add contact" open={open} onToggle={() => setOpen(true)}>
      <form ref={formRef} action={formAction} className="flex flex-col gap-3">
        {companyId ? <input type="hidden" name="companyId" value={companyId} /> : null}
        {opportunityId ? <input type="hidden" name="opportunityId" value={opportunityId} /> : null}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Name" htmlFor="contactName" required>
            <Input id="contactName" name="name" required data-autofocus placeholder="Jane Okafor" />
          </Field>
          <Field label="Role" htmlFor="contactRole">
            <Input id="contactRole" name="role" placeholder="Head of Operations" />
          </Field>
          <Field label="Email" htmlFor="contactEmail">
            <Input id="contactEmail" name="email" type="email" placeholder="jane@acme.com" />
          </Field>
          <Field label="LinkedIn" htmlFor="contactLinkedin">
            <Input id="contactLinkedin" name="linkedinUrl" placeholder="linkedin.com/in/…" />
          </Field>
          <Field label="Phone" htmlFor="contactPhone">
            <Input id="contactPhone" name="phone" />
          </Field>
          <Field label="Notes" htmlFor="contactNotes">
            <Input id="contactNotes" name="notes" placeholder="Met at the logistics meetup" />
          </Field>
        </div>
        {state?.error ? <p className="text-[12px] text-bad">{state.error}</p> : null}
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <SubmitButton>Add contact</SubmitButton>
        </div>
      </form>
    </Expandable>
  );
}
