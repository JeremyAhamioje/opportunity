import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { actions, activities, companies, contacts, opportunities, responses } from "@/lib/db/schema";
import { addDays, today, urgencyOf, type DayString } from "@/lib/domain/dates";
import { scoreOf, type ScoreResult } from "@/lib/domain/scoring";
import { imageForOpportunity } from "@/lib/domain/imagery";
import {
  CLOSED_STAGES,
  OPEN_STAGES,
  SENT_STAGES,
  type Category,
  type ScoringWeights,
  type Stage,
} from "@/lib/domain/types";
import type { Company, Opportunity } from "@/lib/db/schema";

export type OpportunityRow = Opportunity & {
  companyName: string | null;
  companyWebsite: string | null;
  companyIndustry: string | null;
  companySize: string | null;
  score: ScoreResult;
  /** Stored image if one was chosen, otherwise derived from the row's own text. */
  image: string;
};

/**
 * Every opportunity gets a picture, whether or not one was stored — rows
 * created before the column existed, or by a path that did not set it, still
 * look like the rest of the board.
 */
export function decorateImage(
  row: Opportunity,
  industry?: string | null,
): string {
  return (
    row.imageUrl ??
    imageForOpportunity({
      category: row.category,
      title: row.title,
      industry: industry ?? null,
      problem: row.problemObserved,
      skills: row.skills,
      notes: row.notes,
    })
  );
}

const SELECT_WITH_COMPANY = {
  companyName: companies.name,
  companyWebsite: companies.website,
  companyIndustry: companies.industry,
  companySize: companies.size,
};

export type OpportunityFilters = {
  q?: string;
  category?: Category | "all";
  stage?: Stage | "all";
  status?: "open" | "closed" | "all";
  industry?: string;
  companySize?: string;
  minScore?: number;
  addedWithinDays?: number;
  followUpBefore?: DayString;
  sort?: "recent" | "score" | "followup" | "deadline" | "company";
  limit?: number;
};

/**
 * The one list query. Structural filters run in SQL; score filtering and
 * sorting run in memory, because the score is a weighted function of the user's
 * editable weights and so has no fixed value in the database.
 */
export async function listOpportunities(
  userId: string,
  weights: ScoringWeights,
  filters: OpportunityFilters = {},
): Promise<OpportunityRow[]> {
  const db = await getDb();
  const where = [eq(opportunities.userId, userId)];

  if (filters.category && filters.category !== "all") {
    where.push(eq(opportunities.category, filters.category));
  }
  if (filters.stage && filters.stage !== "all") {
    where.push(eq(opportunities.stage, filters.stage));
  }
  if (filters.status === "open") where.push(inArray(opportunities.stage, OPEN_STAGES));
  if (filters.status === "closed") where.push(inArray(opportunities.stage, CLOSED_STAGES));

  if (filters.industry) where.push(eq(companies.industry, filters.industry));
  if (filters.companySize) where.push(eq(companies.size, filters.companySize));

  if (filters.addedWithinDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - filters.addedWithinDays);
    where.push(gte(opportunities.createdAt, cutoff));
  }
  if (filters.followUpBefore) {
    where.push(isNotNull(opportunities.nextFollowUpAt));
    where.push(lte(opportunities.nextFollowUpAt, filters.followUpBefore));
  }

  const q = filters.q?.trim();
  if (q) {
    const needle = `%${q}%`;
    const match = or(
      ilike(opportunities.title, needle),
      ilike(opportunities.notes, needle),
      ilike(opportunities.problemObserved, needle),
      ilike(opportunities.proposedSolution, needle),
      ilike(opportunities.whyInterested, needle),
      ilike(opportunities.location, needle),
      ilike(opportunities.eligibility, needle),
      ilike(companies.name, needle),
      ilike(companies.industry, needle),
    );
    if (match) where.push(match);
  }

  const rows = await db
    .select({ opportunity: opportunities, ...SELECT_WITH_COMPANY })
    .from(opportunities)
    .leftJoin(companies, eq(opportunities.companyId, companies.id))
    .where(and(...where))
    .orderBy(desc(opportunities.createdAt))
    .limit(filters.limit ?? 500);

  let mapped: OpportunityRow[] = rows.map((row) => ({
    ...row.opportunity,
    companyName: row.companyName,
    companyWebsite: row.companyWebsite,
    companyIndustry: row.companyIndustry,
    companySize: row.companySize,
    score: scoreOf(row.opportunity, weights),
    image: decorateImage(row.opportunity, row.companyIndustry),
  }));

  if (typeof filters.minScore === "number" && filters.minScore > 0) {
    mapped = mapped.filter((row) => (row.score.total ?? -1) >= filters.minScore!);
  }

  return sortRows(mapped, filters.sort ?? "recent");
}

