"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { resolveCompanyId } from "@/lib/db/resolve";
import { opportunities, responses } from "@/lib/db/schema";
import { requireViewer } from "@/lib/auth/guard";
import { addDays, today } from "@/lib/domain/dates";
import { imageForOpportunity } from "@/lib/domain/imagery";
import {
  CATEGORIES,
  EMAIL_STATUSES,
  SENTIMENTS,
  STAGES,
  WORK_MODES,
  type Category,
  type RequiredDocument,
  type Stage,
} from "@/lib/domain/types";
import { normalizeUrl } from "@/lib/utils";
import {
  bool,
  day,
  enumValue,
  fail,
  list,
  logActivity,
  num,
  OK,
  optionalEnum,
  refreshAll,
  str,
  triBool,
  type ActionResult,
} from "./shared";

/* -------------------------------------------------------------------------- */
/*  Create                                                                    */
/* -------------------------------------------------------------------------- */

export async function createOpportunity(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();

  const category = enumValue<Category>(form, "category", CATEGORIES, "workflow");
  const companyName = str(form, "companyName");
  const title = str(form, "title");

  // A build is something you make, so it has no counterparty. Every other
  // category is a shot at someone, and is meaningless without one.
  const isBuild = category === "build";
  if (!isBuild && !companyName) return fail("A company or organisation name is required.");
  if (isBuild && !title) return fail("Give the build a name.");

  const companyId = companyName
    ? await resolveCompanyId(user.id, companyName, {
        website: normalizeUrl(str(form, "website")),
        industry: str(form, "industry"),
        size: str(form, "companySize"),
        location: str(form, "companyLocation"),
      })
    : null;

  // Builds are the one category the app chases on its own without an outreach
  // step to trigger it, so the reminder is set at creation.
  const checkInDays = isBuild ? (num(form, "checkInDays", 0, 365) ?? 7) : null;

  const [created] = await db
    .insert(opportunities)
    .values({
      userId: user.id,
      companyId,
      category,
      title: title ?? defaultTitle(category, companyName ?? "Untitled"),
      stage: enumValue<Stage>(form, "stage", STAGES, "sourced"),
      notes: str(form, "notes"),
      imageUrl: imageForOpportunity({
        category,
        title,
        industry: str(form, "industry"),
        problem: str(form, "problemObserved"),
        notes: str(form, "notes"),
      }),
      applicationUrl: normalizeUrl(str(form, "applicationUrl")),
      contactUrl: normalizeUrl(str(form, "contactUrl")),
      documentsUrl: normalizeUrl(str(form, "documentsUrl")),
      deadline: day(form, "deadline"),

      problemObserved: str(form, "problemObserved"),
      proposedSolution: str(form, "proposedSolution"),
      buyerRole: str(form, "buyerRole"),
      whyInterested: str(form, "whyInterested"),
      contribution: str(form, "contribution"),
      salary: str(form, "salary"),
      location: str(form, "location"),
      workMode: optionalEnum(form, "workMode", WORK_MODES),
      skills: list(form, "skills"),
      country: str(form, "country"),
      degreeLevel: str(form, "degreeLevel"),
      fundingAmount: str(form, "fundingAmount"),
      documents: list(form, "documentsRequired").map<RequiredDocument>((name) => ({
        name,
        done: false,
      })),

      brainDump: str(form, "brainDump"),
      whatItProves: str(form, "whatItProves"),
      firstStep: str(form, "firstStep"),
      scopeEstimate: str(form, "scopeEstimate"),
      nextFollowUpAt: checkInDays ? addDays(today(), checkInDays) : null,
    })
    .returning({ id: opportunities.id });

  await logActivity({
    userId: user.id,
    opportunityId: created.id,
    companyId,
    kind: "created",
    message: isBuild
      ? `Build captured — ${title}`
      : `Opportunity discovered — ${companyName}`,
  });

  refreshAll();
  return { ok: true, id: created.id };
}

function defaultTitle(category: Category, company: string): string {
  switch (category) {
    case "workflow":
      return `Workflow automation pitch — ${company}`;
    case "speculative":
      return `Speculative outreach — ${company}`;
    case "job":
      return `Role at ${company}`;
    case "scholarship":
      return `${company} scholarship`;
    case "build":
      return company;
  }
}

/* -------------------------------------------------------------------------- */
/*  Update                                                                    */
/* -------------------------------------------------------------------------- */

