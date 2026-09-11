import { and, asc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { actions, activities, companies, opportunities } from "@/lib/db/schema";
import { addDays, today, urgencyOf } from "@/lib/domain/dates";
import { scoreOf } from "@/lib/domain/scoring";
import { OPEN_STAGES, type DailyGoal, type GoalMetric, type ScoringWeights } from "@/lib/domain/types";
import {
  decorateImage,
  getFollowUps,
  type FollowUpRow,
  type OpportunityRow,
} from "./opportunities";

export type GoalProgress = DailyGoal & { done: number; complete: boolean };

export type TodayView = {
  followUps: FollowUpRow[];
  toSubmit: OpportunityRow[];
  toResearch: OpportunityRow[];
  fresh: OpportunityRow[];
  dueTasks: (typeof actions.$inferSelect & { opportunityTitle: string; companyName: string | null })[];
  goals: GoalProgress[];
  goalsComplete: number;
  totalShots: number;
};

/**
 * The daily execution screen. Everything here answers one question — what
 * should I do next — so each list is capped and ordered by what would hurt most
 * to miss.
 */
export async function getTodayView(
  userId: string,
  weights: ScoringWeights,
  goals: DailyGoal[],
): Promise<TodayView> {
  const db = await getDb();
  const now = today();

  const withCompany = {
    companyName: companies.name,
    companyWebsite: companies.website,
    companyIndustry: companies.industry,
    companySize: companies.size,
  };

  const decorate = (row: {
    opportunity: typeof opportunities.$inferSelect;
    companyName: string | null;
    companyWebsite: string | null;
    companyIndustry: string | null;
    companySize: string | null;
  }): OpportunityRow => ({
    ...row.opportunity,
    companyName: row.companyName,
    companyWebsite: row.companyWebsite,
    companyIndustry: row.companyIndustry,
    companySize: row.companySize,
    score: scoreOf(row.opportunity, weights),
    image: decorateImage(row.opportunity, row.companyIndustry),
  });

  const [followUps, submitRows, researchRows, freshRows, taskRows, counters] = await Promise.all([
    // Overdue and due today only — "due soon" is not today's problem.
    getFollowUps(userId, weights, 0),

    db
      .select({ opportunity: opportunities, ...withCompany })
      .from(opportunities)
      .leftJoin(companies, eq(opportunities.companyId, companies.id))
      .where(
        and(
          eq(opportunities.userId, userId),
          or(
            eq(opportunities.stage, "ready"),
            and(
              inArray(opportunities.stage, ["sourced", "researching", "qualified"]),
              sql`${opportunities.deadline} is not null`,
              lte(opportunities.deadline, addDays(now, 7)),
            ),
          )!,
        ),
      )
      .orderBy(asc(opportunities.deadline))
      .limit(25),

    db
      .select({ opportunity: opportunities, ...withCompany })
      .from(opportunities)
      .leftJoin(companies, eq(opportunities.companyId, companies.id))
      .where(and(eq(opportunities.userId, userId), eq(opportunities.stage, "researching")))
      .orderBy(asc(opportunities.updatedAt))
      .limit(15),

    db
      .select({ opportunity: opportunities, ...withCompany })
      .from(opportunities)
      .leftJoin(companies, eq(opportunities.companyId, companies.id))
      .where(and(eq(opportunities.userId, userId), eq(opportunities.stage, "sourced")))
      .orderBy(asc(opportunities.createdAt))
      .limit(15),

    db
      .select({ action: actions, opportunityTitle: opportunities.title, companyName: companies.name })
      .from(actions)
      .innerJoin(opportunities, eq(actions.opportunityId, opportunities.id))
      .leftJoin(companies, eq(opportunities.companyId, companies.id))
      .where(
        and(
          eq(actions.userId, userId),
          ne(actions.status, "done"),
          ne(actions.status, "skipped"),
          sql`${actions.dueDate} is not null`,
          lte(actions.dueDate, now),
        ),
      )
      .orderBy(asc(actions.dueDate))
      .limit(25),

    countToday(userId),
  ]);

  const goalProgress: GoalProgress[] = goals.map((goal) => {
    const done = counters[goal.metric] ?? 0;
    return { ...goal, done, complete: goal.target > 0 && done >= goal.target };
  });

  return {
    followUps,
    toSubmit: submitRows.map(decorate),
    toResearch: researchRows.map(decorate),
    fresh: freshRows.map(decorate),
    dueTasks: taskRows.map((row) => ({
      ...row.action,
      opportunityTitle: row.opportunityTitle,
      companyName: row.companyName,
    })),
    goals: goalProgress,
    goalsComplete: goalProgress.filter((goal) => goal.complete).length,
    totalShots: counters.applications + counters.outreach + counters.followups,
  };
}

/** Today's measured activity — every goal is scored from durable rows, not ticks. */
async function countToday(userId: string): Promise<Record<GoalMetric, number>> {
  const db = await getDb();
  const now = today();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [sent] = await db
    .select({
      applications: sql<number>`count(*) filter (where ${opportunities.category} in ('job','scholarship'))::int`,
      outreach: sql<number>`count(*) filter (where ${opportunities.category} in ('workflow','speculative'))::int`,
    })
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), eq(opportunities.sentAt, now)));

  const [added] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), gte(opportunities.createdAt, startOfDay)));

  const [logged] = await db
    .select({
      followups: sql<number>`count(*) filter (where ${activities.kind} = 'followup')::int`,
      moves: sql<number>`count(*) filter (where ${activities.kind} = 'stage')::int`,
    })
    .from(activities)
    .where(and(eq(activities.userId, userId), gte(activities.occurredAt, startOfDay)));

  return {
    applications: sent?.applications ?? 0,
    outreach: sent?.outreach ?? 0,
    followups: logged?.followups ?? 0,
    research: logged?.moves ?? 0,
    added: added?.n ?? 0,
  };
}

export type CommandItem = {
  id: string;
  title: string;
  company: string | null;
  category: string;
  stage: string;
  urgency: ReturnType<typeof urgencyOf>;
};

/** Feed for the command palette — small, so it can be filtered client-side. */
export async function getCommandIndex(userId: string): Promise<CommandItem[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: opportunities.id,
      title: opportunities.title,
      category: opportunities.category,
      stage: opportunities.stage,
      followUp: opportunities.nextFollowUpAt,
      company: companies.name,
    })
    .from(opportunities)
    .leftJoin(companies, eq(opportunities.companyId, companies.id))
    .where(and(eq(opportunities.userId, userId), inArray(opportunities.stage, OPEN_STAGES)))
    .orderBy(asc(opportunities.nextFollowUpAt))
    .limit(300);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    category: row.category,
    stage: row.stage,
    urgency: urgencyOf(row.followUp),
  }));
}
