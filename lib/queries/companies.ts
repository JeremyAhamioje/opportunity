import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { activities, companies, contacts, opportunities } from "@/lib/db/schema";
import { OPEN_STAGES } from "@/lib/domain/types";
import { scoreOf } from "@/lib/domain/scoring";
import type { ScoringWeights } from "@/lib/domain/types";

export type CompanyRow = typeof companies.$inferSelect & {
  opportunityCount: number;
  openCount: number;
  contactCount: number;
  nextFollowUpAt: string | null;
};

export async function listCompanies(userId: string, q?: string): Promise<CompanyRow[]> {
  const db = await getDb();
  const where = [eq(companies.userId, userId)];

  if (q?.trim()) {
    const needle = `%${q.trim()}%`;
    const match = or(
      ilike(companies.name, needle),
      ilike(companies.industry, needle),
      ilike(companies.location, needle),
      ilike(companies.notes, needle),
    );
    if (match) where.push(match);
  }

  const rows = await db
    .select({
      company: companies,
      opportunityCount: sql<number>`count(${opportunities.id})::int`,
      openCount: sql<number>`count(${opportunities.id}) filter (where ${inArray(opportunities.stage, OPEN_STAGES)})::int`,
      nextFollowUpAt: sql<string | null>`min(${opportunities.nextFollowUpAt})`,
    })
    .from(companies)
    .leftJoin(opportunities, eq(opportunities.companyId, companies.id))
    .where(and(...where))
    .groupBy(companies.id)
    .orderBy(desc(sql`count(${opportunities.id})`), companies.name);

  const contactCounts = await db
    .select({ companyId: contacts.companyId, n: sql<number>`count(*)::int` })
    .from(contacts)
    .where(eq(contacts.userId, userId))
    .groupBy(contacts.companyId);

  const byCompany = new Map(contactCounts.map((row) => [row.companyId, row.n]));

  return rows.map((row) => ({
    ...row.company,
    opportunityCount: row.opportunityCount,
    openCount: row.openCount,
    contactCount: byCompany.get(row.company.id) ?? 0,
    nextFollowUpAt: row.nextFollowUpAt,
  }));
}

export async function getCompany(userId: string, id: string, weights: ScoringWeights) {
  const db = await getDb();

  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, id), eq(companies.userId, userId)))
    .limit(1);
  if (!company) return null;

  const [opportunityRows, contactRows, timeline] = await Promise.all([
    db
      .select()
      .from(opportunities)
      .where(eq(opportunities.companyId, id))
      .orderBy(desc(opportunities.createdAt)),
    db.select().from(contacts).where(eq(contacts.companyId, id)),
    db
      .select({ activity: activities, opportunityTitle: opportunities.title })
      .from(activities)
      .leftJoin(opportunities, eq(activities.opportunityId, opportunities.id))
      .where(
        and(
          eq(activities.userId, userId),
          or(eq(activities.companyId, id), eq(opportunities.companyId, id))!,
        ),
      )
      .orderBy(desc(activities.occurredAt))
      .limit(40),
  ]);

  return {
    company,
    opportunities: opportunityRows.map((row) => ({ ...row, score: scoreOf(row, weights) })),
    contacts: contactRows,
    activities: timeline,
  };
}
