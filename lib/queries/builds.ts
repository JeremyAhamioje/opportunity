import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { opportunities } from "@/lib/db/schema";
import { today, urgencyOf } from "@/lib/domain/dates";
import { buildLaneOf, BUILD_LANES, type Stage } from "@/lib/domain/types";
import { decorateImage } from "./opportunities";
import type { Opportunity } from "@/lib/db/schema";

export type BuildRow = Opportunity & {
  image: string;
  urgency: ReturnType<typeof urgencyOf>;
};

export type BuildLane = { stage: Stage; rows: BuildRow[] };

export type BuildsView = {
  lanes: BuildLane[];
  /** Builds whose check-in has come due — the reason this is not a notes app. */
  dueCheckIns: BuildRow[];
  total: number;
  shipped: number;
  live: number;
};

/**
 * The build lane. Ordered by check-in date within each column so the one the
 * app is about to nag you about sits at the top of its own stage.
 */
export async function getBuilds(userId: string): Promise<BuildsView> {
  const db = await getDb();

  const rows = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.userId, userId), eq(opportunities.category, "build")))
    .orderBy(
      // Nulls last, then soonest first, then newest.
      sql`${opportunities.nextFollowUpAt} is null`,
      asc(opportunities.nextFollowUpAt),
      desc(opportunities.createdAt),
    );

  const decorated: BuildRow[] = rows.map((row) => ({
    ...row,
    image: decorateImage(row, null),
    urgency: urgencyOf(row.nextFollowUpAt),
  }));

  const now = today();
  const lanes: BuildLane[] = BUILD_LANES.map((stage) => ({
    stage,
    rows: decorated.filter((row) => buildLaneOf(row.stage) === stage),
  }));

  return {
    lanes,
    dueCheckIns: decorated.filter(
      (row) =>
        row.nextFollowUpAt !== null &&
        row.nextFollowUpAt <= now &&
        row.stage !== "won" &&
        row.stage !== "lost",
    ),
    total: decorated.length,
    shipped: decorated.filter((row) => row.stage === "won").length,
    live: decorated.filter((row) => row.stage !== "won" && row.stage !== "lost").length,
  };
}
