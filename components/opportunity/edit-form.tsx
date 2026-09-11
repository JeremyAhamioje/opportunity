"use client";

import { useActionState, useState } from "react";
import { updateOpportunity } from "@/lib/actions/opportunities";
import {
  BUYER_ROLES,
  CATEGORIES,
  CATEGORY_META,
  WORK_MODES,
  type Category,
} from "@/lib/domain/types";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/actions/shared";
import type { OpportunityRow } from "@/lib/queries/opportunities";

/**
 * Category drives which fields exist. Switching category here swaps the fields
 * live; the action patches only what was rendered, so nothing is lost.
 */
export function EditForm({ row }: { row: OpportunityRow }) {
  const [category, setCategory] = useState<Category>(row.category);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateOpportunity,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={row.id} />

      <div className="px-4 py-3.5 flex flex-col gap-3.5">
        <div className="grid sm:grid-cols-[1fr_170px] gap-3">
          <Field label="Title" htmlFor="title" required>
            <Input id="title" name="title" defaultValue={row.title} required />
          </Field>
          <Field label="Category" htmlFor="category">
            <Select
              id="category"
              name="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
            >
              {CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_META[value].icon} {CATEGORY_META[value].short}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field
            label={category === "scholarship" ? "Organisation" : "Company"}
            htmlFor="companyName"
            hint="Renaming here moves the opportunity to that company."
          >
            <Input
              id="companyName"
              name="companyName"
              defaultValue={row.companyName ?? ""}
              placeholder="Acme Inc."
            />
          </Field>
          <Field label="Deadline" htmlFor="deadline">
            <Input id="deadline" name="deadline" type="date" defaultValue={row.deadline ?? ""} />
          </Field>
        </div>

        {/* ---- Category-specific ---- */}
        {category === "workflow" ? (
          <>
            <Field
              label="Problem / workflow observed"
              htmlFor="problemObserved"
              hint="What are people doing by hand, and how often?"
            >
              <Textarea
                id="problemObserved"
                name="problemObserved"
                rows={2}
                defaultValue={row.problemObserved ?? ""}
              />
            </Field>
            <Field
              label="Evidence"
              htmlFor="evidence"
              hint="Job ad, review, support thread, screenshot — where you saw it."
            >
              <Textarea id="evidence" name="evidence" rows={2} defaultValue={row.evidence ?? ""} />
            </Field>
            <Field label="Current process" htmlFor="currentProcess">
              <Textarea
                id="currentProcess"
                name="currentProcess"
                rows={2}
                defaultValue={row.currentProcess ?? ""}
              />
            </Field>
            <Field label="Proposed solution" htmlFor="proposedSolution">
              <Textarea
                id="proposedSolution"
                name="proposedSolution"
                rows={2}
                defaultValue={row.proposedSolution ?? ""}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field
                label="Expected value of solving it"
                htmlFor="expectedValue"
                hint="Hours saved, cost avoided, revenue unblocked."
              >
                <Input
                  id="expectedValue"
                  name="expectedValue"
                  defaultValue={row.expectedValue ?? ""}
                  placeholder="~60 hrs/month of admin"
                />
              </Field>
              <Field
                label="Decision maker"
                htmlFor="buyerRole"
                hint="Pick an archetype or name the actual person."
              >
                {/* Free text with suggestions, not a fixed select: research
                    routinely returns a named human ("Founder & CEO Jane Doe"),
                    and a select would quietly reset that to blank on save. */}
                <Input
                  id="buyerRole"
                  name="buyerRole"
                  list="buyer-roles"
                  defaultValue={row.buyerRole ?? ""}
                  placeholder="Head of Finance"
                />
                <datalist id="buyer-roles">
                  {BUYER_ROLES.map((role) => (
                    <option key={role} value={role} />
                  ))}
                </datalist>
              </Field>
            </div>
            <Field
              label="Outreach angle"
              htmlFor="outreachAngle"
              hint="The one sentence that earns a reply."
            >
              <Textarea
                id="outreachAngle"
                name="outreachAngle"
                rows={2}
                defaultValue={row.outreachAngle ?? ""}
              />
            </Field>
          </>
        ) : null}

        {category === "build" ? (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="What problem it solves" htmlFor="problemObserved">
                <Textarea
                  id="problemObserved"
                  name="problemObserved"
                  rows={2}
                  defaultValue={row.problemObserved ?? ""}
                />
              </Field>
              <Field label="What gets built" htmlFor="proposedSolution">
                <Textarea
                  id="proposedSolution"
                  name="proposedSolution"
                  rows={2}
                  defaultValue={row.proposedSolution ?? ""}
                />
              </Field>
            </div>
            <Field
              label="What it proves"
              htmlFor="whatItProves"
              hint="The application it supports, or the skill it demonstrates."
            >
              <Input
                id="whatItProves"
                name="whatItProves"
                defaultValue={row.whatItProves ?? ""}
              />
            </Field>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field
                label="First step"
                htmlFor="firstStep"
                hint="Small and physical — this is what restarts a stalled build."
              >
                <Input id="firstStep" name="firstStep" defaultValue={row.firstStep ?? ""} />
              </Field>
              <Field label="Scope" htmlFor="scopeEstimate">
                <Input
                  id="scopeEstimate"
                  name="scopeEstimate"
                  placeholder="A weekend"
                  defaultValue={row.scopeEstimate ?? ""}
                />
              </Field>
            </div>
            <Field label="Stack" htmlFor="skills" hint="Comma separated.">
              <Input id="skills" name="skills" defaultValue={row.skills.join(", ")} />
            </Field>
          </>
        ) : null}

        {category === "speculative" ? (
          <>
            <Field label="Why I'm interested" htmlFor="whyInterested">
              <Textarea
                id="whyInterested"
                name="whyInterested"
                rows={2}
                defaultValue={row.whyInterested ?? ""}
              />
            </Field>
            <Field label="What I could contribute" htmlFor="contribution">
              <Textarea
                id="contribution"
                name="contribution"
                rows={2}
                defaultValue={row.contribution ?? ""}
              />
            </Field>
            <Field
              label="Contact method"
              htmlFor="contactMethod"
              hint="How you plan to reach them."
            >
              <Input
                id="contactMethod"
                name="contactMethod"
                defaultValue={row.contactMethod ?? ""}
                placeholder="LinkedIn DM to the founder"
              />
            </Field>
          </>
        ) : null}

        {category === "job" ? (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Salary / rate" htmlFor="salary">
                <Input id="salary" name="salary" defaultValue={row.salary ?? ""} />
              </Field>
              <Field label="Location" htmlFor="location">
                <Input id="location" name="location" defaultValue={row.location ?? ""} />
              </Field>
              <Field label="Work mode" htmlFor="workMode">
                <Select id="workMode" name="workMode" defaultValue={row.workMode ?? ""}>
                  <option value="">Unspecified</option>
                  {WORK_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode[0].toUpperCase() + mode.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Date applied" htmlFor="appliedAt">
                <Input
                  id="appliedAt"
                  name="appliedAt"
                  type="date"
                  defaultValue={row.appliedAt ?? ""}
                />
              </Field>
            </div>
            <Field label="Skills required" htmlFor="skills" hint="Comma separated.">
              <Input id="skills" name="skills" defaultValue={row.skills.join(", ")} />
            </Field>
          </>
        ) : null}

        {category === "scholarship" ? (
          <>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Country" htmlFor="country">
                <Input id="country" name="country" defaultValue={row.country ?? ""} />
              </Field>
              <Field label="Degree level" htmlFor="degreeLevel">
                <Input id="degreeLevel" name="degreeLevel" defaultValue={row.degreeLevel ?? ""} />
              </Field>
              <Field label="Funding" htmlFor="fundingAmount">
                <Input
                  id="fundingAmount"
                  name="fundingAmount"
                  defaultValue={row.fundingAmount ?? ""}
                />
              </Field>
            </div>
            <Field label="Eligibility" htmlFor="eligibility">
              <Textarea
                id="eligibility"
                name="eligibility"
                rows={2}
                defaultValue={row.eligibility ?? ""}
              />
            </Field>
            <Field label="Requirements" htmlFor="requirements">
              <Textarea
                id="requirements"
                name="requirements"
                rows={2}
                defaultValue={row.requirements ?? ""}
              />
            </Field>
          </>
        ) : null}

        {/* ---- Links, always present (brief §11) ---- */}
        <div className="grid sm:grid-cols-3 gap-3 pt-1 border-t border-line/70">
          <Field label="Application / job link" htmlFor="applicationUrl">
            <Input
              id="applicationUrl"
              name="applicationUrl"
              defaultValue={row.applicationUrl ?? ""}
              placeholder="https://"
            />
          </Field>
          <Field label="Contact link" htmlFor="contactUrl">
            <Input
              id="contactUrl"
              name="contactUrl"
              defaultValue={row.contactUrl ?? ""}
              placeholder="LinkedIn profile, contact form…"
            />
          </Field>
          <Field label="Supporting documents" htmlFor="documentsUrl">
            <Input
              id="documentsUrl"
              name="documentsUrl"
              defaultValue={row.documentsUrl ?? ""}
              placeholder="Drive folder, CV version…"
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-[1fr_220px] gap-3">
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={3} defaultValue={row.notes ?? ""} />
          </Field>
          <Field label="Tags" htmlFor="tags" hint="Comma separated.">
            <Input id="tags" name="tags" defaultValue={row.tags.join(", ")} />
          </Field>
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-line flex items-center justify-end gap-2 bg-canvas/40">
        {state?.ok ? <span className="mr-auto text-[11.5px] text-good">Saved.</span> : null}
        {state?.error ? <span className="mr-auto text-[11.5px] text-bad">{state.error}</span> : null}
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}
