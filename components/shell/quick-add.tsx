"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";
import { createOpportunity } from "@/lib/actions/opportunities";
import { CATEGORIES, CATEGORY_META, WORK_MODES, type Category } from "@/lib/domain/types";
import { Button, Field, Input, KeyHint, Select, Textarea } from "@/components/ui";
import { Modal, SubmitButton } from "@/components/ui/client";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/lib/actions/shared";

const CATEGORY_ACCENT: Record<Category, string> = {
  workflow: "border-cat-workflow/40 bg-cat-workflow/8 text-cat-workflow",
  speculative: "border-cat-speculative/40 bg-cat-speculative/8 text-cat-speculative",
  job: "border-cat-job/40 bg-cat-job/8 text-cat-job",
  scholarship: "border-cat-scholarship/40 bg-cat-scholarship/8 text-cat-scholarship",
  build: "border-cat-build/40 bg-cat-build/8 text-cat-build",
};

/**
 * Two screens, never more: pick a bucket, fill the few fields that matter for
 * it. Everything else is enrichment and belongs on the detail page — the whole
 * point is that adding an opportunity never feels expensive enough to skip.
 */
export function QuickAdd({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [category, setCategory] = useState<Category | null>(null);
  const [added, setAdded] = useState(0);
  const [lastState, setLastState] = useState<ActionResult | null>(null);
  // Which of the two save buttons was pressed. State, not a ref, because the
  // render that handles the result needs to read it.
  const [keepOpen, setKeepOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    createOpportunity,
    null,
  );

  // A fresh result means a save landed. Handled during render for the counter,
  // and in an effect for the DOM and navigation work.
  if (state !== lastState) {
    setLastState(state);
    if (state?.ok && state.id && keepOpen) setAdded((count) => count + 1);
  }

  useEffect(() => {
    if (!state?.ok || !state.id) return;

    if (!keepOpen) {
      onClose();
      router.push(`/opportunities/${state.id}`);
      return;
    }

    formRef.current?.reset();
    const field = formRef.current?.querySelector<HTMLInputElement>("input[name=companyName]");
    // Deferred by a frame: the browser puts focus back on the submit button
    // once the action settles, and that would otherwise win the race — leaving
    // you tabbing back to the first field on every single add.
    const frame = requestAnimationFrame(() => field?.focus());
    return () => cancelAnimationFrame(frame);
  }, [state, keepOpen, onClose, router]);

  // Number keys pick a bucket without reaching for the mouse.
  useEffect(() => {
    if (category) return;
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1;
      if (index >= 0 && index < CATEGORIES.length) {
        event.preventDefault();
        setCategory(CATEGORIES[index]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [category]);

  const meta = category ? CATEGORY_META[category] : null;

  return (
    <Modal
      open
      onClose={onClose}
      width={category ? "md" : "sm"}
      title={meta ? `New ${meta.short.toLowerCase()} opportunity` : "Add opportunity"}
      description={
        meta
          ? "Company name is all that is strictly required. Enrich it later."
          : "What kind of shot is this?"
      }
    >
      {!category ? (
        <div className="p-3 grid gap-1.5">
          {CATEGORIES.map((value, index) => {
            const info = CATEGORY_META[value];
            return (
              <button
                key={value}
                type="button"
                data-autofocus={index === 0 ? true : undefined}
                onClick={() => setCategory(value)}
                className="flex items-center gap-3 text-left px-3 py-2.5 rounded-md border border-line bg-canvas hover:bg-raised hover:border-line-strong transition-colors"
              >
                <span className="text-[17px] leading-none">{info.icon}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium">{info.label}</span>
                  <span className="block text-[11.5px] text-ink-faint">{info.blurb}</span>
                </span>
                <KeyHint>{index + 1}</KeyHint>
              </button>
            );
          })}
        </div>
      ) : (
        <form ref={formRef} action={formAction} className="contents">
          <input type="hidden" name="category" value={category} />

          <div className="p-4 grid gap-3.5 max-h-[62vh] overflow-y-auto">
            <div
              className={cn(
                "flex items-center gap-2 text-[11.5px] px-2.5 py-1.5 rounded-md border",
                CATEGORY_ACCENT[category],
              )}
            >
              <span>{meta!.icon}</span>
              <span className="font-medium">{meta!.label}</span>
            </div>

            {category === "build" ? (
              // No company, no link: a build is yours. Only the name and the
              // first move are worth asking for at capture speed.
              <>
                <Field label="What are you building?" htmlFor="title" required>
                  <Input
                    id="title"
                    name="title"
                    required
                    data-autofocus
                    autoComplete="off"
                    placeholder="Onboarding questionnaire for opportunity.co"
                  />
                </Field>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field
                    label="First step"
                    htmlFor="firstStep"
                    hint="Small and physical."
                  >
                    <Input id="firstStep" name="firstStep" placeholder="Sketch the 6 questions" />
                  </Field>
                  <Field label="Remind me in (days)" htmlFor="checkInDays">
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
                <p className="text-[11.5px] text-ink-faint -mt-1">
                  Got more than a sentence?{" "}
                  <Link href="/builds" className="text-accent hover:underline">
                    Dump it on the Builds screen
                  </Link>{" "}
                  and Gemini will structure it.
                </p>
              </>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field
                    label={category === "scholarship" ? "Organisation" : "Company"}
                    htmlFor="companyName"
                    required
                  >
                    <Input
                      id="companyName"
                      name="companyName"
                      required
                      data-autofocus
                      autoComplete="off"
                      placeholder={category === "scholarship" ? "Chevening" : "Acme Inc."}
                    />
                  </Field>
                  <Field
                    label={
                      category === "job"
                        ? "Job title"
                        : category === "scholarship"
                          ? "Scholarship name"
                          : "Headline"
                    }
                    htmlFor="title"
                    hint="Optional — one is generated if you skip it."
                  >
                    <Input
                      id="title"
                      name="title"
                      autoComplete="off"
                      placeholder={titlePlaceholder(category)}
                    />
                  </Field>
                </div>

                <Field
                  label={
                    category === "job" || category === "scholarship"
                      ? "Application link"
                      : "Website"
                  }
                  htmlFor="applicationUrl"
                  hint="Paste the URL you found this at — this is what stops opportunities getting lost."
                >
                  <Input
                    id="applicationUrl"
                    name={
                      category === "job" || category === "scholarship"
                        ? "applicationUrl"
                        : "website"
                    }
                    autoComplete="off"
                    placeholder="https://"
                  />
                </Field>
              </>
            )}

            {category === "workflow" ? (
              <>
                <Field label="Problem / workflow observed" htmlFor="problemObserved">
                  <Textarea
                    id="problemObserved"
                    name="problemObserved"
                    rows={2}
                    placeholder="Ops team re-keys ~400 supplier invoices a month from email into Sage."
                  />
                </Field>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Likely buyer" htmlFor="buyerRole">
                    <Input id="buyerRole" name="buyerRole" placeholder="Head of Finance" />
                  </Field>
                  <Field label="Industry" htmlFor="industry">
                    <Input id="industry" name="industry" placeholder="Logistics" />
                  </Field>
                </div>
              </>
            ) : null}

            {category === "speculative" ? (
              <>
                <Field label="Why I'm interested" htmlFor="whyInterested">
                  <Textarea id="whyInterested" name="whyInterested" rows={2} />
                </Field>
                <Field label="What I could contribute" htmlFor="contribution">
                  <Textarea id="contribution" name="contribution" rows={2} />
                </Field>
              </>
            ) : null}

            {category === "job" ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Salary / rate" htmlFor="salary">
                  <Input id="salary" name="salary" placeholder="£45–55k" />
                </Field>
                <Field label="Location" htmlFor="location">
                  <Input id="location" name="location" placeholder="London" />
                </Field>
                <Field label="Work mode" htmlFor="workMode">
                  <Select id="workMode" name="workMode" defaultValue="">
                    <option value="">Unspecified</option>
                    {WORK_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode[0].toUpperCase() + mode.slice(1)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Deadline" htmlFor="deadline">
                  <Input id="deadline" name="deadline" type="date" />
                </Field>
              </div>
            ) : null}

            {category === "scholarship" ? (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Country" htmlFor="country">
                    <Input id="country" name="country" placeholder="United Kingdom" />
                  </Field>
                  <Field label="Degree level" htmlFor="degreeLevel">
                    <Input id="degreeLevel" name="degreeLevel" placeholder="Master's" />
                  </Field>
                  <Field label="Funding" htmlFor="fundingAmount">
                    <Input id="fundingAmount" name="fundingAmount" placeholder="Full tuition + stipend" />
                  </Field>
                  <Field label="Deadline" htmlFor="deadline">
                    <Input id="deadline" name="deadline" type="date" />
                  </Field>
                </div>
                <Field
                  label="Documents required"
                  htmlFor="documentsRequired"
                  hint="Comma separated — each becomes a checkbox on the opportunity."
                >
                  <Input
                    id="documentsRequired"
                    name="documentsRequired"
                    placeholder="Transcript, 2 references, personal statement"
                  />
                </Field>
              </>
            ) : null}

            <Field label="Notes" htmlFor="notes">
              <Textarea id="notes" name="notes" rows={2} placeholder="Anything you'll forget by tomorrow." />
            </Field>

            {state?.error ? (
              <p className="flex items-start gap-2 text-[12px] text-bad">
                <AlertCircle size={13} className="mt-px shrink-0" />
                {state.error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-line bg-canvas/40">
            {added > 0 ? (
              <span className="mr-auto text-[11.5px] text-good flex items-center gap-1.5">
                <Check size={13} /> {added} added this session
              </span>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => setCategory(null)}>
              Back
            </Button>
            <SubmitButton
              variant="secondary"
              onClick={() => setKeepOpen(true)}
              pendingLabel="Adding…"
            >
              Save &amp; add another
            </SubmitButton>
            <SubmitButton onClick={() => setKeepOpen(false)} pendingLabel="Adding…">
              Save &amp; open
            </SubmitButton>
          </div>
        </form>
      )}
    </Modal>
  );
}

function titlePlaceholder(category: Category) {
  switch (category) {
    case "workflow":
      return "Invoice intake automation";
    case "speculative":
      return "Frontend + automation help";
    case "job":
      return "Junior Software Engineer";
    case "scholarship":
      return "Chevening Scholarship 2027";
    case "build":
      return "Onboarding questionnaire";
  }
}
