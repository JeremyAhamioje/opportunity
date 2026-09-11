import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { opportunities, responses } from "@/lib/db/schema";
import { OUTREACH_CATEGORIES, SENT_STAGES, type Category } from "@/lib/domain/types";
import { pct } from "@/lib/utils";

export type CategoryStats = {
  category: Category;
  total: number;
  sent: number;
  responses: number;
  positive: number;
  interviews: number;
  won: number;
  lost: number;
  responseRate: number;
  positiveRate: number;
};

/**
 * The question this page exists to answer: which kind of shot actually lands?
 *
 * "Sent" counts opportunities that reached a post-outreach stage — the shots
 * actually taken. Rates are measured against that, never against the pipeline,
 * or researching more companies would make the numbers look worse.
 */
export async function getCategoryStats(userId: string): Promise<CategoryStats[]> {
  const db = await getDb();

  const rows = await db
    .select({
      category: opportunities.category,
      total: sql<number>`count(*)::int`,
      sent: sql<number>`count(*) filter (where ${inArray(opportunities.stage, SENT_STAGES)})::int`,
      interviews: sql<number>`count(*) filter (where ${opportunities.stage} in ('interview','won'))::int`,
      won: sql<number>`count(*) filter (where ${opportunities.stage} = 'won')::int`,
      lost: sql<number>`count(*) filter (where ${opportunities.stage} = 'lost')::int`,
    })
    .from(opportunities)
    .where(eq(opportunities.userId, userId))
    .groupBy(opportunities.category);

  // Counted per opportunity, not per reply — three emails back is still one
  // opportunity that responded.
  const replyRows = await db
    .select({
      category: opportunities.category,
      replied: sql<number>`count(distinct ${responses.opportunityId})::int`,
      positive: sql<number>`count(distinct ${responses.opportunityId}) filter (where ${responses.sentiment} = 'positive')::int`,
    })
    .from(responses)
    .innerJoin(opportunities, eq(responses.opportunityId, opportunities.id))
    .where(eq(responses.userId, userId))
    .groupBy(opportunities.category);

  const byCategory = new Map(rows.map((row) => [row.category, row]));
  const byReply = new Map(replyRows.map((row) => [row.category, row]));

  // Builds are excluded on purpose: this table answers "which shots land?", and
  // a build is not a shot at anyone. Including it would divide by a `sent` count
  // that can never be anything but zero and drag every rate down with it.
  return OUTREACH_CATEGORIES.map((category) => {
    const base = byCategory.get(category);
    const reply = byReply.get(category);
    const sent = base?.sent ?? 0;
    const replied = reply?.replied ?? 0;
    const positive = reply?.positive ?? 0;

    return {
      category,
      total: base?.total ?? 0,
      sent,
      responses: replied,
      positive,
      interviews: base?.interviews ?? 0,
      won: base?.won ?? 0,
      lost: base?.lost ?? 0,
      responseRate: pct(replied, sent),
      positiveRate: pct(positive, sent),
    };
  });
}

export type WeeklyPoint = { week: string; label: string; sent: number; added: number };

/** Eight weeks of shots taken vs. opportunities added — is the funnel being fed? */
export async function getWeeklyActivity(userId: string, weeks = 8): Promise<WeeklyPoint[]> {
  const db = await getDb();

  const sentRows = await db
    .select({ day: opportunities.sentAt, n: sql<number>`count(*)::int` })
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), sql`${opportunities.sentAt} is not null`))
    .groupBy(opportunities.sentAt);

  const addedRows = await db
    .select({
      day: sql<string>`to_char(${opportunities.createdAt}, 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(opportunities)
    .where(eq(opportunities.userId, userId))
    .groupBy(sql`to_char(${opportunities.createdAt}, 'YYYY-MM-DD')`);

  const buckets = new Map<string, WeeklyPoint>();
  const now = new Date();
  const monday = (date: Date) => {
    const copy = new Date(date);
    const offset = (copy.getDay() + 6) % 7;
    copy.setDate(copy.getDate() - offset);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  for (let i = weeks - 1; i >= 0; i--) {
    const start = monday(now);
    start.setDate(start.getDate() - i * 7);
    const key = start.toISOString().slice(0, 10);
    buckets.set(key, {
      week: key,
      label: `${start.getDate()}/${start.getMonth() + 1}`,
      sent: 0,
      added: 0,
    });
  }

  const assign = (day: string | null, field: "sent" | "added", count: number) => {
    if (!day) return;
    const [y, m, d] = day.split("-").map(Number);
    if (!y || !m || !d) return;
    const key = monday(new Date(y, m - 1, d)).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (bucket) bucket[field] += count;
  };

  for (const row of sentRows) assign(row.day, "sent", row.n);
  for (const row of addedRows) assign(row.day, "added", row.n);

  return [...buckets.values()];
}

export type Funnel = { stage: string; label: string; count: number };

export async function getFunnel(userId: string): Promise<Funnel[]> {
  const db = await getDb();
  const [row] = await db
    .select({
      sourced: sql<number>`count(*)::int`,
      qualified: sql<number>`count(*) filter (where ${opportunities.stage} not in ('sourced','researching'))::int`,
      sent: sql<number>`count(*) filter (where ${inArray(opportunities.stage, SENT_STAGES)})::int`,
      responded: sql<number>`count(*) filter (where ${opportunities.stage} in ('response','interview','won'))::int`,
      interview: sql<number>`count(*) filter (where ${opportunities.stage} in ('interview','won'))::int`,
      won: sql<number>`count(*) filter (where ${opportunities.stage} = 'won')::int`,
    })
    .from(opportunities)
    .where(eq(opportunities.userId, userId));

  return [
    { stage: "sourced", label: "Sourced", count: row?.sourced ?? 0 },
    { stage: "qualified", label: "Qualified", count: row?.qualified ?? 0 },
    { stage: "sent", label: "Shot taken", count: row?.sent ?? 0 },
    { stage: "responded", label: "Responded", count: row?.responded ?? 0 },
    { stage: "interview", label: "Interview", count: row?.interview ?? 0 },
    { stage: "won", label: "Won", count: row?.won ?? 0 },
  ];
}
