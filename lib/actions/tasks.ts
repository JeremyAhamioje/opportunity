"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { actions, opportunities } from "@/lib/db/schema";
import { requireViewer } from "@/lib/auth/guard";
import { today } from "@/lib/domain/dates";
import { ACTION_TYPES, ACTION_TYPE_META, type ActionType } from "@/lib/domain/types";
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

export async function createAction(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();
  const opportunityId = str(form, "opportunityId");
  if (!opportunityId) return fail("Missing opportunity.");

  const [owned] = await db
    .select({ id: opportunities.id })
    .from(opportunities)
    .where(and(eq(opportunities.id, opportunityId), eq(opportunities.userId, user.id)))
    .limit(1);
  if (!owned) return fail("Opportunity not found.");

  const type = enumValue<ActionType>(form, "type", ACTION_TYPES, "other");

  await db.insert(actions).values({
    userId: user.id,
    opportunityId,
    type,
    title: str(form, "title") ?? ACTION_TYPE_META[type].label,
    dueDate: day(form, "dueDate"),
    notes: str(form, "notes"),
  });

  refreshAll();
  return OK;
}

export async function toggleAction(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  const [existing] = await db
    .select()
    .from(actions)
    .where(and(eq(actions.id, id), eq(actions.userId, user.id)))
    .limit(1);
  if (!existing) return;

  const done = existing.status === "done";
  await db
    .update(actions)
    .set({
      status: done ? "todo" : "done",
      completedDate: done ? null : today(),
    })
    .where(and(eq(actions.id, id), eq(actions.userId, user.id)));

  if (!done) {
    await db
      .update(opportunities)
      .set({ lastActionAt: today(), lastActionLabel: existing.title })
      .where(eq(opportunities.id, existing.opportunityId));

    await logActivity({
      userId: user.id,
      opportunityId: existing.opportunityId,
      kind: "action",
      message: `Completed: ${existing.title}`,
    });
  }

  refreshAll();
}

export async function deleteAction(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  await db.delete(actions).where(and(eq(actions.id, id), eq(actions.userId, user.id)));
  refreshAll();
}
