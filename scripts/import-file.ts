/**
 * Imports research findings from a file, without the browser.
 *
 *   npm run import -- path/to/leads.tsv
 *   npm run import -- path/to/leads.tsv --dry-run
 *
 * Same parser and the same writes as the Research Import screen — this only
 * skips the review step, so `--dry-run` first is the sensible habit.
 */

import { readFile } from "node:fs/promises";
import { loadEnv } from "./env";
import { closeDb, getDb } from "../lib/db";
import { resolveCompanyId } from "../lib/db/resolve";
import { contacts, opportunities, users } from "../lib/db/schema";
import { parseResearch } from "../lib/parse/research";
import { isValidDay } from "../lib/domain/dates";
import { imageForOpportunity } from "../lib/domain/imagery";
import type { RequiredDocument } from "../lib/domain/types";
import { normalizeUrl } from "../lib/utils";
import { assertNotRunning } from "./guard";

loadEnv();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const file = args.find((arg) => !arg.startsWith("--"));

  if (!file) {
    console.error("Usage: npm run import -- <file> [--dry-run]");
    process.exit(1);
  }

  if (!dryRun) await assertNotRunning("this import");

  const report = parseResearch(await readFile(file, "utf8"));
  console.log(`${report.note}\n`);

  if (!report.items.length) {
    console.error("Nothing to import.");
    process.exit(1);
  }

  for (const item of report.items) {
    console.log(
      `  [${item.category}] ${item.companyName} — ${item.title ?? "(no title)"}` +
        `${item.contactEmail ? `  ✉ ${item.contactEmail}` : ""}`,
    );
  }

  if (dryRun) {
    console.log(`\nDry run — nothing written. ${report.items.length} would be imported.`);
    await closeDb();
    return;
  }

  const db = await getDb();
  const [user] = await db.select().from(users).orderBy(users.createdAt).limit(1);
  if (!user) {
    console.error("No account yet. Open the app and complete /setup first.");
    process.exit(1);
  }

  let imported = 0;
  for (const draft of report.items) {
    const companyId = await resolveCompanyId(user.id, draft.companyName, {
      website: normalizeUrl(draft.website),
      industry: draft.industry,
      size: draft.companySize,
      location: draft.location,
    });

    const [row] = await db
      .insert(opportunities)
      .values({
        userId: user.id,
        companyId,
        category: draft.category,
        title: draft.title ?? `${draft.companyName} opportunity`,
        notes: draft.notes,
        imageUrl: imageForOpportunity({
          category: draft.category,
          title: draft.title,
          industry: draft.industry,
          problem: draft.problemObserved,
          notes: draft.notes,
        }),
        applicationUrl: normalizeUrl(draft.applicationUrl),
        deadline: draft.deadline && isValidDay(draft.deadline) ? draft.deadline : null,
        problemObserved: draft.problemObserved ?? null,
        proposedSolution: draft.proposedSolution ?? null,
        buyerRole: draft.buyerRole ?? null,
        whyInterested: draft.whyInterested ?? null,
        contribution: draft.contribution ?? null,
        salary: draft.salary ?? null,
        location: draft.location ?? null,
        workMode: draft.workMode ?? null,
        skills: draft.skills ?? [],
        country: draft.country ?? null,
        degreeLevel: draft.degreeLevel ?? null,
        fundingAmount: draft.fundingAmount ?? null,
        eligibility: draft.eligibility ?? null,
        requirements: draft.requirements ?? null,
        documents: (draft.documents ?? []).map<RequiredDocument>((name) => ({
          name,
          done: false,
        })),
      })
      .returning({ id: opportunities.id });

    if (draft.contactName || draft.contactEmail) {
      await db.insert(contacts).values({
        userId: user.id,
        companyId,
        opportunityId: row.id,
        name: draft.contactName ?? draft.contactEmail!,
        email: draft.contactEmail ?? null,
      });
    }

    imported += 1;
  }

  console.log(`\nImported ${imported}.`);
  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
