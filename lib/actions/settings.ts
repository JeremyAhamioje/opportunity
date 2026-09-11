"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { opportunities, settings, users } from "@/lib/db/schema";
import { requireViewer } from "@/lib/auth/guard";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import {
  DEFAULT_DAILY_GOALS,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_SOP,
  SCORE_FACTORS,
  type DailyGoal,
  type ScoringWeights,
  type SopChecklist,
} from "@/lib/domain/types";
import { fail, num, OK, refreshAll, str, type ActionResult } from "./shared";

export async function updateScoringWeights(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();

  const weights = { ...DEFAULT_SCORING_WEIGHTS } as ScoringWeights;
  for (const factor of SCORE_FACTORS) {
    weights[factor] = num(form, `weight_${factor}`, 0, 5) ?? 1;
  }
  if (Object.values(weights).every((w) => w === 0)) {
    return fail("At least one factor needs a non-zero weight.");
  }

  await db.update(settings).set({ scoringWeights: weights }).where(eq(settings.userId, user.id));
  refreshAll();
  return OK;
}

export async function updateFollowUpDefault(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();
  const days = num(form, "followUpDefaultDays", 0, 365) ?? 5;

  await db.update(settings).set({ followUpDefaultDays: days }).where(eq(settings.userId, user.id));
  refreshAll();
  return OK;
}

export async function updateDailyGoals(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user, settings: config } = await requireViewer();
  const db = await getDb();

  const goals: DailyGoal[] = config.dailyGoals
    .map((goal) => ({
      ...goal,
      label: str(form, `goal_label_${goal.id}`) ?? goal.label,
      target: num(form, `goal_target_${goal.id}`, 0, 999) ?? goal.target,
    }))
    .filter((goal) => !str(form, `goal_remove_${goal.id}`));

  const newLabel = str(form, "new_goal_label");
  if (newLabel) {
    goals.push({
      id: crypto.randomUUID().slice(0, 8),
      label: newLabel,
      target: num(form, "new_goal_target", 0, 999) ?? 1,
      metric:
        (str(form, "new_goal_metric") as DailyGoal["metric"] | null) ?? "outreach",
    });
  }

  await db.update(settings).set({ dailyGoals: goals }).where(eq(settings.userId, user.id));
  refreshAll();
  return OK;
}

export async function resetDailyGoals(): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  await db
    .update(settings)
    .set({ dailyGoals: DEFAULT_DAILY_GOALS })
    .where(eq(settings.userId, user.id));
  refreshAll();
}

/* -------------------------------------------------------------------------- */
/*  SOP checklist — the template, and per-opportunity progress against it     */
/* -------------------------------------------------------------------------- */

export async function updateSop(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user, settings: config } = await requireViewer();
  const db = await getDb();

  const next: SopChecklist = {
    steps: config.sopChecklist.steps.map((step) => ({
      ...step,
      title: str(form, `step_title_${step.id}`) ?? step.title,
      hint: str(form, `step_hint_${step.id}`) ?? step.hint,
      items: [
        ...step.items
          .map((item) => ({
            ...item,
            label: str(form, `item_label_${item.id}`) ?? item.label,
          }))
          .filter((item) => !str(form, `item_remove_${item.id}`)),
        ...(str(form, `item_new_${step.id}`)
          ? [
              {
                id: `${step.id}_${crypto.randomUUID().slice(0, 6)}`,
                label: str(form, `item_new_${step.id}`)!,
              },
            ]
          : []),
      ],
    })),
  };

  await db.update(settings).set({ sopChecklist: next }).where(eq(settings.userId, user.id));
  refreshAll();
  return OK;
}

export async function resetSop(): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  await db.update(settings).set({ sopChecklist: DEFAULT_SOP }).where(eq(settings.userId, user.id));
  refreshAll();
}

/** Ticks or unticks one SOP item against one opportunity. */
export async function toggleSopItem(
  opportunityId: string,
  itemId: string,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();

  const [row] = await db
    .select({ sopProgress: opportunities.sopProgress })
    .from(opportunities)
    .where(and(eq(opportunities.id, opportunityId), eq(opportunities.userId, user.id)))
    .limit(1);
  if (!row) return fail("Opportunity not found.");

  const set = new Set(row.sopProgress ?? []);
  if (set.has(itemId)) set.delete(itemId);
  else set.add(itemId);

  await db
    .update(opportunities)
    .set({ sopProgress: [...set] })
    .where(and(eq(opportunities.id, opportunityId), eq(opportunities.userId, user.id)));

  refreshAll();
  return OK;
}

/* -------------------------------------------------------------------------- */
/*  Account                                                                   */
/* -------------------------------------------------------------------------- */

export async function updateProfile(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();
  const email = str(form, "email")?.toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Enter a valid email.");

  await db
    .update(users)
    .set({ name: str(form, "name"), email })
    .where(eq(users.id, user.id));

  refreshAll();
  return OK;
}

export async function changePassword(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();

  const current = str(form, "currentPassword");
  const next = str(form, "newPassword");
  if (!current || !next) return fail("Fill in both password fields.");
  if (!(await verifyPassword(current, user.passwordHash))) return fail("Current password is incorrect.");

  const problem = passwordProblem(next);
  if (problem) return fail(problem);

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, user.id));

  return { ok: true };
}
