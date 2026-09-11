import { and, eq, ilike } from "drizzle-orm";
import { getDb } from "./index";
import { companies } from "./schema";

export type CompanyExtras = {
  website?: string | null;
  industry?: string | null;
  size?: string | null;
  location?: string | null;
};

/**
 * Companies are addressed by name, not picked from a dropdown — typing
 * "Acme Inc." twice must land on one company with two opportunities, which is
 * what makes the company profile page worth having.
 *
 * Plain module, not a server action: this is called *by* actions, and should
 * not itself be reachable over the wire.
 */
export async function resolveCompanyId(
  userId: string,
  name: string | null,
  extras?: CompanyExtras,
): Promise<string | null> {
  if (!name) return null;
  const db = await getDb();

  const [existing] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.userId, userId), ilike(companies.name, name)))
    .limit(1);

  if (existing) {
    // Fill in blanks discovered later without clobbering what is already there.
    const patch: Record<string, string> = {};
    if (!existing.website && extras?.website) patch.website = extras.website;
    if (!existing.industry && extras?.industry) patch.industry = extras.industry;
    if (!existing.size && extras?.size) patch.size = extras.size;
    if (!existing.location && extras?.location) patch.location = extras.location;
    if (Object.keys(patch).length) {
      await db.update(companies).set(patch).where(eq(companies.id, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(companies)
    .values({
      userId,
      name,
      website: extras?.website ?? null,
      industry: extras?.industry ?? null,
      size: extras?.size ?? null,
      location: extras?.location ?? null,
    })
    .returning({ id: companies.id });

  return created.id;
}
