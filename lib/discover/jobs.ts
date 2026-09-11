import type { ParsedOpportunity } from "@/lib/parse/research";
import { DiscoverError } from "./serpapi";

/**
 * Job discovery via SerpApi's `google_jobs` engine.
 *
 * The second connector, and the reason the first one was worth shaping the way
 * it was: this returns the same `ParsedOpportunity[]`, so the review table,
 * dedupe, company resolution and import writer are all reused untouched. The
 * only new code is the mapping from one API's shape to the contract.
 */

const ENDPOINT = "https://serpapi.com/search.json";
const TIMEOUT_MS = 30_000;

export const MAX_JOBS = 25;

export type JobSearchOptions = {
  query: string;
  /** Free-text locality Google understands — "Nigeria", "Remote", "London". */
  location?: string;
  country?: string;
  /** Keep only postings Google itself flags as work-from-home. */
  remoteOnly?: boolean;
  limit?: number;
};

type SerpJobResult = {
  title?: string;
  company_name?: string;
  location?: string;
  via?: string;
  description?: string;
  share_link?: string;
  job_highlights?: { title?: string; items?: string[] }[];
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
    salary?: string;
    work_from_home?: boolean;
  };
  apply_options?: { title?: string; link?: string }[];
};

/**
 * Matched as whole words against the posting text. A fixed vocabulary rather
 * than free extraction: it can only ever return things that are actually
 * technologies, so a skills list can never fill up with words like "fast-paced".
 */
const TECH = [
  "JavaScript", "TypeScript", "Python", "Ruby", "Rails", "Java", "Kotlin", "Swift",
  "Go", "Rust", "PHP", "C#", "C++", "Scala", "Elixir", "Perl", "Bash",
  "React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "Remix", "jQuery",
  "Node.js", "Deno", "Express", "NestJS", "Django", "Flask", "FastAPI", "Laravel",
  "Spring Boot", "Spring", ".NET",
  "PostgreSQL", "Postgres", "MySQL", "MongoDB", "Redis", "SQLite", "DynamoDB",
  "Elasticsearch", "Kafka", "RabbitMQ", "GraphQL", "REST", "gRPC",
  "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "Linux", "Nginx",
  "CI/CD", "Git", "GitHub", "GitLab", "Jenkins",
  "Tailwind", "CSS", "SCSS", "Sass", "HTML", "Webpack", "Vite",
  "Supabase", "Firebase", "Prisma", "Drizzle", "Playwright", "Cypress", "Jest",
  "Selenium", "Puppeteer", "Scrapy", "BeautifulSoup", "Pandas", "NumPy",
  "Figma", "Storybook", "Sentry", "Datadog",
];

/**
 * Reposting farms scrape real listings and republish them under their own name,
 * so Google returns them as the employer. Importing one creates a company
 * called "remote zest jobs" and an application link that leads to a copy of a
 * posting rather than the employer's own board.
 */
const FARM_NAME = /\b(jobs?|vacanc(y|ies)|hiring|recruit\w*|staffing|careers?|placements?)\b/i;

/**
 * Nobody's real careers page is on a free hosting subdomain. This is the
 * clearest single signal that a "company" is a scraper republishing listings.
 */
const THROWAWAY_HOST =
  /\.(up\.railway\.app|vercel\.app|netlify\.app|herokuapp\.com|onrender\.com|glitch\.me|repl\.co)$/i;

const AGGREGATOR_HOST =
  /(linkedin|indeed|ziprecruiter|glassdoor|monster|talent\.com|jooble|adzuna|jobright|jobleads|remotejobs|phillyhired|simplyhired|neuvoo|careerjet|jobrapido|lensa|vaia\.com|jobsinjs)/i;

function looksLikeFarm(company: string, applyUrl: string | undefined): boolean {
  if (FARM_NAME.test(company)) return true;
  if (!applyUrl) return false;
  try {
    return THROWAWAY_HOST.test(new URL(applyUrl).hostname);
  } catch {
    return false;
  }
}

