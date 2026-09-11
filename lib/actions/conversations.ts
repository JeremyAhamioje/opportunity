"use server";

import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/db/schema";
import { requireViewer } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import {
  deleteConversation,
  extractConversation,
  extractPending,
  storeConversation,
} from "@/lib/ingest/pipeline";
import { IngestError, normalizeConversation, parseTranscript } from "@/lib/ingest/normalize";
import { fail, refreshAll, str, type ActionResult } from "./shared";

/* -------------------------------------------------------------------------- */
/*  Capture                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Paste or upload. Accepts a raw transcript or the JSON shape the extension
 * sends, so a platform data export and a copy-paste both land in the same
 * pipeline.
 */
export async function ingestPastedConversation(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const text = str(form, "text");
  if (!text) return fail("Paste a conversation first.");

  const title = str(form, "title");

  try {
    // JSON first: an export or an extension payload should keep its real roles,
    // timestamps and ids rather than being flattened into speaker labels.
    const payload = asJson(text) ?? parseTranscript(text, title);
    if (title && typeof payload === "object" && payload !== null && !Array.isArray(payload)) {
      const record = payload as Record<string, unknown>;
      if (!record.title) record.title = title;
    }

    const normalized = normalizeConversation(payload);
    const stored = await storeConversation(user.id, normalized);

    refreshAll();
    return { ok: true, id: stored.conversationId };
  } catch (error) {
    if (error instanceof IngestError) return fail(error.message);
    return fail(error instanceof Error ? error.message : "Could not read that conversation.");
  }
}

function asJson(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    // A bare array is a messages list; wrap it so it matches the contract.
    if (Array.isArray(parsed)) {
      return { source: "manual", title: "Pasted conversation", messages: parsed };
    }
    return parsed;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/*  Extraction                                                                */
/* -------------------------------------------------------------------------- */

export async function runExtraction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const id = str(form, "id");

  const results = id
    ? [await extractConversation(user.id, id)]
    : await extractPending(user.id, 10);

  refreshAll();

  if (!results.length) return fail("Nothing is waiting to be read.");

  const failed = results.filter((result) => result.error);
  if (failed.length === results.length) {
    return fail(failed[0].error ?? "Extraction failed.");
  }

  const created = results.reduce((sum, result) => sum + result.created, 0);
  const dupes = results.reduce((sum, result) => sum + result.duplicatesSuggested, 0);

  return {
    ok: true,
    error: failed.length
      ? `${failed.length} of ${results.length} failed — see the conversation list.`
      : undefined,
    id: `${created} new, ${dupes} possible duplicates`,
  };
}

export async function removeConversation(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const id = str(form, "id");
  if (!id) return;
  await deleteConversation(user.id, id);
  refreshAll();
}

/* -------------------------------------------------------------------------- */
/*  Device token for the browser extension                                    */
/* -------------------------------------------------------------------------- */

/**
 * Generates a fresh token and returns it ONCE — only its hash is stored, so it
 * cannot be shown again. Regenerating revokes every installed extension, which
 * is the point: it is the revocation mechanism as well as the setup step.
 */
export async function regenerateIngestToken(
  _prev: ActionResult | null,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();

  const token = `oc_${randomBytes(24).toString("base64url")}`;

  await db
    .update(settings)
    .set({
      ingestTokenHash: await hashPassword(token),
      ingestTokenHint: token.slice(0, 9),
      ingestTokenCreatedAt: new Date(),
    })
    .where(eq(settings.userId, user.id));

  refreshAll();
  // Carried in `id` because it is the one field the result type can return, and
  // this value must reach the UI exactly once.
  return { ok: true, id: token };
}

export async function revokeIngestToken(): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();

  await db
    .update(settings)
    .set({ ingestTokenHash: null, ingestTokenHint: null, ingestTokenCreatedAt: null })
    .where(eq(settings.userId, user.id));

  refreshAll();
}
