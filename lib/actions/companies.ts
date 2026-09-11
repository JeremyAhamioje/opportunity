"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { companies, contacts } from "@/lib/db/schema";
import { requireViewer } from "@/lib/auth/guard";
import { normalizeUrl } from "@/lib/utils";
import { fail, OK, refreshAll, str, type ActionResult } from "./shared";

export async function updateCompany(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  const name = str(form, "name");
  if (!id) return fail("Missing company.");
  if (!name) return fail("A company name is required.");

  await db
    .update(companies)
    .set({
      name,
      website: normalizeUrl(str(form, "website")),
      industry: str(form, "industry"),
      size: str(form, "size"),
      location: str(form, "location"),
      linkedinUrl: normalizeUrl(str(form, "linkedinUrl")),
      notes: str(form, "notes"),
    })
    .where(and(eq(companies.id, id), eq(companies.userId, user.id)));

  refreshAll();
  return OK;
}

export async function addContact(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();
  const name = str(form, "name");
  if (!name) return fail("A contact name is required.");

  await db.insert(contacts).values({
    userId: user.id,
    companyId: str(form, "companyId"),
    opportunityId: str(form, "opportunityId"),
    name,
    role: str(form, "role"),
    email: str(form, "email"),
    linkedinUrl: normalizeUrl(str(form, "linkedinUrl")),
    phone: str(form, "phone"),
    notes: str(form, "notes"),
  });

  refreshAll();
  return OK;
}

export async function deleteContact(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, user.id)));
  refreshAll();
}

export async function deleteCompany(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  // Opportunities survive with company_id set to null rather than vanishing —
  // losing a shot because a company record was tidied up would be the exact
  // failure this product exists to prevent.
  await db.delete(companies).where(and(eq(companies.id, id), eq(companies.userId, user.id)));
  refreshAll();
  redirect("/companies");
}
