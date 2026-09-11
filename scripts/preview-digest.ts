/**
 * Writes the current digest to an HTML file so it can be looked at without
 * sending anything. Read-only — safe to run while the dev server is up.
 *
 *   npm run preview:digest
 */
import { writeFileSync } from "node:fs";
import { closeDb, getDb } from "../lib/db";
import { settings, users } from "../lib/db/schema";
import { buildDigest } from "../lib/email/digest";
import { digestBaseUrl } from "../lib/email/send-digest";
import { eq } from "drizzle-orm";

async function main() {
  const out = process.argv[2] ?? "digest-preview.html";
  const db = await getDb();

  const [row] = await db
    .select({ user: users, config: settings })
    .from(users)
    .innerJoin(settings, eq(settings.userId, users.id))
    .limit(1);

  if (!row) {
    console.error("No account yet — visit /setup first.");
    process.exitCode = 1;
    return;
  }

  const digest = await buildDigest(row.user.id, row.config.scoringWeights, digestBaseUrl());

  writeFileSync(out, digest.html, "utf8");
  console.log(`Subject: ${digest.subject}`);
  console.log(`Empty:   ${digest.empty}`);
  console.log(`Counts:  ${JSON.stringify(digest.counts)}`);
  console.log(`Written: ${out}`);
  console.log("\n--- text part ---\n");
  console.log(digest.text);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