function sortRows(rows: OpportunityRow[], sort: NonNullable<OpportunityFilters["sort"]>) {
  const copy = [...rows];
  switch (sort) {
    case "score":
      return copy.sort((a, b) => (b.score.total ?? -1) - (a.score.total ?? -1));
    case "followup":
      return copy.sort((a, b) => nullsLast(a.nextFollowUpAt, b.nextFollowUpAt));
    case "deadline":
      return copy.sort((a, b) => nullsLast(a.deadline, b.deadline));
    case "company":
      return copy.sort((a, b) => (a.companyName ?? "").localeCompare(b.companyName ?? ""));
    default:
      return copy;
  }
}

function nullsLast(a: string | null, b: string | null) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

/* -------------------------------------------------------------------------- */
/*  Single opportunity, fully loaded                                          */
/* -------------------------------------------------------------------------- */

export async function getOpportunity(userId: string, id: string, weights: ScoringWeights) {
  const db = await getDb();

  const [row] = await db
    .select({ opportunity: opportunities, ...SELECT_WITH_COMPANY })
    .from(opportunities)
    .leftJoin(companies, eq(opportunities.companyId, companies.id))
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, userId)))
    .limit(1);

  if (!row) return null;

  const [company] = row.opportunity.companyId
    ? await db.select().from(companies).where(eq(companies.id, row.opportunity.companyId)).limit(1)
    : [null as Company | null];

  const [taskRows, responseRows, timeline, contactRows] = await Promise.all([
    db
      .select()
      .from(actions)
      .where(eq(actions.opportunityId, id))
      .orderBy(asc(actions.status), asc(actions.dueDate)),
    db
      .select()
      .from(responses)
      .where(eq(responses.opportunityId, id))
      .orderBy(desc(responses.receivedAt)),
    db
      .select()
      .from(activities)
      .where(eq(activities.opportunityId, id))
      .orderBy(desc(activities.occurredAt))
      .limit(60),
    row.opportunity.companyId
      ? db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.userId, userId),
              or(
                eq(contacts.companyId, row.opportunity.companyId),
                eq(contacts.opportunityId, id),
              )!,
            ),
          )
      : db.select().from(contacts).where(eq(contacts.opportunityId, id)),
  ]);

  return {
    opportunity: {
      ...row.opportunity,
      companyName: row.companyName,
      companyWebsite: row.companyWebsite,
      companyIndustry: row.companyIndustry,
      companySize: row.companySize,
      score: scoreOf(row.opportunity, weights),
    image: decorateImage(row.opportunity, row.companyIndustry),
    } satisfies OpportunityRow,
    company,
    actions: taskRows,
    responses: responseRows,
    activities: timeline,
    contacts: contactRows,
  };
}

/* -------------------------------------------------------------------------- */
/*  Follow-up desk                                                            */
/* -------------------------------------------------------------------------- */

export type FollowUpRow = OpportunityRow & { urgency: ReturnType<typeof urgencyOf> };

/** Everything with a follow-up date on or before `horizon`, most urgent first. */
export async function getFollowUps(
  userId: string,
  weights: ScoringWeights,
  horizonDays = 3,
): Promise<FollowUpRow[]> {
  const rows = await listOpportunities(userId, weights, {
    status: "open",
    followUpBefore: addDays(today(), horizonDays),
    sort: "followup",
  });
  return rows.map((row) => ({ ...row, urgency: urgencyOf(row.nextFollowUpAt) }));
}

/* -------------------------------------------------------------------------- */
/*  Aggregate counters for the dashboard                                      */
/* -------------------------------------------------------------------------- */

export type Summary = {
  active: number;
  sent: number;
  followUpsDue: number;
  overdue: number;
  positiveResponses: number;
  responses: number;
  addedThisWeek: number;
  won: number;
};

