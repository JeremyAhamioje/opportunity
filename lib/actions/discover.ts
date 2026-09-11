"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { companies, opportunities } from "@/lib/db/schema";
import { requireViewer } from "@/lib/auth/guard";
import { discover, DiscoverError, registrableDomain } from "@/lib/discover/serpapi";
import { discoverJobs, type JobSearchOptions } from "@/lib/discover/jobs";
import { CATEGORIES, type Category } from "@/lib/domain/types";
import type { AnalyzeResult } from "./import";
import { enumValue, str } from "./shared";

/**
 * Search → discover → review → import.
 *
 * Returns `AnalyzeResult`, the same shape `analyzePaste` returns, so the
 * existing review table renders discovered companies with no changes at all.
 * Nothing is written here: discovery produces drafts exactly like a paste does,
 * and the human still decides what becomes an opportunity.
 */
export async function discoverCompanies(
  _prev: AnalyzeResult | null,
  form: FormData,
): Promise<AnalyzeResult> {
  const { user } = await requireViewer();

  const query = str(form, "query");
  if (!query) {
    return { ok: false, items: [], note: "Enter a search first.", engine: "search" };
  }

  const country = str(form, "country") ?? undefined;
  const mode = str(form, "mode") === "jobs" ? "jobs" : "companies";

  if (mode === "jobs") {
    return discoverOpenRoles(user.id, {
      query,
      location: str(form, "location") ?? undefined,
      country,
      remoteOnly: form.get("remoteOnly") !== null,
    });
  }

  const category = enumValue<Category>(form, "category", CATEGORIES, "speculative");

  let result: Awaited<ReturnType<typeof discover>>;
  try {
    result = await discover({ query, category, country });
  } catch (error) {
    return {
      ok: false,
      items: [],
      engine: "search",
      note: "Search failed.",
      error: error instanceof DiscoverError ? error.message : "Search failed.",
    };
  }

  /*
   * Drop anything already in the pipeline before it reaches review.
   *
   * Search returns the same strong domains for every related query, so without
   * this the second search of an evening is mostly rows you already have — and
   * the reviewer stops reading carefully, which is when bad rows get imported.
   */
  const db = await getDb();
  const existing = await db
    .select({ website: companies.website, name: companies.name })
    .from(companies)
    .where(eq(companies.userId, user.id));

  const knownDomains = new Set<string>();
  const knownNames = new Set<string>();
  for (const row of existing) {
    knownNames.add(row.name.trim().toLowerCase());
    if (!row.website) continue;
    try {
      knownDomains.add(registrableDomain(new URL(row.website).hostname.replace(/^www\./i, "")));
    } catch {
      /* a malformed stored URL should not break discovery */
    }
  }

  const fresh = result.items.filter((item) => {
    if (knownNames.has(item.companyName.trim().toLowerCase())) return false;
    if (!item.website) return true;
    try {
      const domain = registrableDomain(new URL(item.website).hostname.replace(/^www\./i, ""));
      return !knownDomains.has(domain);
    } catch {
      return true;
    }
  });

  const alreadyKnown = result.items.length - fresh.length;

  const parts = [
    `${fresh.length} new ${fresh.length === 1 ? "company" : "companies"} from ${result.rawCount} results.`,
  ];
  if (alreadyKnown) parts.push(`${alreadyKnown} already in your pipeline.`);
  if (result.skippedDirectories) {
    parts.push(`${result.skippedDirectories} directories and social pages skipped.`);
  }
  parts.push("Search gives you the company and the site — everything else is still your research.");

  return {
    ok: fresh.length > 0,
    items: fresh,
    engine: "search",
    note: parts.join(" "),
  };
}

/**
 * Open roles, deduped against what is already in the pipeline.
 *
 * A job is identified by company plus title rather than by URL: the same
 * posting appears under a different aggregator link every time it is
 * re-syndicated, so matching on URL would let the same role in repeatedly.
 */
async function discoverOpenRoles(
  userId: string,
  options: JobSearchOptions,
): Promise<AnalyzeResult> {
  let result: Awaited<ReturnType<typeof discoverJobs>>;
  try {
    result = await discoverJobs(options);
  } catch (error) {
    return {
      ok: false,
      items: [],
      engine: "search",
      note: "Job search failed.",
      error: error instanceof DiscoverError ? error.message : "Job search failed.",
    };
  }

  const db = await getDb();
  const existing = await db
    .select({ title: opportunities.title, company: companies.name })
    .from(opportunities)
    .leftJoin(companies, eq(opportunities.companyId, companies.id))
    .where(eq(opportunities.userId, userId));

  const known = new Set(
    existing.map((row) => `${(row.company ?? "").trim().toLowerCase()}::${row.title.trim().toLowerCase()}`),
  );

  const fresh = result.items.filter(
    (item) =>
      !known.has(`${item.companyName.trim().toLowerCase()}::${(item.title ?? "").trim().toLowerCase()}`),
  );

  const alreadyKnown = result.items.length - fresh.length;

  const parts = [
    `${fresh.length} new ${fresh.length === 1 ? "role" : "roles"} from ${result.rawCount} postings.`,
  ];
  if (alreadyKnown) parts.push(`${alreadyKnown} already in your pipeline.`);
  if (result.skippedNonRemote) parts.push(`${result.skippedNonRemote} not flagged remote.`);
  if (result.skippedFarms) parts.push(`${result.skippedFarms} reposting sites skipped.`);
  parts.push("Google does not publish closing dates, so check each posting is still open before applying.");

  return { ok: fresh.length > 0, items: fresh, engine: "search", note: parts.join(" ") };
}
