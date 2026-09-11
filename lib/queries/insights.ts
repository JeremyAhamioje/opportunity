import { and, asc, desc, eq, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import {
  conversations,
  insightLinks,
  insightMentions,
  insights,
  messages,
  opportunities,
} from "@/lib/db/schema";
import {
  FORGOTTEN,
  RECURRING_MIN_MENTIONS,
  type InsightKind,
  type InsightStatus,
  type Stance,
} from "@/lib/domain/archaeology";
import type { Conversation, Insight } from "@/lib/db/schema";

export type InsightRow = Insight & { conversationCount: number };

/* -------------------------------------------------------------------------- */
/*  Lists                                                                     */
/* -------------------------------------------------------------------------- */

export type InsightFilters = {
  kind?: InsightKind | null;
  status?: InsightStatus | null;
  stance?: Stance | null;
  search?: string | null;
  sort?: "recent" | "mentions" | "oldest" | "title";
};

export async function listInsights(
  userId: string,
  filters: InsightFilters = {},
): Promise<InsightRow[]> {
  const db = await getDb();

  const clauses = [eq(insights.userId, userId)];
  if (filters.kind) clauses.push(eq(insights.kind, filters.kind));
  if (filters.status) clauses.push(eq(insights.status, filters.status));
  if (filters.stance) clauses.push(eq(insights.stance, filters.stance));
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    clauses.push(
      or(
        sql`lower(${insights.title}) like ${term}`,
        sql`lower(coalesce(${insights.summary}, '')) like ${term}`,
        sql`lower(coalesce(${insights.detail}, '')) like ${term}`,
      )!,
    );
  }

  const order =
    filters.sort === "mentions"
      ? [desc(insights.mentionCount), desc(insights.lastSeenAt)]
      : filters.sort === "oldest"
        ? [asc(insights.firstSeenAt)]
        : filters.sort === "title"
          ? [asc(insights.title)]
          : [desc(insights.lastSeenAt), desc(insights.createdAt)];

  const rows = await db
    .select()
    .from(insights)
    .where(and(...clauses))
    .orderBy(desc(insights.pinned), ...order)
    .limit(400);

  return rows.map((row) => ({ ...row, conversationCount: row.mentionCount }));
}

/**
 * Ideas that keep coming back. Frequency is a signal of interest, not of value
 * — the UI says so, because "mentioned 24 times" is not an argument for doing
 * something.
 */
export async function getRecurring(userId: string, limit = 20): Promise<InsightRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.userId, userId),
        gte(insights.mentionCount, RECURRING_MIN_MENTIONS),
        ne(insights.status, "archived"),
        ne(insights.status, "dropped"),
      ),
    )
    .orderBy(desc(insights.mentionCount), desc(insights.lastSeenAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, conversationCount: row.mentionCount }));
}

/**
 * Developed enough to matter, never explicitly dropped, and gone quiet.
 *
 * The stance filter is what stops this becoming a guilt list: something you
 * decided against is not forgotten, it is decided, and it must never resurface
 * here asking to be revived.
 */
export async function getForgotten(userId: string, limit = 20): Promise<InsightRow[]> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - FORGOTTEN.quietDays * 86_400_000);

  const rows = await db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.userId, userId),
        eq(insights.status, "open"),
        ne(insights.stance, "abandoned"),
        gte(insights.mentionCount, FORGOTTEN.minMentions),
        lt(insights.lastSeenAt, cutoff),
        isNull(insights.opportunityId),
      ),
    )
    .orderBy(desc(insights.mentionCount), asc(insights.lastSeenAt))
    .limit(limit);

  return rows.map((row) => ({ ...row, conversationCount: row.mentionCount }));
}

/**
 * "You said you would" — explicit commitments only.
 *
 * A proposed or merely discussed intention is not a promise, and listing it as
 * one is how this feature would turn into a machine for making someone feel
 * behind on things they never actually agreed to do.
 */
export async function getCommitments(userId: string, limit = 50): Promise<InsightRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(insights)
    .where(
      and(
        eq(insights.userId, userId),
        eq(insights.kind, "commitment"),
        eq(insights.status, "open"),
        eq(insights.stance, "explicit"),
      ),
    )
    .orderBy(
      // Dated promises first, soonest at the top; undated ones after.
      sql`${insights.dueDate} is null`,
      asc(insights.dueDate),
      desc(insights.mentionCount),
    )
    .limit(limit);

  return rows.map((row) => ({ ...row, conversationCount: row.mentionCount }));
}

/* -------------------------------------------------------------------------- */
/*  Detail                                                                    */
/* -------------------------------------------------------------------------- */

export type MentionRow = {
  id: string;
  excerpt: string;
  movement: string | null;
  occurredAt: Date;
  conversationId: string;
  conversationTitle: string;
  conversationSource: string;
  conversationUrl: string | null;
  messageId: string | null;
};