export async function getSummary(userId: string): Promise<Summary> {
  const db = await getDb();
  const now = today();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [counts] = await db
    .select({
      active: sql<number>`count(*) filter (where ${inArray(opportunities.stage, OPEN_STAGES)})::int`,
      sent: sql<number>`count(*) filter (where ${inArray(opportunities.stage, SENT_STAGES)})::int`,
      won: sql<number>`count(*) filter (where ${opportunities.stage} = 'won')::int`,
      followUpsDue: sql<number>`count(*) filter (where ${opportunities.nextFollowUpAt} <= ${now} and ${inArray(opportunities.stage, OPEN_STAGES)})::int`,
      overdue: sql<number>`count(*) filter (where ${opportunities.nextFollowUpAt} < ${now} and ${inArray(opportunities.stage, OPEN_STAGES)})::int`,
      addedThisWeek: sql<number>`count(*) filter (where ${opportunities.createdAt} >= ${weekAgo})::int`,
    })
    .from(opportunities)
    .where(eq(opportunities.userId, userId));

  const [responseCounts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      positive: sql<number>`count(*) filter (where ${responses.sentiment} = 'positive')::int`,
    })
    .from(responses)
    .where(eq(responses.userId, userId));

  return {
    active: counts?.active ?? 0,
    sent: counts?.sent ?? 0,
    followUpsDue: counts?.followUpsDue ?? 0,
    overdue: counts?.overdue ?? 0,
    won: counts?.won ?? 0,
    addedThisWeek: counts?.addedThisWeek ?? 0,
    responses: responseCounts?.total ?? 0,
    positiveResponses: responseCounts?.positive ?? 0,
  };
}

/**
 * Stage counts for the sales pipeline. Builds are excluded: they run the same
 * ten stages under different names, so counting them here would put "Idea" rows
 * into the Sourced column and have the dashboard tell you to go qualify them.
 */
export async function getStageCounts(userId: string): Promise<Record<Stage, number>> {
  const db = await getDb();
  const rows = await db
    .select({ stage: opportunities.stage, n: sql<number>`count(*)::int` })
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), ne(opportunities.category, "build")))
    .groupBy(opportunities.stage);

  const counts = Object.fromEntries(
    ([...OPEN_STAGES, ...CLOSED_STAGES] as Stage[]).map((stage) => [stage, 0]),
  ) as Record<Stage, number>;

  for (const row of rows) counts[row.stage] = row.n;
  return counts;
}

export async function getCategoryCounts(userId: string): Promise<Record<Category, number>> {
  const db = await getDb();
  const rows = await db
    .select({ category: opportunities.category, n: sql<number>`count(*)::int` })
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), inArray(opportunities.stage, OPEN_STAGES)))
    .groupBy(opportunities.category);

  const counts: Record<Category, number> = {
    workflow: 0,
    speculative: 0,
    job: 0,
    scholarship: 0,
    build: 0,
  };
  for (const row of rows) counts[row.category] = row.n;
  return counts;
}

/** Distinct values that actually appear, so filter dropdowns never offer dead ends. */
export async function getFilterOptions(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({ industry: companies.industry, size: companies.size })
    .from(companies)
    .where(eq(companies.userId, userId));

  return {
    industries: unique(rows.map((row) => row.industry)),
    sizes: unique(rows.map((row) => row.size)),
  };
}

function unique(values: (string | null)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))].sort();
}

export async function getRecentActivity(userId: string, limit = 12) {
  const db = await getDb();
  return db
    .select({
      activity: activities,
      opportunityTitle: opportunities.title,
      companyName: companies.name,
    })
    .from(activities)
    .leftJoin(opportunities, eq(activities.opportunityId, opportunities.id))
    .leftJoin(companies, eq(opportunities.companyId, companies.id))
    .where(eq(activities.userId, userId))
    .orderBy(desc(activities.occurredAt))
    .limit(limit);
}

/** Deadlines inside the window, closed opportunities excluded. */
export async function getUpcomingDeadlines(userId: string, weights: ScoringWeights, days = 30) {
  const db = await getDb();
  const rows = await db
    .select({ opportunity: opportunities, ...SELECT_WITH_COMPANY })
    .from(opportunities)
    .leftJoin(companies, eq(opportunities.companyId, companies.id))
    .where(
      and(
        eq(opportunities.userId, userId),
        inArray(opportunities.stage, OPEN_STAGES),
        isNotNull(opportunities.deadline),
        lte(opportunities.deadline, addDays(today(), days)),
      ),
    )
    .orderBy(asc(opportunities.deadline))
    .limit(20);

  return rows.map((row) => ({
    ...row.opportunity,
    companyName: row.companyName,
    companyWebsite: row.companyWebsite,
    companyIndustry: row.companyIndustry,
    companySize: row.companySize,
    score: scoreOf(row.opportunity, weights),
    image: decorateImage(row.opportunity, row.companyIndustry),
  })) satisfies OpportunityRow[];
}
