import type { ParsedOpportunity } from "@/lib/parse/research";
import type { Category } from "@/lib/domain/types";

/**
 * Search-result discovery via SerpApi.
 *
 * This is a *source*, not a subsystem. It returns exactly the
 * `ParsedOpportunity` shape the research parser already returns, so the review
 * table, the dedupe, the company resolution and the import writer are all
 * untouched — the contract was the thing that made this small.
 *
 * The same reasoning as the acquisition layer in the evidence engine: any new
 * connector returns the agreed shape and nothing downstream changes.
 */

const ENDPOINT = "https://serpapi.com/search.json";
const TIMEOUT_MS = 30_000;

/** Each call spends a search credit, so the ceiling is deliberate and low. */
export const MAX_RESULTS = 30;

export class DiscoverError extends Error {}

/**
 * Hosts that are never the company you are looking for.
 *
 * This list is most of what separates "a lead list" from "a page of Google
 * results". A search for operators in a niche returns directories, job boards
 * and social profiles far more often than it returns the operators, and
 * importing those produces a pipeline full of rows called "LinkedIn".
 */
const DIRECTORIES = new Set([
  "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
  "youtube.com", "tiktok.com", "pinterest.com", "reddit.com", "quora.com",
  "wikipedia.org", "wikiwand.com", "medium.com", "substack.com",
  "indeed.com", "glassdoor.com", "ziprecruiter.com", "monster.com",
  "yelp.com", "yellowpages.com", "bbb.org", "trustpilot.com", "g2.com",
  "capterra.com", "getapp.com", "softwareadvice.com", "crunchbase.com",
  "pitchbook.com", "bloomberg.com", "zoominfo.com", "apollo.io",
  "amazon.com", "ebay.com", "etsy.com", "apple.com", "play.google.com",
  "github.com", "stackoverflow.com", "producthunt.com", "angel.co",
  "wellfound.com", "clutch.co", "upwork.com", "fiverr.com", "thumbtack.com",
  "forbes.com", "techcrunch.com", "businessinsider.com", "inc.com",
]);

/** Second-level suffixes, so "acme.co.uk" is one registrable name, not "co.uk". */
const TWO_PART_TLDS = new Set([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "co.za", "co.ke", "com.ng", "org.ng",
  "com.au", "co.nz", "com.br", "co.jp", "co.in", "com.sg", "com.eg", "com.gh",
]);

export type DiscoverOptions = {
  query: string;
  category: Category;
  /** Google's country code — where the search is run from, not who is searched. */
  country?: string;
  limit?: number;
};

type SerpOrganicResult = {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
  displayed_link?: string;
  source?: string;
};

export async function discover(options: DiscoverOptions): Promise<{
  items: ParsedOpportunity[];
  searched: string;
  rawCount: number;
  skippedDirectories: number;
}> {
  const key = process.env.SERPAPI_KEY?.trim();
  if (!key) throw new DiscoverError("SERPAPI_KEY is not set.");

  const query = options.query.trim();
  if (!query) throw new DiscoverError("Enter something to search for.");

  const limit = Math.min(options.limit ?? MAX_RESULTS, MAX_RESULTS);

  const url = new URL(ENDPOINT);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", key);
  url.searchParams.set("num", String(limit));
  url.searchParams.set("hl", "en");
  if (options.country) url.searchParams.set("gl", options.country);

  let payload: { organic_results?: SerpOrganicResult[]; error?: string };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await response.text();

    try {
      payload = JSON.parse(body);
    } catch {
      throw new DiscoverError(`SerpApi returned ${response.status} and not JSON.`);
    }

    // SerpApi reports quota and key problems in a 200 body, not a status code.
    if (payload.error) throw new DiscoverError(payload.error);
    if (!response.ok) throw new DiscoverError(`SerpApi returned ${response.status}.`);
  } catch (error) {
    if (error instanceof DiscoverError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new DiscoverError("SerpApi timed out.");
    }
    throw new DiscoverError(error instanceof Error ? error.message : "Search failed.");
  }

  const results = Array.isArray(payload.organic_results) ? payload.organic_results : [];

  const items: ParsedOpportunity[] = [];
  const seen = new Set<string>();
  let skippedDirectories = 0;

  for (const result of results) {
    const link = str(result.link);
    if (!link) continue;

    const host = hostOf(link);
    if (!host) continue;

    const domain = registrableDomain(host);
    if (DIRECTORIES.has(domain)) {
      skippedDirectories += 1;
      continue;
    }

    // One row per company, not one per page — a single site can occupy several
    // positions for the same query.
    if (seen.has(domain)) continue;
    seen.add(domain);

    items.push({
      category: options.category,
      companyName: companyNameFrom(result, domain),
      website: `https://${host}`,
      industry: undefined,
      location: undefined,
      notes: buildNote(query, result),
      // Deliberately absent: no contact name, no email, no size, no score.
      // Search results do not contain those, and inventing them is how a
      // pipeline fills up with plausible rows that turn out to be fiction.
      confidence: "medium",
    });
  }

  return { items, searched: query, rawCount: results.length, skippedDirectories };
}

/**
 * A readable company name. The page title is usually "Acme Ltd | Property
 * Management in Leeds" — the part before the separator is the name, and the
 * domain is the fallback when the title is a sentence.
 */
function companyNameFrom(result: SerpOrganicResult, domain: string): string {
  const title = str(result.title);
  const fallback = prettyDomain(domain);
  if (!title) return fallback;

  // The colon form has no leading space ("Sapir Realty: Atlanta Property
  // Management"), so it is split separately from the spaced separators.
  const head = title
    .split(/\s+[|–—·»]\s+|\s+-\s+|:\s+/)[0]
    ?.replace(/\s*\(\d{4}\)\s*$/, "")
    .trim();

  if (!head || head.length < 2 || head.length > 60 || countWords(head) > 6) return fallback;

  /*
   * A page title is only the company's name if it looks like the domain does.
   *
   * Search results for any commercial query are full of SEO headings — "Best
   * Property Management Companies Atlanta", "Atlanta Property Managers" — which
   * are perfectly good titles and completely wrong as company names. Requiring
   * a shared distinctive word between the title and the domain separates a
   * brand from a category phrase without maintaining a stopword list.
   */
  const domainWord = domain.split(".")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  const shared = head
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4)
    .some((word) => domainWord.includes(word) || word.includes(domainWord));

  return shared ? head : fallback;
}

/** "target-freight.co.uk" -> "Target Freight". */
function prettyDomain(domain: string): string {
  const name = domain.split(".")[0] ?? domain;
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function buildNote(query: string, result: SerpOrganicResult): string {
  const snippet = str(result.snippet);
  const position = typeof result.position === "number" ? `#${result.position}` : null;
  // The query is recorded so a row can always answer "why is this here?".
  const provenance = `Found via search: "${query}"${position ? ` (result ${position})` : ""}.`;
  return snippet ? `${snippet}\n\n${provenance}` : provenance;
}

function hostOf(link: string): string | null {
  try {
    const url = new URL(link);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function registrableDomain(host: string): string {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join(".");
  return TWO_PART_TLDS.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}