export async function updateOpportunity(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return fail("Missing opportunity.");

  const existing = await loadOwned(user.id, id);
  if (!existing) return fail("Opportunity not found.");

  const companyName = str(form, "companyName");
  const companyId = companyName
    ? await resolveCompanyId(user.id, companyName)
    : existing.companyId;

  /*
   * The edit form only renders the fields relevant to the chosen category, so a
   * blanket write would blank every field it did not render. Only keys actually
   * submitted are patched — switching an opportunity from workflow to job keeps
   * the workflow research intact underneath.
   */
  const patch: Record<string, unknown> = {
    companyId,
    category: enumValue<Category>(form, "category", CATEGORIES, existing.category),
    title: str(form, "title") ?? existing.title,
  };

  const text = (key: string) => {
    if (form.has(key)) patch[key] = str(form, key);
  };
  const url = (key: string) => {
    if (form.has(key)) patch[key] = normalizeUrl(str(form, key));
  };
  const date = (key: string) => {
    if (form.has(key)) patch[key] = day(form, key);
  };
  const values = (key: string) => {
    if (form.has(key)) patch[key] = list(form, key);
  };

  text("notes");
  values("tags");
  url("applicationUrl");
  url("contactUrl");
  url("documentsUrl");
  date("deadline");

  text("problemObserved");
  text("evidence");
  text("currentProcess");
  text("proposedSolution");
  text("expectedValue");
  text("outreachAngle");
  text("buyerRole");

  text("whyInterested");
  text("contribution");
  text("contactMethod");

  text("salary");
  text("location");
  values("skills");
  date("appliedAt");
  if (form.has("workMode")) patch.workMode = optionalEnum(form, "workMode", WORK_MODES);

  text("country");
  text("degreeLevel");
  text("fundingAmount");
  text("eligibility");
  text("requirements");

  text("whatItProves");
  text("firstStep");
  text("scopeEstimate");
  // brainDump is deliberately absent: the raw dump is a record of what was
  // originally meant, and the edit form must not be able to rewrite history.

  await db
    .update(opportunities)
    .set(patch)
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  refreshAll();
  return OK;
}

export async function updateScores(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return fail("Missing opportunity.");

  await db
    .update(opportunities)
    .set({
      scoreRepetition: num(form, "repetition"),
      scoreFrequency: num(form, "frequency"),
      scorePain: num(form, "pain"),
      scoreAutomability: num(form, "automability"),
      scoreFinancialValue: num(form, "financialValue"),
      scoreDecisionMaker: num(form, "decisionMaker"),
      scoreCapability: num(form, "capability"),
      dataAccessible: triBool(form, "dataAccessible"),
    })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  refreshAll();
  return OK;
}

export async function updateDocuments(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  const existing = await loadOwned(user.id, id);
  if (!existing) return;

  const documents = existing.documents.map((doc, index) => ({
    ...doc,
    done: bool(form, `doc_${index}`),
  }));

  const added = str(form, "newDocument");
  if (added) documents.push({ name: added, done: false });

  await db
    .update(opportunities)
    .set({ documents })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  refreshAll();
}

/* -------------------------------------------------------------------------- */
/*  Pipeline movement                                                         */
/* -------------------------------------------------------------------------- */

export async function setStage(id: string, stage: Stage): Promise<ActionResult> {
  const { user } = await requireViewer();
  if (!STAGES.includes(stage)) return fail("Unknown stage.");

  const db = await getDb();
  const existing = await loadOwned(user.id, id);
  if (!existing) return fail("Opportunity not found.");
  if (existing.stage === stage) return OK;

  const closing = stage === "won" || stage === "lost";
  await db
    .update(opportunities)
    .set({
      stage,
      closedAt: closing ? today() : null,
      // A closed opportunity must stop shouting from the follow-up desk.
      nextFollowUpAt: closing ? null : existing.nextFollowUpAt,
    })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  await logActivity({
    userId: user.id,
    opportunityId: id,
    companyId: existing.companyId,
    kind: "stage",
    message: `Moved to ${stage.replace(/^\w/, (c) => c.toUpperCase())}`,
  });

  refreshAll();
  return OK;
}

export async function setStageFromForm(form: FormData): Promise<void> {
  const id = str(form, "id");
  const stage = str(form, "stage") as Stage | null;
  if (id && stage) await setStage(id, stage);
}

/* -------------------------------------------------------------------------- */
/*  Outreach: mark as sent, follow up, record responses                       */
/* -------------------------------------------------------------------------- */

export async function markAsSent(form: FormData): Promise<void> {
  const { user, settings: config } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  const existing = await loadOwned(user.id, id);
  if (!existing) return;

  const sentOn = day(form, "sentAt") ?? today();
  const followUpDays = num(form, "followUpDays", 0, 365) ?? config.followUpDefaultDays;
  const label = existing.category === "job" ? "Application submitted" : "Outreach sent";

  await db
    .update(opportunities)
    .set({
      emailStatus: "sent",
      sentAt: sentOn,
      appliedAt: existing.category === "job" ? sentOn : existing.appliedAt,
      stage: "sent",
      lastActionAt: sentOn,
      lastActionLabel: label,
      nextFollowUpAt: followUpDays > 0 ? addDays(sentOn, followUpDays) : null,
    })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  await logActivity({
    userId: user.id,
    opportunityId: id,
    companyId: existing.companyId,
    kind: "outreach",
    message:
      followUpDays > 0
        ? `${label} — follow-up set for ${addDays(sentOn, followUpDays)}`
        : label,
  });

  refreshAll();
}