export async function discoverJobs(options: JobSearchOptions): Promise<{
  items: ParsedOpportunity[];
  searched: string;
  rawCount: number;
  skippedNonRemote: number;
  skippedFarms: number;
}> {
  const key = process.env.SERPAPI_KEY?.trim();
  if (!key) throw new DiscoverError("SERPAPI_KEY is not set.");

  const query = options.query.trim();
  if (!query) throw new DiscoverError("Enter a role to search for.");

  const url = new URL(ENDPOINT);
  url.searchParams.set("engine", "google_jobs");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", key);
  url.searchParams.set("hl", "en");
  if (options.location) url.searchParams.set("location", options.location);
  if (options.country) url.searchParams.set("gl", options.country);

  let payload: { jobs_results?: SerpJobResult[]; error?: string };
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = await response.text();

    try {
      payload = JSON.parse(body);
    } catch {
      throw new DiscoverError(`SerpApi returned ${response.status} and not JSON.`);
    }

    /*
     * google_jobs reports "no results" as an error string rather than an empty
     * array, so a genuinely empty search would otherwise surface as a failure.
     */
    if (payload.error) {
      if (/hasn't returned any results|no results/i.test(payload.error)) {
        return { items: [], searched: query, rawCount: 0, skippedNonRemote: 0, skippedFarms: 0 };
      }
      throw new DiscoverError(payload.error);
    }
    if (!response.ok) throw new DiscoverError(`SerpApi returned ${response.status}.`);
  } catch (error) {
    if (error instanceof DiscoverError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new DiscoverError("SerpApi timed out.");
    }
    throw new DiscoverError(error instanceof Error ? error.message : "Search failed.");
  }

  const results = Array.isArray(payload.jobs_results) ? payload.jobs_results : [];
  const limit = Math.min(options.limit ?? MAX_JOBS, MAX_JOBS);

  const items: ParsedOpportunity[] = [];
  const seen = new Set<string>();
  let skippedNonRemote = 0;
  let skippedFarms = 0;

  for (const job of results) {
    if (items.length >= limit) break;

    const company = str(job.company_name);
    const title = str(job.title);
    if (!company || !title) continue;

    const remote = job.detected_extensions?.work_from_home === true;
    if (options.remoteOnly && !remote) {
      skippedNonRemote += 1;
      continue;
    }

    /*
     * The same posting is syndicated to LinkedIn, Indeed, ZipRecruiter and the
     * company's own board, and Google returns each. One row per role.
     */
    const identity = `${company.toLowerCase()}::${title.toLowerCase()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    const apply = applyLink(job, company);

    // No way to apply, or an obvious reposting farm — either way it is not an
    // opportunity, it is a row you would delete later.
    if (!apply || looksLikeFarm(company, apply)) {
      skippedFarms += 1;
      continue;
    }

    items.push({
      category: "job",
      companyName: company.slice(0, 120),
      title: title.slice(0, 200),
      applicationUrl: apply,
      location: str(job.location),
      workMode: remote ? "remote" : undefined,
      salary: str(job.detected_extensions?.salary),
      skills: technologiesIn(job),
      notes: buildNote(query, job),
      confidence: "medium",
    });
  }

  return { items, searched: query, rawCount: results.length, skippedNonRemote, skippedFarms };
}

/**
 * Picks where to actually apply.
 *
 * Google's `apply_options` are not all the same job. Low-quality aggregators
 * syndicate a posting and attach their own unrelated listing, so naively taking
 * the first non-aggregator link can send you to a different role at a different
 * company — which is worse than an aggregator link, because it looks correct.
 *
 * Ranked, best first:
 *   1. the employer's own domain or ATS subdomain (verifiable against the name)
 *   2. a known applicant-tracking system
 *   3. anything else, as a last resort
 */
const ATS_HOST =
  /(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|applytojob\.com|bamboohr\.com|jobvite\.com|smartrecruiters\.com|recruitee\.com|teamtailor\.com|myworkdayjobs\.com|breezy\.hr|pinpointhq\.com|rippling\.com)/i;

function applyLink(job: SerpJobResult, company: string): string | undefined {
  const options = (job.apply_options ?? []).filter((option) => Boolean(option.link));
  if (!options.length) return str(job.share_link);

  // "Socket.dev" -> "socketdev"; used as a substring test against the host.
  const slug = company.toLowerCase().replace(/[^a-z0-9]/g, "");

  const score = (link: string): number => {
    const host = hostname(link).toLowerCase();
    if (!host) return 0;
    if (THROWAWAY_HOST.test(host)) return 0;

    const hostSlug = host.replace(/[^a-z0-9]/g, "");
    if (slug.length >= 4 && hostSlug.includes(slug)) return 3;
    if (ATS_HOST.test(host)) return 2;
    if (AGGREGATOR_HOST.test(host)) return 1;
    return 1;
  };

  const best = options
    .map((option) => ({ link: option.link!, rank: score(option.link!) }))
    .sort((a, b) => b.rank - a.rank)[0];

  if (best?.rank) return best.link;

  /*
   * `share_link` is a Google *search* URL, not an application. Returning it
   * would put a row in the pipeline that looks applicable and is not, so it is
   * treated as no link at all and the posting is dropped upstream.
   */
  return undefined;
}


function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function technologiesIn(job: SerpJobResult): string[] | undefined {
  const haystack = [
    job.description ?? "",
    ...(job.job_highlights ?? []).flatMap((section) => section.items ?? []),
  ].join(" ");
  if (!haystack.trim()) return undefined;

  const found = TECH.filter((tech) => {
    // Escaped because the vocabulary contains ".", "+" and "#".
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, "i").test(haystack);
  });

  return found.length ? found : undefined;
}

function buildNote(query: string, job: SerpJobResult): string {
  const detected = job.detected_extensions ?? {};
  const facts = [
    detected.posted_at ? `Posted ${detected.posted_at}` : null,
    detected.schedule_type ?? null,
    job.via ? job.via.replace(/^via\s+/i, "Listed via ") : null,
  ].filter(Boolean);

  // Qualifications are the part worth reading before applying; the rest of a
  // job description is boilerplate.
  const qualifications = (job.job_highlights ?? [])
    .filter((section) => /qualification|requirement/i.test(section.title ?? ""))
    .flatMap((section) => section.items ?? [])
    .slice(0, 6);

  const description = str(job.description)?.slice(0, 600);

  return [
    facts.length ? facts.join(" · ") : null,
    qualifications.length ? `Qualifications:\n${qualifications.map((q) => `• ${q}`).join("\n")}` : null,
    description,
    `Found via job search: "${query}".`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function str(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}
