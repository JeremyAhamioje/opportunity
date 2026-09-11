"use server";

import { getDb } from "@/lib/db";
import { resolveCompanyId } from "@/lib/db/resolve";
import { contacts, opportunities } from "@/lib/db/schema";
import { requireViewer } from "@/lib/auth/guard";
import { parseResearch, type ParsedOpportunity } from "@/lib/parse/research";
import { isAiConfigured } from "@/lib/parse/ai-config";
import { isValidDay } from "@/lib/domain/dates";
import { imageForOpportunity } from "@/lib/domain/imagery";
import { CATEGORIES, type Category, type RequiredDocument } from "@/lib/domain/types";
import { normalizeUrl } from "@/lib/utils";
import { logActivity, refreshAll, str } from "./shared";

export type AnalyzeResult = {
  ok: boolean;
  items: ParsedOpportunity[];
  note: string;
  engine: "parser" | "ai" | "search";
  error?: string;
};

/**
 * Step 1 of Research Import: pasted text in, draft records out.
 * Nothing is written to the database here — the user reviews first.
 */
export async function analyzePaste(
  _prev: AnalyzeResult | null,
  form: FormData,
): Promise<AnalyzeResult> {
  await requireViewer();

  const text = (form.get("raw") as string | null)?.trim() ?? "";
  if (!text) {
    return { ok: false, items: [], note: "Paste your research findings first.", engine: "parser" };
  }

  const wantsAi = form.get("engine") === "ai";

  if (wantsAi && isAiConfigured()) {
    try {
      // Loaded on demand so the default path never touches the network module.
      const { extractWithGemini } = await import("@/lib/parse/ai");
      const items = await extractWithGemini(text);
      if (items.length) {
        return {
          ok: true,
          items,
          engine: "ai",
          note: `Gemini extracted ${items.length} ${items.length === 1 ? "opportunity" : "opportunities"}. Review before importing.`,
        };
      }
      // Gemini found nothing — the built-in parser may still see structure.
    } catch (error) {
      const report = parseResearch(text);
      return {
        ...report,
        ok: report.items.length > 0,
        engine: "parser",
        note: `${report.note} (Gemini extraction failed, so the built-in parser ran instead.)`,
        error: error instanceof Error ? error.message : "Extraction failed.",
      };
    }
  }

  const report = parseResearch(text);
  return { ok: report.items.length > 0, items: report.items, note: report.note, engine: "parser" };
}

/**
 * Step 2: commit the reviewed drafts. Accepts the edited JSON from the review
 * table, so what gets written is what was on screen.
 */
export async function importOpportunities(
  _prev: { ok: boolean; created?: number; error?: string } | null,
  form: FormData,
): Promise<{ ok: boolean; created?: number; error?: string }> {
  const { user } = await requireViewer();
  const db = await getDb();

  const payload = str(form, "payload");
  if (!payload) return { ok: false, error: "Nothing selected to import." };

  let drafts: ParsedOpportunity[];
  try {
    const parsed = JSON.parse(payload);
    if (!Array.isArray(parsed)) throw new Error("bad shape");
    drafts = parsed;
  } catch {
    return { ok: false, error: "Could not read the selected rows." };
  }

  if (!drafts.length) return { ok: false, error: "Nothing selected to import." };

  let created = 0;
  for (const draft of drafts) {
    const name = draft.companyName?.trim();
    if (!name) continue;

    const category: Category = CATEGORIES.includes(draft.category) ? draft.category : "speculative";

    const companyId = await resolveCompanyId(user.id, name, {
      website: normalizeUrl(draft.website),
      industry: draft.industry ?? null,
      size: draft.companySize ?? null,
      location: draft.location ?? null,
    });

    const [row] = await db
      .insert(opportunities)
      .values({
        userId: user.id,
        companyId,
        category,
        title: draft.title?.trim() || fallbackTitle(category, name),
        stage: "sourced",
        notes: draft.notes ?? null,
        imageUrl: imageForOpportunity({
          category,
          title: draft.title,
          industry: draft.industry,
          problem: draft.problemObserved,
          skills: draft.skills,
          notes: draft.notes,
        }),
        applicationUrl: normalizeUrl(draft.applicationUrl),
        deadline: draft.deadline && isValidDay(draft.deadline) ? draft.deadline : null,

        problemObserved: draft.problemObserved ?? null,
        proposedSolution: draft.proposedSolution ?? null,
        buyerRole: draft.buyerRole ?? null,

        whyInterested: draft.whyInterested ?? null,
        contribution: draft.contribution ?? null,

        salary: draft.salary ?? null,
        location: draft.location ?? null,
        workMode: draft.workMode ?? null,
        skills: draft.skills ?? [],

        country: draft.country ?? null,
        degreeLevel: draft.degreeLevel ?? null,
        fundingAmount: draft.fundingAmount ?? null,
        eligibility: draft.eligibility ?? null,
        requirements: draft.requirements ?? null,
        // Scholarship trackers carry a column per required document; each one
        // arrives here as an unticked item on the opportunity's checklist.
        documents: (draft.documents ?? []).map<RequiredDocument>((name) => ({
          name,
          done: false,
        })),
      })
      .returning({ id: opportunities.id });

    if (draft.contactName || draft.contactEmail) {
      await db.insert(contacts).values({
        userId: user.id,
        companyId,
        opportunityId: row.id,
        name: draft.contactName ?? draft.contactEmail!,
        email: draft.contactEmail ?? null,
      });
    }

    await logActivity({
      userId: user.id,
      opportunityId: row.id,
      companyId,
      kind: "imported",
      message: "Imported from research",
    });

    created += 1;
  }

  refreshAll();
  return { ok: true, created };
}

function fallbackTitle(category: Category, company: string): string {
  switch (category) {
    case "workflow":
      return `Workflow automation pitch — ${company}`;
    case "speculative":
      return `Speculative outreach — ${company}`;
    case "job":
      return `Role at ${company}`;
    case "scholarship":
      return `${company} scholarship`;
    // Research imports never produce builds — the parser has no category for
    // them — but the switch must stay exhaustive.
    case "build":
      return company;
  }
}
