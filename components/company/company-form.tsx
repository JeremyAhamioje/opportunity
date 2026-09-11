"use client";

import { useActionState } from "react";
import { updateCompany } from "@/lib/actions/companies";
import { COMPANY_SIZES } from "@/lib/domain/types";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/ui/client";
import type { ActionResult } from "@/lib/actions/shared";
import type { Company } from "@/lib/db/schema";

export function CompanyForm({ company }: { company: Company }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(updateCompany, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={company.id} />
      <div className="px-4 py-3.5 grid sm:grid-cols-2 gap-3">
        <Field label="Company name" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={company.name} required />
        </Field>
        <Field label="Website" htmlFor="website">
          <Input id="website" name="website" defaultValue={company.website ?? ""} placeholder="acme.com" />
        </Field>
        <Field label="Industry" htmlFor="industry">
          <Input id="industry" name="industry" defaultValue={company.industry ?? ""} />
        </Field>
        <Field label="Company size" htmlFor="size">
          <Select id="size" name="size" defaultValue={company.size ?? ""}>
            <option value="">Unknown</option>
            {COMPANY_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} employees
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Location" htmlFor="location">
          <Input id="location" name="location" defaultValue={company.location ?? ""} />
        </Field>
        <Field label="LinkedIn" htmlFor="linkedinUrl">
          <Input
            id="linkedinUrl"
            name="linkedinUrl"
            defaultValue={company.linkedinUrl ?? ""}
            placeholder="linkedin.com/company/…"
          />
        </Field>
        <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
          <Textarea id="notes" name="notes" rows={3} defaultValue={company.notes ?? ""} />
        </Field>
      </div>
      <div className="px-4 py-2.5 border-t border-line flex items-center justify-end gap-2 bg-canvas/40">
        {state?.ok ? <span className="mr-auto text-[11.5px] text-good">Saved.</span> : null}
        {state?.error ? <span className="mr-auto text-[11.5px] text-bad">{state.error}</span> : null}
        <SubmitButton>Save company</SubmitButton>
      </div>
    </form>
  );
}
