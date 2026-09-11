/**
 * Removes opportunities by category, so mock data can be retired one niche at a
 * time as real research replaces it.
 *
 *   npm run clear -- workflow
 *   npm run clear -- job scholarship
 *   npm run clear -- all
 *   npm run clear -- workflow --keep-companies
 *
 * Companies left with no opportunities are removed too, unless
 * --keep-companies is passed. Contacts, actions, responses and timeline entries
 * cascade with the opportunity.
 */
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { closeDb, getDb } from "../lib/db";
import { companies, opportunities, users } from "../lib/db/schema";
import { CATEGORIES, CATEGORY_META, type Category } from "../lib/domain/types";
import { assertNotRunning } from "./guard";

async function main() {
  const args = process.argv.slice(2);
  const keepCompanies = args.includes("--keep-companies");
  const named = args.filter((arg) => !arg.startsWith("--"));

  if (!named.length) {
    console.error(
      `Name at least one category to clear: ${CATEGORIES.join(", ")}, "mock", or "all".\n` +
        `  npm run clear -- workflow\n` +
        `  npm run clear -- mock`,
    );
    process.exit(1);
  }

  const mockOnly = named.includes("mock");
  const targets: Category[] =
    named.includes("all") || (mockOnly && named.length === 1)
      ? [...CATEGORIES]
      : (named.filter((name) => (CATEGORIES as readonly string[]).includes(name)) as Category[]);

  const unknown = named.filter(
    (name) =>
      name !== "all" && name !== "mock" && !(CATEGORIES as readonly string[]).includes(name),
  );
  if (unknown.length) {
    console.error(`Unknown categor${unknown.length === 1 ? "y" : "ies"}: ${unknown.join(", ")}`);
    console.error(`Valid values: ${CATEGORIES.join(", ")}, all`);
    process.exit(1);
  }

  await assertNotRunning("this delete");
  const db = await getDb();

  const [owner] = await db.select().from(users).limit(1);
  if (!owner) {
    console.error("No account found — nothing to clear.");
    process.exit(1);
  }

  // `mock` narrows to seeded rows so real leads in the same category survive.
  const scope = mockOnly
    ? and(
        eq(opportunities.userId, owner.id),
        inArray(opportunities.category, targets),
        eq(opportunities.isMock, true),
      )
    : and(eq(opportunities.userId, owner.id), inArray(opportunities.category, targets));

  const doomed = await db
    .select({ id: opportunities.id, title: opportunities.title, category: opportunities.category })
    .from(opportunities)
    .where(scope);

  if (!doomed.length) {
    console.log(`Nothing to clear in: ${targets.join(", ")}.`);
    await closeDb();
    process.exit(0);
  }

  for (const target of targets) {
    const count = doomed.filter((row) => row.category === target).length;
    if (count) console.log(`  ${CATEGORY_META[target].icon} ${count} × ${CATEGORY_META[target].short}`);
  }

  await db.delete(opportunities).where(scope);

  let orphans = 0;
  if (!keepCompanies) {
    // A company with no opportunities left is noise on the Companies screen.
    const result = await db
      .delete(companies)
      .where(
        and(
          eq(companies.userId, owner.id),
          sql`not exists (select 1 from ${opportunities} where ${opportunities.companyId} = ${companies.id})`,
          isNull(companies.notes),
        ),
      )
      .returning({ id: companies.id });
    orphans = result.length;
  }

  console.log(
    `\nDeleted ${doomed.length} opportunit${doomed.length === 1 ? "y" : "ies"}` +
      (orphans ? ` and ${orphans} company record${orphans === 1 ? "" : "s"} left with none.` : "."),
  );

  await closeDb();
  process.exit(0);
}

main().catch(async (error) => {
  console.error(error);
  await closeDb().catch(() => {});
  process.exit(1);
});
