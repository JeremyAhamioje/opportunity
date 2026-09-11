"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { requireViewer } from "@/lib/auth/guard";
import { sendDigestFor } from "@/lib/email/send-digest";
import { isEmailConfigured } from "@/lib/email/resend";
import { bool, fail, OK, refreshAll, str, type ActionResult } from "./shared";

export async function updateNotifications(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();

  const enabled = bool(form, "notifyEnabled");
  const address = str(form, "notifyEmail");

  if (address && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return fail("That does not look like an email address.");
  }
  if (enabled && !isEmailConfigured()) {
    return fail("RESEND_API_KEY is not set, so nothing could be sent.");
  }

  await db
    .update(settings)
    .set({
      notifyEnabled: enabled,
      // Empty means "use the account address" rather than "no address".
      notifyEmail: address,
      notifyOnlyWhenDue: bool(form, "notifyOnlyWhenDue"),
      // Turning it off clears a stale failure; leaving it would report an error
      // about a setting that no longer applies.
      lastDigestError: enabled ? undefined : null,
    })
    .where(eq(settings.userId, user.id));

  refreshAll();
  return OK;
}

/**
 * Sends the real digest immediately, bypassing the enabled flag, the
 * once-a-day guard and the quiet-when-empty rule — pressing the button means
 * you want to see the thing, whatever today happens to hold.
 */
export async function sendDigestNow(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user, settings: config } = await requireViewer();

  const to = str(form, "to");
  if (to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return fail("That does not look like an email address.");
  }

  const outcome = await sendDigestFor(user, config, { force: true, to: to ?? undefined });
  refreshAll();

  if (outcome.status === "sent") {
    return { ok: true, id: `Sent to ${outcome.to}` };
  }
  return fail(outcome.status === "failed" ? outcome.error : outcome.reason);
}
