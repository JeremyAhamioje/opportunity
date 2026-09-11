/**
 * Ingests a conversation from a file and (optionally) extracts it, without the
 * browser or the app running.
 *
 *   npm run ingest -- path/to/chat.md
 *   npm run ingest -- path/to/export.json --extract
 *   npm run ingest -- --extract-pending
 *
 * This is the same pipeline the extension and the paste box use — the only
 * difference is where the bytes come from. It exists so ingestion can be tested
 * and debugged with real output in front of you, and so a large platform export
 * does not have to go through a textarea.
 */

import { readFile } from "node:fs/promises";
import { loadEnv } from "./env";
import { basename } from "node:path";
import { closeDb, getDb } from "../lib/db";
import { users } from "../lib/db/schema";
import { normalizeConversation, parseTranscript } from "../lib/ingest/normalize";
import { extractConversation, extractPending, storeConversation } from "../lib/ingest/pipeline";
import { assertNotRunning } from "./guard";

// Before anything imports the AI provider and reads the key.
loadEnv();

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const extract = args.includes("--extract");
  const extractPendingOnly = args.includes("--extract-pending");
  const file = args.find((arg) => !arg.startsWith("--"));

  await assertNotRunning("this ingestion");

  const db = await getDb();
  const [user] = await db.select().from(users).orderBy(users.createdAt).limit(1);
  if (!user) {
    console.error("No account yet. Open the app and complete /setup first.");
    process.exit(1);
  }

  if (extractPendingOnly) {
    console.log("Reading everything still pending…\n");
    const results = await extractPending(user.id, 50);
    if (!results.length) console.log("Nothing pending.");
    for (const result of results) {
      console.log(
        result.error
          ? `  ✗ ${result.conversationId} — ${result.error}`
          : `  ✓ ${result.conversationId} — ${result.created} new, ${result.duplicatesSuggested} possible duplicates`,
      );
    }
    await closeDb();
    return;
  }

  if (!file) {
    console.error("Usage: npm run ingest -- <file> [--extract]   |   npm run ingest -- --extract-pending");
    process.exit(1);
  }

  const text = await readFile(file, "utf8");
  const payload = file.endsWith(".json")
    ? JSON.parse(text)
    : parseTranscript(text, basename(file).replace(/\.[^.]+$/, ""));

  const normalized = normalizeConversation(payload);
  const stored = await storeConversation(user.id, normalized);

  console.log(
    `${stored.created ? "Stored" : "Re-synced"} “${normalized.title}” — ` +
      `${stored.messageCount} messages, ${normalized.charCount.toLocaleString()} chars`,
  );

  if (extract) {
    console.log("\nExtracting…");
    const result = await extractConversation(user.id, stored.conversationId);
    if (result.error) {
      console.error(`  ✗ ${result.error}`);
    } else {
      console.log(
        `  ✓ ${result.insightsFound} entities → ${result.created} new insights, ` +
          `${result.duplicatesSuggested} possible duplicates`,
      );
      await report(user.id, stored.conversationId);
    }
  } else {
    console.log("\nQueued. Run with --extract, or press Read in the app.");
  }

  await closeDb();
}

/** Prints what was recovered, so a run can be judged rather than trusted. */
async function report(userId: string, conversationId: string): Promise<void> {
  const { getConversation } = await import("../lib/queries/insights");
  const data = await getConversation(userId, conversationId);
  if (!data?.insights.length) {
    console.log("\n  Nothing extracted — that is a valid answer for some conversations.");
    return;
  }

  console.log("");
  for (const insight of data.insights) {
    console.log(`  [${insight.kind}/${insight.stance}] ${insight.title}`);
    console.log(`      “${truncate(insight.excerpt, 96)}”`);
    if (insight.mentionCount > 1) {
      console.log(`      ${insight.mentionCount}× across all conversations`);
    }
  }
}

function truncate(value: string, max: number): string {
  const flat = value.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
