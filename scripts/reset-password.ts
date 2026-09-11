/**
 * Resets an account password from the command line.
 *
 *   npm run reset:password -- you@example.com
 *
 * Generates a strong temporary password and prints it once. It is deliberately
 * NOT taken as an argument: anything typed on a command line lands in shell
 * history, and on this machine it can also be captured verbatim into a tool
 * permission allowlist. Change it in Settings after signing in.
 */

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { loadEnv } from "./env";
import { closeDb, getDb } from "../lib/db";
import { users } from "../lib/db/schema";
import { hashPassword } from "../lib/auth/password";

loadEnv();

/** Avoids look-alike characters so it can be retyped from a terminal. */
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function temporaryPassword(length = 20): string {
  const bytes = randomBytes(length);
  let out = "";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  // Guarantees it clears the "letter + number or symbol" rule in passwordProblem().
  return `${out}-7`;
}

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  const db = await getDb();

  const accounts = await db.select({ id: users.id, email: users.email }).from(users);

  if (!email) {
    console.error("Usage: npm run reset:password -- <email>\n\nAccounts on this instance:");
    for (const account of accounts) console.error(`  ${account.email}`);
    await closeDb();
    process.exit(1);
  }

  const account = accounts.find((row) => row.email.toLowerCase() === email);
  if (!account) {
    console.error(`No account for ${email}. Known: ${accounts.map((a) => a.email).join(", ")}`);
    await closeDb();
    process.exit(1);
  }

  const password = temporaryPassword();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(users.id, account.id));

  console.log(`\nPassword reset for ${account.email}\n`);
  console.log(`  ${password}\n`);
  console.log("Shown once. Sign in, then change it under Settings → Password.");
  console.log("Existing sessions stay valid — the session cookie is signed, not password-derived.");

  await closeDb();
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});
