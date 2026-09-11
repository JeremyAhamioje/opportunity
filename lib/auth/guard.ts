import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { settings, users } from "@/lib/db/schema";
import {
  DEFAULT_DAILY_GOALS,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_SOP,
} from "@/lib/domain/types";
import { readSession } from "./session";
import type { Settings, User } from "@/lib/db/schema";

export type Viewer = { user: User; settings: Settings };

export async function countUsers(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return row?.n ?? 0;
}

/** Resolves the signed-in user, or null. Never redirects. */
export async function getViewer(): Promise<Viewer | null> {
  const session = await readSession();
  if (!session) return null;

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
  if (!user) return null;

  return { user, settings: await ensureSettings(user.id) };
}

/**
 * The single authorization gate. Every page, query and server action funnels
 * through this — server actions are reachable by direct POST, so checking in
 * the layout alone would not be enough.
 */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireUserId(): Promise<string> {
  const { user } = await requireViewer();
  return user.id;
}

export async function ensureSettings(userId: string): Promise<Settings> {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(settings)
    .values({
      userId,
      dailyGoals: DEFAULT_DAILY_GOALS,
      scoringWeights: DEFAULT_SCORING_WEIGHTS,
      followUpDefaultDays: 5,
      sopChecklist: DEFAULT_SOP,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [row] = await db.select().from(settings).where(eq(settings.userId, userId)).limit(1);
  return row;
}