export type LinkedInsight = {
  linkId: string;
  kind: string;
  status: string;
  reason: string | null;
  direction: "out" | "in";
  insight: Pick<Insight, "id" | "title" | "kind" | "status" | "mentionCount">;
};

export type InsightDetail = {
  insight: Insight;
  mentions: MentionRow[];
  links: LinkedInsight[];
  promoted: { id: string; title: string } | null;
};

export async function getInsight(userId: string, id: string): Promise<InsightDetail | null> {
  const db = await getDb();

  const [insight] = await db
    .select()
    .from(insights)
    .where(and(eq(insights.id, id), eq(insights.userId, userId)))
    .limit(1);
  if (!insight) return null;

  const [mentionRows, outgoing, incoming, promoted] = await Promise.all([
    db
      .select({
        id: insightMentions.id,
        excerpt: insightMentions.excerpt,
        movement: insightMentions.movement,
        occurredAt: insightMentions.occurredAt,
        conversationId: insightMentions.conversationId,
        messageId: insightMentions.messageId,
        conversationTitle: conversations.title,
        conversationSource: conversations.source,
        conversationUrl: conversations.url,
      })
      .from(insightMentions)
      .innerJoin(conversations, eq(insightMentions.conversationId, conversations.id))
      .where(eq(insightMentions.insightId, id))
      .orderBy(asc(insightMentions.occurredAt)),

    db
      .select({
        linkId: insightLinks.id,
        kind: insightLinks.kind,
        status: insightLinks.status,
        reason: insightLinks.reason,
        id: insights.id,
        title: insights.title,
        insightKind: insights.kind,
        insightStatus: insights.status,
        mentionCount: insights.mentionCount,
      })
      .from(insightLinks)
      .innerJoin(insights, eq(insightLinks.toId, insights.id))
      .where(and(eq(insightLinks.fromId, id), ne(insightLinks.status, "rejected"))),

    db
      .select({
        linkId: insightLinks.id,
        kind: insightLinks.kind,
        status: insightLinks.status,
        reason: insightLinks.reason,
        id: insights.id,
        title: insights.title,
        insightKind: insights.kind,
        insightStatus: insights.status,
        mentionCount: insights.mentionCount,
      })
      .from(insightLinks)
      .innerJoin(insights, eq(insightLinks.fromId, insights.id))
      .where(and(eq(insightLinks.toId, id), ne(insightLinks.status, "rejected"))),

    insight.opportunityId
      ? db
          .select({ id: opportunities.id, title: opportunities.title })
          .from(opportunities)
          .where(eq(opportunities.id, insight.opportunityId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  const shape = (row: (typeof outgoing)[number], direction: "out" | "in"): LinkedInsight => ({
    linkId: row.linkId,
    kind: row.kind,
    status: row.status,
    reason: row.reason,
    direction,
    insight: {
      id: row.id,
      title: row.title,
      kind: row.insightKind,
      status: row.insightStatus,
      mentionCount: row.mentionCount,
    },
  });

  return {
    insight,
    mentions: mentionRows,
    links: [...outgoing.map((r) => shape(r, "out")), ...incoming.map((r) => shape(r, "in"))],
    promoted,
  };
}

/* -------------------------------------------------------------------------- */
/*  Duplicate review queue                                                    */
/* -------------------------------------------------------------------------- */

export type DuplicatePair = {
  linkId: string;
  reason: string | null;
  confidence: number | null;
  left: Pick<Insight, "id" | "title" | "kind" | "summary" | "mentionCount" | "lastSeenAt">;
  right: Pick<Insight, "id" | "title" | "kind" | "summary" | "mentionCount" | "lastSeenAt">;
};

export async function getDuplicateSuggestions(userId: string): Promise<DuplicatePair[]> {
  const db = await getDb();
  // Both sides of a duplicate pair come from `insights`, so the join needs two
  // distinct aliases for the same table.
  const left = alias(insights, "left_insight");
  const right = alias(insights, "right_insight");

  const rows = await db
    .select({
      linkId: insightLinks.id,
      reason: insightLinks.reason,
      confidence: insightLinks.confidence,
      leftId: left.id,
      leftTitle: left.title,
      leftKind: left.kind,
      leftSummary: left.summary,
      leftMentions: left.mentionCount,
      leftSeen: left.lastSeenAt,
      rightId: right.id,
      rightTitle: right.title,
      rightKind: right.kind,
      rightSummary: right.summary,
      rightMentions: right.mentionCount,
      rightSeen: right.lastSeenAt,
    })
    .from(insightLinks)
    .innerJoin(left, eq(insightLinks.fromId, left.id))
    .innerJoin(right, eq(insightLinks.toId, right.id))
    .where(
      and(
        eq(insightLinks.userId, userId),
        eq(insightLinks.kind, "duplicate_of"),
        eq(insightLinks.status, "suggested"),
      ),
    )
    .orderBy(desc(insightLinks.confidence))
    .limit(50);

  return rows.map((row) => ({
    linkId: row.linkId,
    reason: row.reason,
    confidence: row.confidence,
    left: {
      id: row.leftId,
      title: row.leftTitle,
      kind: row.leftKind,
      summary: row.leftSummary,
      mentionCount: row.leftMentions,
      lastSeenAt: row.leftSeen,
    },
    right: {
      id: row.rightId,
      title: row.rightTitle,
      kind: row.rightKind,
      summary: row.rightSummary,
      mentionCount: row.rightMentions,
      lastSeenAt: row.rightSeen,
    },
  }));
}

/* -------------------------------------------------------------------------- */
/*  Conversations                                                             */
/* -------------------------------------------------------------------------- */

export async function listConversations(userId: string, limit = 200): Promise<Conversation[]> {
  const db = await getDb();
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.capturedAt))
    .limit(limit);
}

export async function getConversation(userId: string, id: string) {
  const db = await getDb();
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  if (!conversation) return null;

  const [rows, cited] = await Promise.all([
    db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(asc(messages.position)),
    db
      .select({
        id: insights.id,
        title: insights.title,
        kind: insights.kind,
        stance: insights.stance,
        status: insights.status,
        mentionCount: insights.mentionCount,
        excerpt: insightMentions.excerpt,
      })
      .from(insightMentions)
      .innerJoin(insights, eq(insightMentions.insightId, insights.id))
      .where(eq(insightMentions.conversationId, id)),
  ]);

  return { conversation, messages: rows, insights: cited };
}

/* -------------------------------------------------------------------------- */
/*  Summary                                                                   */
/* -------------------------------------------------------------------------- */

export type ArchaeologySummary = {
  conversations: number;
  pending: number;
  failed: number;
  insights: number;
  byKind: Record<string, number>;
  commitments: number;
  overdueCommitments: number;
  forgotten: number;
  recurring: number;
  duplicates: number;
};

export async function getArchaeologySummary(userId: string): Promise<ArchaeologySummary> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - FORGOTTEN.quietDays * 86_400_000);
  const todayIso = new Date().toISOString().slice(0, 10);

  const [convo, kinds, extra, dupes] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${conversations.status} = 'pending')::int`,
        failed: sql<number>`count(*) filter (where ${conversations.status} = 'failed')::int`,
      })
      .from(conversations)
      .where(eq(conversations.userId, userId)),

    db
      .select({ kind: insights.kind, n: sql<number>`count(*)::int` })
      .from(insights)
      .where(and(eq(insights.userId, userId), ne(insights.status, "archived")))
      .groupBy(insights.kind),

    db
      .select({
        commitments: sql<number>`count(*) filter (where ${insights.kind} = 'commitment' and ${insights.status} = 'open' and ${insights.stance} = 'explicit')::int`,
        overdue: sql<number>`count(*) filter (where ${insights.kind} = 'commitment' and ${insights.status} = 'open' and ${insights.stance} = 'explicit' and ${insights.dueDate} is not null and ${insights.dueDate} < ${todayIso})::int`,
        forgotten: sql<number>`count(*) filter (where ${insights.status} = 'open' and ${insights.stance} <> 'abandoned' and ${insights.mentionCount} >= ${FORGOTTEN.minMentions} and ${insights.lastSeenAt} < ${cutoff} and ${insights.opportunityId} is null)::int`,
        recurring: sql<number>`count(*) filter (where ${insights.mentionCount} >= ${RECURRING_MIN_MENTIONS} and ${insights.status} not in ('archived','dropped'))::int`,
      })
      .from(insights)
      .where(eq(insights.userId, userId)),

    db
      .select({ n: sql<number>`count(*)::int` })
      .from(insightLinks)
      .where(
        and(
          eq(insightLinks.userId, userId),
          eq(insightLinks.kind, "duplicate_of"),
          eq(insightLinks.status, "suggested"),
        ),
      ),
  ]);

  const byKind: Record<string, number> = {};
  let total = 0;
  for (const row of kinds) {
    byKind[row.kind] = row.n;
    total += row.n;
  }

  return {
    conversations: convo[0]?.total ?? 0,
    pending: convo[0]?.pending ?? 0,
    failed: convo[0]?.failed ?? 0,
    insights: total,
    byKind,
    commitments: extra[0]?.commitments ?? 0,
    overdueCommitments: extra[0]?.overdue ?? 0,
    forgotten: extra[0]?.forgotten ?? 0,
    recurring: extra[0]?.recurring ?? 0,
    duplicates: dupes[0]?.n ?? 0,
  };
}
