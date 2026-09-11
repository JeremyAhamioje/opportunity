"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { insightLinks, insightMentions, insights, opportunities } from "@/lib/db/schema";
import { requireViewer } from "@/lib/auth/guard";
import { imageForOpportunity } from "@/lib/domain/imagery";
import {
  INSIGHT_KINDS,
  INSIGHT_STATUSES,
  insightKey,
  STANCES,
  type InsightKind,
  type InsightStatus,
  type Stance,
} from "@/lib/domain/archaeology";
import { recountInsights } from "@/lib/ingest/resolve";
import {
  day,
  enumValue,
  fail,
  logActivity,
  OK,
  refreshAll,
  str,
  type ActionResult,
} from "./shared";

/* -------------------------------------------------------------------------- */
/*  Editing — the model proposes, the user owns                               */
/* -------------------------------------------------------------------------- */

export async function updateInsight(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return fail("Missing insight.");

  const title = str(form, "title");
  if (!title) return fail("A title is required.");

  await db
    .update(insights)
    .set({
      title,
      // Renaming re-keys it, so a corrected name starts matching future mentions.
      dedupeKey: insightKey(title),
      kind: enumValue<InsightKind>(form, "kind", INSIGHT_KINDS, "idea"),
      stance: enumValue<Stance>(form, "stance", STANCES, "discussed"),
      summary: str(form, "summary"),
      detail: str(form, "detail"),
      notes: str(form, "notes"),
      dueDate: day(form, "dueDate"),
      // Marks it as human-owned: re-extraction will not overwrite these again.
      edited: true,
    })
    .where(and(eq(insights.id, id), eq(insights.userId, user.id)));

  refreshAll();
  return OK;
}

export async function setInsightStatus(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  await db
    .update(insights)
    .set({ status: enumValue<InsightStatus>(form, "status", INSIGHT_STATUSES, "open") })
    .where(and(eq(insights.id, id), eq(insights.userId, user.id)));

  refreshAll();
}

export async function togglePinned(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  await db
    .update(insights)
    .set({ pinned: sql`not ${insights.pinned}` })
    .where(and(eq(insights.id, id), eq(insights.userId, user.id)));

  refreshAll();
}

export async function deleteInsight(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  await db.delete(insights).where(and(eq(insights.id, id), eq(insights.userId, user.id)));
  refreshAll();
  redirect("/ideas");
}

/* -------------------------------------------------------------------------- */
/*  Promotion — the one bridge into real work                                 */
/* -------------------------------------------------------------------------- */

/**
 * Turns an insight into a `build` opportunity on the existing spine. From this
 * point the pipeline, follow-up desk, Today view, digest and analytics treat it
 * like anything else — which is the entire reason the archaeology layer does
 * not carry its own scheduling, scoring or reminder machinery.
 *
 * Recovered ideas therefore cannot flood the pipeline: nothing crosses this
 * line without a deliberate click.
 */
export async function promoteInsight(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user, settings: config } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return fail("Missing insight.");

  const [insight] = await db
    .select()
    .from(insights)
    .where(and(eq(insights.id, id), eq(insights.userId, user.id)))
    .limit(1);
  if (!insight) return fail("Insight not found.");
  if (insight.opportunityId) return fail("This has already been promoted.");

  const title = str(form, "title") ?? insight.title;
  const firstStep = str(form, "firstStep");

  // The evidence trail travels with it, so the build can still answer "why did
  // I think this was worth doing?" long after the conversation is forgotten.
  const excerpts = await db
    .select({ excerpt: insightMentions.excerpt, occurredAt: insightMentions.occurredAt })
    .from(insightMentions)
    .where(eq(insightMentions.insightId, id))
    .orderBy(insightMentions.occurredAt)
    .limit(6);

  const dump = [
    insight.summary,
    insight.detail,
    excerpts.length
      ? `\nFrom your own conversations:\n${excerpts
          .map((row) => `• ${row.occurredAt.toISOString().slice(0, 10)} — “${row.excerpt}”`)
          .join("\n")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const [created] = await db
    .insert(opportunities)
    .values({
      userId: user.id,
      category: "build",
      title,
      stage: "sourced",
      notes: insight.notes,
      brainDump: dump || null,
      whatItProves: str(form, "whatItProves"),
      firstStep,
      scopeEstimate: str(form, "scopeEstimate"),
      deadline: day(form, "deadline"),
      imageUrl: imageForOpportunity({
        category: "build",
        title,
        notes: insight.summary ?? insight.detail,
      }),
      // Recovered from history, so it starts on the same cadence as anything
      // else — otherwise it is archived twice instead of worked on once.
      nextFollowUpAt: null,
    })
    .returning({ id: opportunities.id });

  await db
    .update(insights)
    .set({ status: "promoted", opportunityId: created.id })
    .where(eq(insights.id, id));

  await logActivity({
    userId: user.id,
    opportunityId: created.id,
    kind: "created",
    message: `Promoted from a recovered ${insight.kind} — first seen ${
      insight.firstSeenAt?.toISOString().slice(0, 10) ?? "unknown"
    }, mentioned ${insight.mentionCount}×`,
  });

  refreshAll();
  void config;
  return { ok: true, id: created.id };
}

/* -------------------------------------------------------------------------- */
/*  Duplicate review                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Merges the loser into the survivor: every mention moves across, links are
 * re-pointed, counts are recomputed from the moved rows. Nothing is estimated
 * and no provenance is lost — after a merge the survivor can still show every
 * original excerpt, which is what makes a merge safe to offer at all.
 */
export async function mergeInsights(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const keepId = str(form, "keepId");
  const dropId = str(form, "dropId");
  if (!keepId || !dropId || keepId === dropId) return;

  const rows = await db
    .select({ id: insights.id, opportunityId: insights.opportunityId })
    .from(insights)
    .where(and(eq(insights.userId, user.id), sql`${insights.id} in (${keepId}, ${dropId})`));
  if (rows.length !== 2) return;

  await db
    .update(insightMentions)
    .set({ insightId: keepId })
    .where(and(eq(insightMentions.insightId, dropId), eq(insightMentions.userId, user.id)));

  // Re-point links, then drop any that now point at themselves.
  await db
    .update(insightLinks)
    .set({ fromId: keepId })
    .where(and(eq(insightLinks.fromId, dropId), eq(insightLinks.userId, user.id)));
  await db
    .update(insightLinks)
    .set({ toId: keepId })
    .where(and(eq(insightLinks.toId, dropId), eq(insightLinks.userId, user.id)));
  await db
    .delete(insightLinks)
    .where(and(eq(insightLinks.userId, user.id), eq(insightLinks.fromId, insightLinks.toId)));

  await db.delete(insights).where(and(eq(insights.id, dropId), eq(insights.userId, user.id)));
  await recountInsights(db, user.id, [keepId]);

  refreshAll();
}

/** "Keep separate" — a rejected suggestion never comes back. */
export async function rejectLink(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const linkId = str(form, "linkId");
  if (!linkId) return;

  await db
    .update(insightLinks)
    .set({ status: "rejected" })
    .where(and(eq(insightLinks.id, linkId), eq(insightLinks.userId, user.id)));

  refreshAll();
}

export async function confirmLink(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const linkId = str(form, "linkId");
  if (!linkId) return;

  await db
    .update(insightLinks)
    .set({ status: "confirmed" })
    .where(
      and(
        eq(insightLinks.id, linkId),
        eq(insightLinks.userId, user.id),
        ne(insightLinks.kind, "duplicate_of"),
      ),
    );

  refreshAll();
}
