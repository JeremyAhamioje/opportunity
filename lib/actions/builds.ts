"use server";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { opportunities } from "@/lib/db/schema";
import { requireViewer } from "@/lib/auth/guard";
import { addDays, today } from "@/lib/domain/dates";
import { imageForOpportunity } from "@/lib/domain/imagery";
import { structureBrainDump, type BuildDraft } from "@/lib/parse/build";
import { STAGES, type Stage } from "@/lib/domain/types";
import { day, enumValue, fail, list, logActivity, num, OK, refreshAll, str, type ActionResult } from "./shared";

/** How long a fresh idea sits before the app asks what happened to it. */
const DEFAULT_CHECK_IN_DAYS = 7;

export type StructureResult = {
  ok: boolean;
  draft?: BuildDraft;
  /** The dump as typed, echoed back so the review step cannot lose it. */
  dump?: string;
  error?: string;
};

/**
 * Structure-only. Deliberately writes nothing: the review step exists because a
 * model's reading of a half-formed idea is a suggestion, not a fact, and the
 * cheapest moment to correct it is before it becomes a row.
 */
export async function structureDump(
  _prev: StructureResult | null,
  form: FormData,
): Promise<StructureResult> {
  await requireViewer();

  const dump = str(form, "brainDump");
  if (!dump) return { ok: false, error: "Write the idea down first — anything at all." };

  try {
    const draft = await structureBrainDump(dump);
    return { ok: true, draft, dump };
  } catch (error) {
    return {
      ok: false,
      dump,
      error: error instanceof Error ? error.message : "Could not structure that.",
    };
  }
}

/**
 * Saves the reviewed draft. The raw dump is stored alongside the structured
 * fields, never instead of them — the messy original is the thing you actually
 * meant, and it is what a re-structure would run on.
 */
export async function createBuild(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();

  const title = str(form, "title");
  const dump = str(form, "brainDump");
  if (!title) return fail("Give the build a name.");

  const checkInDays = num(form, "checkInDays", 0, 365) ?? DEFAULT_CHECK_IN_DAYS;
  const problem = str(form, "problemObserved");
  const solution = str(form, "proposedSolution");
  const stack = list(form, "skills");

  const [created] = await db
    .insert(opportunities)
    .values({
      userId: user.id,
      companyId: null,
      category: "build",
      title,
      stage: enumValue<Stage>(form, "stage", STAGES, "sourced"),
      notes: str(form, "notes"),
      brainDump: dump,
      problemObserved: problem,
      proposedSolution: solution,
      whatItProves: str(form, "whatItProves"),
      firstStep: str(form, "firstStep"),
      scopeEstimate: str(form, "scopeEstimate"),
      skills: stack,
      deadline: day(form, "deadline"),
      imageUrl: imageForOpportunity({
        category: "build",
        title,
        problem,
        skills: stack,
        notes: solution ?? dump,
      }),
      // The whole point of capturing it here rather than in a notes app: the
      // follow-up engine will bring it back up on its own.
      nextFollowUpAt: checkInDays > 0 ? addDays(today(), checkInDays) : null,
    })
    .returning({ id: opportunities.id });

  await logActivity({
    userId: user.id,
    opportunityId: created.id,
    kind: "created",
    message: `Build captured — ${title}`,
  });

  refreshAll();
  return { ok: true, id: created.id };
}

/**
 * Resolves a build's check-in the way "Sent" resolves a follow-up: it records
 * that you looked, and schedules the next look. Without the reschedule a build
 * falls off the desk the first time you glance at it.
 */
export async function logBuildCheckIn(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  const [existing] = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)))
    .limit(1);
  if (!existing) return;

  const nextDays = num(form, "checkInDays", 0, 365) ?? DEFAULT_CHECK_IN_DAYS;
  const note = str(form, "progress");
  const count = existing.followUpCount + 1;

  await db
    .update(opportunities)
    .set({
      followUpCount: count,
      lastActionAt: today(),
      lastActionLabel: note ?? `Progress check #${count}`,
      nextFollowUpAt: nextDays > 0 ? addDays(today(), nextDays) : null,
    })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  await logActivity({
    userId: user.id,
    opportunityId: id,
    kind: "followup",
    message: note ? `Progress: ${note}` : `Progress check #${count}`,
  });

  refreshAll();
}

/** Re-runs the structurer over the stored dump, for a build saved before a key existed. */
export async function restructureBuild(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return fail("Missing build.");

  const [existing] = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)))
    .limit(1);
  if (!existing?.brainDump) return fail("This build has no original dump to re-read.");

  const draft = await structureBrainDump(existing.brainDump);
  if (draft.source === "fallback") {
    return fail(draft.error ?? "Gemini is not configured, so there is nothing new to add.");
  }

  // Only fills gaps. Anything already written by hand outranks the model.
  await db
    .update(opportunities)
    .set({
      problemObserved: existing.problemObserved ?? draft.problem ?? null,
      proposedSolution: existing.proposedSolution ?? draft.solution ?? null,
      whatItProves: existing.whatItProves ?? draft.whatItProves ?? null,
      firstStep: existing.firstStep ?? draft.firstStep ?? null,
      scopeEstimate: existing.scopeEstimate ?? draft.scopeEstimate ?? null,
      skills: existing.skills.length ? existing.skills : draft.stack,
    })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  refreshAll();
  return OK;
}
