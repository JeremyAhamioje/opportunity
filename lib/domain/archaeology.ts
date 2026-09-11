/**
 * Vocabulary for the idea-archaeology layer. Kept free of Drizzle imports so it
 * can be used from client components, the extraction schema and the database
 * schema alike — same rule as `types.ts`.
 */

export const CONVERSATION_SOURCES = ["chatgpt", "claude", "gemini", "manual"] as const;
export type ConversationSource = (typeof CONVERSATION_SOURCES)[number];

export const SOURCE_META: Record<ConversationSource, { label: string; icon: string }> = {
  chatgpt: { label: "ChatGPT", icon: "◍" },
  claude: { label: "Claude", icon: "✳" },
  gemini: { label: "Gemini", icon: "✦" },
  manual: { label: "Pasted", icon: "❏" },
};

export const INGEST_STATUSES = ["pending", "extracting", "done", "failed", "skipped"] as const;
export type IngestStatus = (typeof INGEST_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/*  Insights                                                                  */
/* -------------------------------------------------------------------------- */

export const INSIGHT_KINDS = [
  "idea",
  "project",
  "goal",
  "commitment",
  "decision",
  "problem",
  "opportunity",
  "task",
] as const;
export type InsightKind = (typeof INSIGHT_KINDS)[number];

export const INSIGHT_KIND_META: Record<
  InsightKind,
  { label: string; plural: string; icon: string; blurb: string }
> = {
  idea: {
    label: "Idea",
    plural: "Ideas",
    icon: "💡",
    blurb: "Something you thought might be worth making.",
  },
  project: {
    label: "Project",
    plural: "Projects",
    icon: "🔨",
    blurb: "Something you said you intend to build.",
  },
  goal: {
    label: "Goal",
    plural: "Goals",
    icon: "🎯",
    blurb: "An outcome you want.",
  },
  commitment: {
    label: "Commitment",
    plural: "Commitments",
    icon: "🤝",
    blurb: "Something you said you would do.",
  },
  decision: {
    label: "Decision",
    plural: "Decisions",
    icon: "⚖",
    blurb: "A conclusion you reached, so you need not re-argue it.",
  },
  problem: {
    label: "Problem",
    plural: "Problems",
    icon: "⚠",
    blurb: "A recurring problem you want solved.",
  },
  opportunity: {
    label: "Opportunity",
    plural: "Opportunities",
    icon: "🎣",
    blurb: "A job, lead, or opening worth pursuing.",
  },
  task: {
    label: "Task",
    plural: "Tasks",
    icon: "✓",
    blurb: "A specific action.",
  },
};

/**
 * How firmly the thing was expressed — deliberately separate from `confidence`,
 * which is how sure the extractor is that it read the text correctly.
 *
 * Collapsing the two is exactly how a brainstorm turns into a to-do list: a
 * high-confidence reading of "could something like this work?" is still an idle
 * musing, and must not become a task.
 */
export const STANCES = ["explicit", "proposed", "discussed", "abandoned"] as const;
export type Stance = (typeof STANCES)[number];

export const STANCE_META: Record<Stance, { label: string; hint: string; weight: number }> = {
  explicit: { label: "Explicit", hint: "“I'm going to build this.”", weight: 3 },
  proposed: { label: "Proposed", hint: "“Maybe I should build this.”", weight: 2 },
  discussed: { label: "Discussed", hint: "“Could something like this work?”", weight: 1 },
  abandoned: { label: "Abandoned", hint: "“I won't pursue this.”", weight: 0 },
};

export const INSIGHT_STATUSES = ["open", "promoted", "done", "archived", "dropped"] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

export const INSIGHT_STATUS_META: Record<InsightStatus, { label: string }> = {
  open: { label: "Open" },
  promoted: { label: "Promoted" },
  done: { label: "Done" },
  archived: { label: "Archived" },
  dropped: { label: "Dropped" },
};

/** Statuses that keep an insight in the working set. */
export const LIVE_STATUSES: InsightStatus[] = ["open"];

/* -------------------------------------------------------------------------- */
/*  Mentions & links                                                          */
/* -------------------------------------------------------------------------- */

/**
 * What a given mention did to the idea. This is what makes the evolution view
 * readable — "Property Management SaaS" introduced in June, reversed in August,
 * decided in September — rather than a flat list of eleven identical hits.
 */
export const MOVEMENTS = [
  "introduced",
  "developed",
  "decided",
  "reversed",
  "abandoned",
  "revived",
] as const;
export type Movement = (typeof MOVEMENTS)[number];

export const MOVEMENT_META: Record<Movement, { label: string; icon: string }> = {
  introduced: { label: "First raised", icon: "◆" },
  developed: { label: "Developed", icon: "→" },
  decided: { label: "Decided", icon: "⚖" },
  reversed: { label: "Changed direction", icon: "↩" },
  abandoned: { label: "Set aside", icon: "✕" },
  revived: { label: "Picked back up", icon: "↑" },
};

export const LINK_KINDS = [
  "relates_to",
  "evolves_into",
  "depends_on",
  "part_of",
  "duplicate_of",
] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const LINK_KIND_META: Record<LinkKind, { label: string; inverse: string }> = {
  relates_to: { label: "Related to", inverse: "Related to" },
  evolves_into: { label: "Became", inverse: "Grew out of" },
  depends_on: { label: "Depends on", inverse: "Blocks" },
  part_of: { label: "Part of", inverse: "Includes" },
  duplicate_of: { label: "Possibly the same as", inverse: "Possibly the same as" },
};

export const LINK_STATUSES = ["suggested", "confirmed", "rejected"] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/*  Thresholds                                                                */
/* -------------------------------------------------------------------------- */

/**
 * An idea is "forgotten" when it was developed enough to matter, was never
 * explicitly dropped, and has gone quiet. Two mentions is the floor because a
 * single passing remark is not a forgotten idea, it is a passing remark.
 */
export const FORGOTTEN = { minMentions: 2, quietDays: 30 } as const;

/** Mentioned this often and it is a theme, not a thought. */
export const RECURRING_MIN_MENTIONS = 3;

/** Below this the extractor was guessing; kept, but not surfaced by default. */
export const LOW_CONFIDENCE = 55;

/* -------------------------------------------------------------------------- */
/*  Deduplication key                                                         */
/* -------------------------------------------------------------------------- */

const STOP_WORDS = new Set([
  "a", "an", "and", "app", "application", "for", "from", "in", "into", "my", "of",
  "on", "or", "platform", "project", "software", "system", "the", "to", "tool",
  "with", "build", "building", "create", "creating", "make", "making", "new",
]);

/**
 * A cheap, deterministic identity for a title: lowercased, punctuation dropped,
 * filler removed, remaining words sorted. "Job Application Tracker" and
 * "Tracker for job applications" collapse to the same key, so the second
 * mention lands on the first insight instead of creating a twin.
 *
 * Deliberately conservative — it only ever produces exact-match merges. Anything
 * subtler goes through the suggestion queue where a human decides.
 */
export function insightKey(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .map((word) => word.replace(/(?<=.{4})s$/, "")) // crude singularisation
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));

  const unique = [...new Set(words)].sort();
  return unique.length ? unique.join(" ") : title.trim().toLowerCase();
}

/** Jaccard overlap of the key tokens — 1 is identical, 0 shares nothing. */
export function keySimilarity(a: string, b: string): number {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;

  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/** Above this two titles are probably the same thing — probably, so we ask. */
export const DUPLICATE_THRESHOLD = 0.55;
