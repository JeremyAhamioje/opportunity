import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings, users } from "@/lib/db/schema";
import { today } from "@/lib/domain/dates";
import { buildDigest } from "./digest";
import { isEmailConfigured, sendEmail } from "./resend";
import type { Settings, User } from "@/lib/db/schema";

/**
 * One send path, used by both the scheduled route and the "send now" button in
 * Settings, so a test proves the real thing rather than a lookalike.
 *
 * Outcomes are recorded on the settings row: `lastDigestSentAt` makes a repeat
 * call the same day a no-op, and `lastDigestError` means a failing integration
 * shows up in the UI instead of disappearing into a log nobody reads.
 */

export type DigestOutcome =
  | { status: "sent"; to: string; subject: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; error: string };

export function digestBaseUrl(): string {
  return (
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000"
  );
}

export async function sendDigestFor(
  user: User,
  config: Settings,
  options: {
    force?: boolean;
    /** One-off recipient, so a test can be aimed elsewhere without saving it. */
    to?: string;
  } = {},
): Promise<DigestOutcome> {
  const { force = false } = options;

  if (!isEmailConfigured()) {
    return { status: "skipped", reason: "RESEND_API_KEY is not set." };
  }
  if (!force && !config.notifyEnabled) {
    return { status: "skipped", reason: "Email reminders are turned off." };
  }

  const now = today();
  if (!force && config.lastDigestSentAt === now) {
    return { status: "skipped", reason: "Already sent today." };
  }

  const to = (options.to ?? config.notifyEmail ?? user.email).trim();
  if (!to) return { status: "skipped", reason: "No recipient address." };

  const digest = await buildDigest(user.id, config.scoringWeights, digestBaseUrl());

  // A mail that arrives every morning saying "nothing to do" is a mail you stop
  // opening — and then you miss the one that mattered. A manual send ignores
  // this, because the point of pressing the button is to see the thing.
  if (!force && digest.empty && config.notifyOnlyWhenDue) {
    return { status: "skipped", reason: "Nothing due today." };
  }

  const result = await sendEmail({
    to,
    subject: digest.subject,
    html: digest.html,
    text: digest.text,
  });

  const db = await getDb();

  if (!result.ok) {
    await db
      .update(settings)
      .set({ lastDigestError: result.error })
      .where(eq(settings.userId, user.id));
    return { status: "failed", error: result.error };
  }

  await db
    .update(settings)
    // A forced send still stamps the date: pressing "send now" means today's
    // digest has landed, and the scheduler should not send a second one.
    .set({ lastDigestSentAt: now, lastDigestError: null })
    .where(eq(settings.userId, user.id));

  return { status: "sent", to, subject: digest.subject };
}

/** Every account with reminders switched on. Single-user today, ready for more. */
export async function sendDigestToAll(): Promise<{
  sent: number;
  skipped: number;
  failed: number;
  details: DigestOutcome[];
}> {
  const db = await getDb();
  const rows = await db
    .select({ user: users, config: settings })
    .from(settings)
    .innerJoin(users, eq(settings.userId, users.id))
    .where(eq(settings.notifyEnabled, true));

  const details: DigestOutcome[] = [];
  for (const row of rows) {
    details.push(await sendDigestFor(row.user, row.config));
  }

  return {
    sent: details.filter((d) => d.status === "sent").length,
    skipped: details.filter((d) => d.status === "skipped").length,
    failed: details.filter((d) => d.status === "failed").length,
    details,
  };
}
