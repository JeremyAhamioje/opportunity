import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { insightLinks, insightMentions, insights } from "@/lib/db/schema";
import {
  DUPLICATE_THRESHOLD,
  insightKey,
  keySimilarity,
  type InsightKind,
} from "@/lib/domain/archaeology";
import type { ExtractedEntity } from "@/lib/ai/provider";

/**
 * Entity resolution: deciding whether this is a thing we have seen before.
 *
 * Three outcomes, in order of confidence:
 *   1. Exact key match  → the same insight. A new mention, not a new row.
 *   2. Near key match   → a new insight PLUS a suggested `duplicate_of` link.
 *   3. No match         → a new insight.
 *
 * Case 2 never merges on its own. Silently collapsing two ideas that only
 * looked alike destroys information the user cannot get back, whereas an
 * unreviewed suggestion costs one click. See docs/archaeology.md.
 */

export type ResolvedEntity = {
  insightId: string;
  title: string;
  created: boolean;
  duplicateOf: string | null;
};

type Candidate = { id: string; title: string; dedupeKey: string; kind: InsightKind };

export async function resolveEntity(
  db: Database,
  userId: string,
  entity: ExtractedEntity,
): Promise<ResolvedEntity> {
  const key = insightKey(entity.title);

  const [exact] = await db
    .select({ id: insights.id, title: insights.title })
    .from(insights)
    .where(and(eq(insights.userId, userId), eq(insights.dedupeKey, key)))
    .limit(1);

  if (exact) {
    await widenStance(db, exact.id, entity);
    return { insightId: exact.id, title: exact.title, created: false, duplicateOf: null };
  }

  const near = await findNearest(db, userId, key, entity.kind);

  const [created] = await db
    .insert(insights)
    .values({
      userId,
      kind: entity.kind,
      title: entity.title,
      summary: entity.summary,
      detail: entity.detail,
      dedupeKey: key,
      stance: entity.stance,
      confidence: entity.confidence,
      dueDate: entity.dueDate,
    })
    .returning({ id: insights.id, title: insights.title });

  if (near) {
    await db
      .insert(insightLinks)
      .values({
        userId,
        fromId: created.id,
        toId: near.id,
        kind: "duplicate_of",
        confidence: Math.round(near.score * 100),
        status: "suggested",
        reason: `Titles overlap ${Math.round(near.score * 100)}%: “${entity.title}” / “${near.title}”`,
      })
      .onConflictDoNothing();
  }

  return {
    insightId: created.id,
    title: created.title,
    created: true,
    duplicateOf: near?.id ?? null,
  };
}

/**
 * Scans this user's insights of the same kind for the closest title. A full
 * scan is correct at personal scale (thousands of rows, one user) and keeps the
 * comparison exact; swapping in vector search later changes only this function.
 */
async function findNearest(
  db: Database,
  userId: string,
  key: string,
  kind: InsightKind,
): Promise<{ id: string; title: string; score: number } | null> {
  const rows: Candidate[] = await db
    .select({
      id: insights.id,
      title: insights.title,
      dedupeKey: insights.dedupeKey,
      kind: insights.kind,
    })
    .from(insights)
    .where(and(eq(insights.userId, userId), eq(insights.kind, kind)));

  let best: { id: string; title: string; score: number } | null = null;
  for (const row of rows) {
    const score = keySimilarity(key, row.dedupeKey);
    if (score >= DUPLICATE_THRESHOLD && (!best || score > best.score)) {
      best = { id: row.id, title: row.title, score };
    }
  }
  return best;
}

/**
 * A later mention can only firm an insight up, never soften it — except that
 * an explicit abandonment always wins, because "I'm not doing this" is the most
 * recent word on the subject and the whole point of tracking stance.
 *
 * Fields a human has edited are never touched: the model proposes, the user owns.
 */
async function widenStance(
  db: Database,
  insightId: string,
  entity: ExtractedEntity,
): Promise<void> {
  const [current] = await db
    .select({ stance: insights.stance, edited: insights.edited, dueDate: insights.dueDate })
    .from(insights)
    .where(eq(insights.id, insightId))
    .limit(1);
  if (!current || current.edited) return;

  const RANK = { abandoned: 0, discussed: 1, proposed: 2, explicit: 3 } as const;
  const stance =
    entity.stance === "abandoned" || RANK[entity.stance] > RANK[current.stance]
      ? entity.stance
      : current.stance;

  await db
    .update(insights)
    .set({ stance, dueDate: entity.dueDate ?? current.dueDate })
    .where(eq(insights.id, insightId));
}

/* -------------------------------------------------------------------------- */
/*  Counters                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Recomputes mention counts and first/last dates from the mention rows.
 *
 * Deliberately a recount rather than an increment: these numbers drive
 * "recurring" and "forgotten", which are the two claims this feature makes
 * about a person's own history. A drifting counter would make both quietly
 * wrong, and a merge or a deletion would leave them wrong forever.
 */
export async function recountInsights(
  db: Database,
  userId: string,
  insightIds: string[],
): Promise<void> {
  if (!insightIds.length) return;

  await db
    .update(insights)
    .set({
      mentionCount: sql`(select count(*)::int from ${insightMentions} where ${insightMentions.insightId} = ${insights.id})`,
      firstSeenAt: sql`(select min(${insightMentions.occurredAt}) from ${insightMentions} where ${insightMentions.insightId} = ${insights.id})`,
      lastSeenAt: sql`(select max(${insightMentions.occurredAt}) from ${insightMentions} where ${insightMentions.insightId} = ${insights.id})`,
    })
    .where(and(eq(insights.userId, userId), inArray(insights.id, insightIds)));
}