export async function logFollowUpSent(form: FormData): Promise<void> {
  const { user, settings: config } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  const existing = await loadOwned(user.id, id);
  if (!existing) return;

  const sentOn = today();
  const nextDays = num(form, "followUpDays", 0, 365) ?? config.followUpDefaultDays;
  const count = existing.followUpCount + 1;

  // A build has nobody to chase — the same button means "I looked at it". It
  // must not advance the stage either, or checking in would silently claim
  // progress that has not happened.
  const isBuild = existing.category === "build";
  const label = isBuild ? `Progress check #${count}` : `Follow-up #${count} sent`;

  await db
    .update(opportunities)
    .set({
      emailStatus: isBuild ? existing.emailStatus : "followup_sent",
      stage: !isBuild && existing.stage === "sent" ? "followup" : existing.stage,
      followUpCount: count,
      lastActionAt: sentOn,
      lastActionLabel: label,
      nextFollowUpAt: nextDays > 0 ? addDays(sentOn, nextDays) : null,
    })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  await logActivity({
    userId: user.id,
    opportunityId: id,
    companyId: existing.companyId,
    kind: "followup",
    message: label,
  });

  refreshAll();
}

export async function snoozeFollowUp(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  const days = num(form, "days", 1, 365) ?? 3;
  if (!id) return;

  const existing = await loadOwned(user.id, id);
  if (!existing) return;

  // Snooze from today, not from an already-overdue date, or "+3 days" on a
  // two-week-old follow-up would still be in the past.
  const base = existing.nextFollowUpAt && existing.nextFollowUpAt > today()
    ? existing.nextFollowUpAt
    : today();

  await db
    .update(opportunities)
    .set({ nextFollowUpAt: addDays(base, days) })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  refreshAll();
}

export async function setFollowUpDate(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  await db
    .update(opportunities)
    .set({ nextFollowUpAt: day(form, "nextFollowUpAt") })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  refreshAll();
}

export async function setEmailStatus(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  await db
    .update(opportunities)
    .set({ emailStatus: enumValue(form, "emailStatus", EMAIL_STATUSES, "none") })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  refreshAll();
}

export async function addResponse(
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  const summary = str(form, "summary");
  if (!id) return fail("Missing opportunity.");
  if (!summary) return fail("Add a short summary of the response.");

  const existing = await loadOwned(user.id, id);
  if (!existing) return fail("Opportunity not found.");

  const sentiment = enumValue(form, "sentiment", SENTIMENTS, "neutral");
  const receivedAt = day(form, "receivedAt") ?? today();

  await db.insert(responses).values({
    userId: user.id,
    opportunityId: id,
    receivedAt,
    sentiment,
    channel: str(form, "channel"),
    summary,
  });

  const nextStage: Stage =
    sentiment === "negative" ? "lost" : existing.stage === "interview" ? "interview" : "response";

  await db
    .update(opportunities)
    .set({
      emailStatus: "replied",
      stage: nextStage,
      lastActionAt: receivedAt,
      lastActionLabel: "Response received",
      closedAt: sentiment === "negative" ? receivedAt : existing.closedAt,
      // A reply resolves the follow-up; the next move is a decision, not a nudge.
      nextFollowUpAt: null,
    })
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  await logActivity({
    userId: user.id,
    opportunityId: id,
    companyId: existing.companyId,
    kind: "response",
    message: `${sentiment === "positive" ? "Positive" : sentiment === "negative" ? "Negative" : "Neutral"} response received`,
  });

  refreshAll();
  return OK;
}

export async function addNote(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const id = str(form, "id");
  const message = str(form, "message");
  if (!id || !message) return;

  const existing = await loadOwned(user.id, id);
  if (!existing) return;

  await logActivity({
    userId: user.id,
    opportunityId: id,
    companyId: existing.companyId,
    kind: "note",
    message,
  });

  refreshAll();
}

/* -------------------------------------------------------------------------- */
/*  Delete                                                                    */
/* -------------------------------------------------------------------------- */

export async function deleteOpportunity(form: FormData): Promise<void> {
  const { user } = await requireViewer();
  const db = await getDb();
  const id = str(form, "id");
  if (!id) return;

  await db
    .delete(opportunities)
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, user.id)));

  refreshAll();
  redirect("/opportunities");
}

async function loadOwned(userId: string, id: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.id, id), eq(opportunities.userId, userId)))
    .limit(1);
  return row ?? null;
}
