/**
 * Copies the embedded PGlite database into a hosted Postgres.
 *
 *   npm run migrate:postgres -- --dry-run
 *   npm run migrate:postgres
 *
 * One-way and additive: it reads `./.pglite` and writes to `DATABASE_URL`,
 * never the other direction. Existing rows in the target are left alone
 * (`onConflictDoNothing`), so a re-run after a partial failure resumes rather
 * than duplicating.
 *
 * The local database is never modified or deleted — if the move goes wrong,
 * unset `DATABASE_URL` and everything is exactly where it was.
 */

import path from "node:path";
import { loadEnv } from "./env";
import * as schema from "../lib/db/schema";
import { assertNotRunning } from "./guard";

loadEnv();

/**
 * Foreign keys dictate the order. Parents before children, or the first insert
 * fails on a constraint that is doing exactly its job.
 */
const TABLES = [
  ["users", schema.users],
  ["settings", schema.settings],
  ["companies", schema.companies],
  ["opportunities", schema.opportunities],
  ["contacts", schema.contacts],
  ["actions", schema.actions],
  ["responses", schema.responses],
  ["activities", schema.activities],
  ["conversations", schema.conversations],
  ["messages", schema.messages],
  ["insights", schema.insights],
  ["insight_mentions", schema.insightMentions],
  ["insight_links", schema.insightLinks],
] as const;

/**
 * `opportunities` has ~60 columns and Postgres caps a statement at 65535 bind
 * parameters, so rows-per-insert has to stay well under that ceiling.
 */
const BATCH = 150;

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  const target = process.env.DATABASE_URL?.trim();
  if (!target) {
    console.error(
      "DATABASE_URL is not set — that is the destination.\n" +
        "Put the hosted connection string in .env.local first.",
    );
    process.exit(1);
  }

  await assertNotRunning("this migration");

  // Both drivers are opened directly rather than through getDb(), which caches
  // a single connection chosen from the environment. Here we need both at once.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { Pool } = await import("pg");
  const { drizzle: drizzlePg } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");

  const localPath = process.env.PGLITE_PATH ?? path.join(process.cwd(), ".pglite");
  const local = new PGlite(localPath);
  const source = drizzlePglite(local, { schema });

  const pool = new Pool({
    connectionString: target,
    ssl: target.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
    max: 4,
  });
  const destination = drizzlePg(pool, { schema });

  const host = new URL(target).host;
  console.log(`from  ${localPath}`);
  console.log(`to    ${host}\n`);

  console.log("Applying migrations to the destination…");
  await migrate(destination, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  console.log("Schema is up to date.\n");

  let totalRead = 0;
  let totalWritten = 0;
  const summary: string[] = [];

  for (const [name, table] of TABLES) {
    const rows = await source.select().from(table);
    totalRead += rows.length;

    if (!rows.length) {
      summary.push(`  ${name.padEnd(18)} 0`);
      continue;
    }

    if (dryRun) {
      summary.push(`  ${name.padEnd(18)} ${String(rows.length).padStart(5)}  (would copy)`);
      continue;
    }

    // No `.returning()`: `settings` is keyed on user_id rather than an `id`
    // column, so there is no single field every table can return. The verify
    // pass below compares real counts, which is the check that matters anyway.
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      try {
        await destination.insert(table).values(chunk as never).onConflictDoNothing();
      } catch (error) {
        console.error(
          `\n  ${name}: batch starting at row ${i} failed — ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        throw error;
      }
    }

    totalWritten += rows.length;
    summary.push(`  ${name.padEnd(18)} ${String(rows.length).padStart(5)}`);
  }

  console.log(dryRun ? "Would copy:" : "Copied:");
  console.log(summary.join("\n"));

  if (dryRun) {
    console.log(`\nDry run — nothing written. ${totalRead} rows would move.`);
  } else {
    console.log(`\n${totalWritten} of ${totalRead} rows written.`);
    console.log("\nVerifying…");
    let mismatch = false;
    for (const [name, table] of TABLES) {
      const [from, to] = await Promise.all([
        source.select().from(table),
        destination.select().from(table),
      ]);
      if (from.length !== to.length) {
        mismatch = true;
        console.log(`  MISMATCH ${name}: local ${from.length}, remote ${to.length}`);
      }
    }
    console.log(mismatch ? "\nCounts differ — investigate before switching over." : "Every table matches.");
  }

  await local.close();
  await pool.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
