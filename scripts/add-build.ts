/**
 * Adds the opportunity.co build — the idea that prompted the Builds feature.
 *
 * A one-off, not part of `seed`: this is a real build, not demo data, so it is
 * written with `is_mock = false` and must survive `npm run clear -- mock`.
 * Re-running it updates the existing row rather than making a second one.
 *
 *   npm run add:build
 */
import { and, eq } from "drizzle-orm";
import { closeDb, getDb } from "../lib/db";
import { opportunities, users } from "../lib/db/schema";
import { addDays, today } from "../lib/domain/dates";
import { imageForOpportunity } from "../lib/domain/imagery";
import { assertNotRunning } from "./guard";

const TITLE = "opportunity.co — productise the CRM";

const BRAIN_DUMP = `that just gave me an idea. thats what the app is for, random braindumps.
build opportunity.co with relevant context. product name is Opportunity, site is opportunity.co.

the manual process of sourcing leads gets done through the anthropic api directly instead of
me running a research prompt in the claude apps and pasting the markdown back in.

the type of lead generated is determined by context derived during client onboarding — so the
six hand-written niche prompts stop being fixed, and become something the onboarding answers
parameterise.

also: builds should be their own column. if i want to build something as a demo for an
application i should be able to brain dump the idea, have gemini structure it, and let the
app's own reminder algorithm bring it back up.`;

async function main() {
  await assertNotRunning();

  const db = await getDb();
  const [user] = await db.select().from(users).limit(1);
  if (!user) {
    console.error("No account yet — visit /setup first.");
    process.exitCode = 1;
    return;
  }

  const values = {
    userId: user.id,
    companyId: null,
    category: "build" as const,
    title: TITLE,
    stage: "researching" as const,
    brainDump: BRAIN_DUMP,
    problemObserved:
      "The CRM does the hard half — dedupe, scoring, pipeline, follow-up discipline — but " +
      "sourcing is still manual: run a research prompt in the Claude apps, paste the markdown " +
      "back in. That is the part that costs time, and the part that is generic enough to sell.",
    proposedSolution:
      "Opportunity, at opportunity.co. Server-side Anthropic API calls replace the manual " +
      "research loop. Client onboarding captures context, and that context parameterises which " +
      "discovery motions run — so the six fixed niche prompts become generated per client.",
    whatItProves:
      "That the desk-research half of finding work can be run as a product, not a personal habit.",
    firstStep: "Draft the onboarding questionnaire — the answers are what parameterise discovery.",
    scopeEstimate: "Multi-tenancy and hosted Postgres first — neither is polish",
    skills: ["Next.js", "Anthropic API", "Postgres", "Drizzle", "multi-tenancy"],
    notes: [
      "- Currently single-tenant: one owner account created at /setup, every query filtered by that userId.",
      "- Defaults to embedded PGlite, which is single-writer and cannot survive a serverless deploy.",
      "- Anthropic is deliberate here, and is the exception to the standing Gemini-in-apps preference.",
      "- The parser and importer already take structured output, so this replaces acquisition only.",
    ].join("\n"),
    imageUrl: imageForOpportunity({
      category: "build",
      title: TITLE,
      problem: "sourcing leads api onboarding multi-tenant postgres",
    }),
    nextFollowUpAt: addDays(today(), 7),
  };

  const [existing] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(and(eq(opportunities.userId, user.id), eq(opportunities.title, TITLE)))
    .limit(1);

  if (existing) {
    await db.update(opportunities).set(values).where(eq(opportunities.id, existing.id));
    console.log(`Updated the existing build (${existing.id}).`);
  } else {
    const [created] = await db
      .insert(opportunities)
      .values(values)
      .returning({ id: opportunities.id });
    console.log(`Added "${TITLE}" (${created.id}). Check-in set for ${values.nextFollowUpAt}.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // PGlite buffers writes; exiting without this discards them.
  .finally(closeDb);
