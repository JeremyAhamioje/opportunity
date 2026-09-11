/**
 * Domain vocabulary. Kept free of Drizzle imports so it can be used from
 * client components, the scoring engine, and the schema alike.
 */

export const CATEGORIES = [
  "workflow",
  "speculative",
  "job",
  "scholarship",
  "build",
] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * Builds are things you make, not shots you take at someone else — a demo to
 * carry an application, or a product idea worth keeping alive. They are a
 * category rather than a second entity type on purpose: one table means the
 * follow-up engine, search, analytics and the activity timeline all work for
 * them the day they are added, with no parallel machinery to keep in step.
 */
export const OUTREACH_CATEGORIES: Category[] = [
  "workflow",
  "speculative",
  "job",
  "scholarship",
];

export const STAGES = [
  "sourced",
  "researching",
  "qualified",
  "ready",
  "sent",
  "followup",
  "response",
  "interview",
  "won",
  "lost",
] as const;
export type Stage = (typeof STAGES)[number];

/** Stages that mean the shot has actually left the building. */
export const SENT_STAGES: Stage[] = [
  "sent",
  "followup",
  "response",
  "interview",
  "won",
  "lost",
];

/** Stages where the opportunity is still live and worth working. */
export const OPEN_STAGES: Stage[] = [
  "sourced",
  "researching",
  "qualified",
  "ready",
  "sent",
  "followup",
  "response",
  "interview",
];

export const CLOSED_STAGES: Stage[] = ["won", "lost"];

export const EMAIL_STATUSES = [
  "none",
  "draft",
  "ready",
  "sent",
  "replied",
  "no_response",
  "followup_sent",
] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const ACTION_TYPES = [
  "apply",
  "email",
  "linkedin",
  "call",
  "followup",
  "research",
  "demo",
  "portfolio",
  "documents",
  "other",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ACTION_STATUSES = ["todo", "doing", "done", "skipped"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];

export const WORK_MODES = ["remote", "hybrid", "onsite"] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const ACTIVITY_KINDS = [
  "created",
  "stage",
  "outreach",
  "followup",
  "response",
  "action",
  "note",
  "imported",
] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
] as const;

/** Buyer archetypes from SOP step 5. */
export const BUYER_ROLES = [
  "Founder / CEO",
  "COO",
  "Operations Manager",
  "Head of Finance",
  "Property Manager",
  "Agency Owner",
  "Department Head",
  "Head of Engineering",
  "Office Manager",
  "Other",
] as const;

export type RequiredDocument = { name: string; done: boolean };

export type DailyGoal = {
  id: string;
  label: string;
  target: number;
  /** Which counter fulfils this goal, so progress is measured not self-reported. */
  metric: GoalMetric;
};

export const GOAL_METRICS = [
  "applications",
  "outreach",
  "followups",
  "research",
  "added",
] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];

/** What each metric counts, stated plainly so a goal can never be vague. */
export const GOAL_METRIC_META: Record<GoalMetric, { label: string; counts: string }> = {
  applications: {
    label: "Applications sent",
    counts: "Jobs and scholarships marked sent today",
  },
  outreach: {
    label: "Outreach sent",
    counts: "Workflow pitches and speculative shots marked sent today",
  },
  followups: { label: "Follow-ups sent", counts: "Follow-ups logged today" },
  research: { label: "Pipeline moves", counts: "Opportunities moved to a new stage today" },
  added: { label: "Opportunities added", counts: "New opportunities created today" },
};

export const SCORE_FACTORS = [
  "repetition",
  "frequency",
  "pain",
  "automability",
  "financialValue",
  "decisionMaker",
  "capability",
] as const;
export type ScoreFactor = (typeof SCORE_FACTORS)[number];
export type ScoringWeights = Record<ScoreFactor, number>;

export type SopStep = {
  id: string;
  title: string;
  hint?: string;
  items: { id: string; label: string }[];
};
export type SopChecklist = { steps: SopStep[] };

/* -------------------------------------------------------------------------- */
/*  Presentation metadata                                                     */
/* -------------------------------------------------------------------------- */

export const CATEGORY_META: Record<
  Category,
  { label: string; short: string; icon: string; accent: string; blurb: string }
> = {
  workflow: {
    label: "Workflow Opportunity",
    short: "Workflow",
    icon: "🛠",
    accent: "violet",
    blurb: "A manual process you could automate away.",
  },
  speculative: {
    label: "Speculative Shot",
    short: "Speculative",
    icon: "🎯",
    accent: "amber",
    blurb: "Not hiring — but worth contacting anyway.",
  },
  job: {
    label: "Active Job",
    short: "Job",
    icon: "💼",
    accent: "blue",
    blurb: "An open role you can apply to today.",
  },
  scholarship: {
    label: "Scholarship",
    short: "Scholarship",
    icon: "🎓",
    accent: "green",
    blurb: "Funding and educational opportunities.",
  },
  build: {
    label: "Build",
    short: "Build",
    icon: "🔨",
    accent: "cyan",
    blurb: "Something to make — a demo, a product, a proof.",
  },
};

/* -------------------------------------------------------------------------- */
/*  Builds run through the same ten stages, under their own names             */
/* -------------------------------------------------------------------------- */

/**
 * A build has no outreach, so "Application Sent" and "Interview" mean nothing to
 * it — but inventing a second stage enum would fork every query, index and
 * count in the app. Instead the same ten stages are relabelled here, and the
 * three that only make sense for outreach fold into "Building" so a build can
 * never land in a stage the lane cannot show.
 */
export const BUILD_STAGE_META: Record<Stage, { label: string; short: string }> = {
  sourced: { label: "Idea", short: "Idea" },
  researching: { label: "Scoping", short: "Scoping" },
  qualified: { label: "Worth building", short: "Committed" },
  ready: { label: "Ready to build", short: "Ready" },
  sent: { label: "Building", short: "Building" },
  followup: { label: "Building", short: "Building" },
  response: { label: "Building", short: "Building" },
  interview: { label: "Building", short: "Building" },
  won: { label: "Shipped", short: "Shipped" },
  lost: { label: "Dropped", short: "Dropped" },
};

/** The columns the build lane actually renders, in order. */
export const BUILD_LANES: Stage[] = [
  "sourced",
  "researching",
  "qualified",
  "ready",
  "sent",
  "won",
  "lost",
];

/** Which lane a build appears in — the outreach-only stages fold into Building. */
export function buildLaneOf(stage: Stage): Stage {
  return stage === "followup" || stage === "response" || stage === "interview"
    ? "sent"
    : stage;
}

/** Stage labels that read correctly for the category being shown. */
export function stageLabel(stage: Stage, category: Category, short = false): string {
  const meta = category === "build" ? BUILD_STAGE_META[stage] : STAGE_META[stage];
  return short ? meta.short : meta.label;
}

export const STAGE_META: Record<
  Stage,
  { label: string; short: string; group: "find" | "qualify" | "shoot" | "close" }
> = {
  sourced: { label: "Sourced", short: "Sourced", group: "find" },
  researching: { label: "Researching", short: "Research", group: "qualify" },
  qualified: { label: "Qualified", short: "Qualified", group: "qualify" },
  ready: { label: "Ready to Act", short: "Ready", group: "shoot" },
  sent: { label: "Application / Outreach Sent", short: "Sent", group: "shoot" },
  followup: { label: "Follow-up", short: "Follow-up", group: "shoot" },
  response: { label: "Response Received", short: "Response", group: "close" },
  interview: { label: "Interview / Discussion", short: "Interview", group: "close" },
  won: { label: "Won", short: "Won", group: "close" },
  lost: { label: "Lost", short: "Lost", group: "close" },
};

export const EMAIL_STATUS_META: Record<EmailStatus, string> = {
  none: "Not started",
  draft: "Draft",
  ready: "Ready to send",
  sent: "Sent",
  replied: "Replied",
  no_response: "No response",
  followup_sent: "Follow-up sent",
};

export const ACTION_TYPE_META: Record<ActionType, { label: string; icon: string }> = {
  apply: { label: "Apply", icon: "📤" },
  email: { label: "Email founder", icon: "✉️" },
  linkedin: { label: "LinkedIn message", icon: "in" },
  call: { label: "Call", icon: "📞" },
  followup: { label: "Follow up", icon: "🔁" },
  research: { label: "Research", icon: "🔎" },
  demo: { label: "Build demo", icon: "⚙️" },
  portfolio: { label: "Prepare portfolio", icon: "📁" },
  documents: { label: "Prepare documents", icon: "📄" },
  other: { label: "Other", icon: "•" },
};

export const SENTIMENT_META: Record<Sentiment, { label: string; tone: string }> = {
  positive: { label: "Positive", tone: "good" },
  neutral: { label: "Neutral", tone: "warn" },
  negative: { label: "Rejection", tone: "bad" },
};

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                  */
/* -------------------------------------------------------------------------- */

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  repetition: 1,
  frequency: 1,
  pain: 1,
  automability: 1,
  financialValue: 1,
  decisionMaker: 1,
  capability: 1,
};

export const SCORE_FACTOR_META: Record<
  ScoreFactor,
  { label: string; hint: string }
> = {
  repetition: {
    label: "Repetition",
    hint: "How repetitive is the task? Identical every time scores 10.",
  },
  frequency: {
    label: "Frequency",
    hint: "Hundreds of times a month scores 10. Once a quarter scores 1.",
  },
  pain: {
    label: "Pain",
    hint: "Slow turnarounds, complaints, headcount thrown at it.",
  },
  automability: {
    label: "Automability",
    hint: "Rules-based and machine-accessible data scores high.",
  },
  financialValue: {
    label: "Financial value",
    hint: "What is solving this worth to them per year?",
  },
  decisionMaker: {
    label: "Decision maker access",
    hint: "Can you reach the person who owns the budget?",
  },
  capability: {
    label: "My capability",
    hint: "Could you actually build this, today, alone?",
  },
};

export const DEFAULT_DAILY_GOALS: DailyGoal[] = [
  { id: "apply", label: "Apply to 3 jobs", target: 3, metric: "applications" },
  { id: "contact", label: "Contact 2 companies", target: 2, metric: "outreach" },
  { id: "followup", label: "Follow up with 4 leads", target: 4, metric: "followups" },
  { id: "research", label: "Research 5 new companies", target: 5, metric: "added" },
];

export const DEFAULT_SOP: SopChecklist = {
  steps: [
    {
      id: "step1",
      title: "Identify manual work",
      hint: "Look for evidence that employees do these by hand.",
      items: [
        { id: "s1a", label: "Copies data between systems" },
        { id: "s1b", label: "Manually processes emails" },
        { id: "s1c", label: "Enters information into spreadsheets" },
        { id: "s1d", label: "Handles repetitive customer requests" },
        { id: "s1e", label: "Processes invoices manually" },
        { id: "s1f", label: "Researches data manually" },
        { id: "s1g", label: "Moves information between portals" },
        { id: "s1h", label: "Repeatedly checks websites" },
        { id: "s1i", label: "Manages documents manually" },
        { id: "s1j", label: "Performs repetitive reporting" },
      ],
    },
    {
      id: "step2",
      title: "Check frequency",
      hint: "High-frequency repetitive tasks are worth more. How often does this happen?",
      items: [
        { id: "s2a", label: "Happens daily" },
        { id: "s2b", label: "Happens weekly" },
        { id: "s2c", label: "Happens hundreds of times per month" },
        { id: "s2d", label: "Volume confirmed with a source, not assumed" },
      ],
    },
    {
      id: "step3",
      title: "Estimate pain",
      hint: "Pain is what makes them pay. Find the evidence.",
      items: [
        { id: "s3a", label: "Slow response times" },
        { id: "s3b", label: "Hiring specifically for repetitive work" },
        { id: "s3c", label: "Large administrative team" },
        { id: "s3d", label: "Public complaints about manual processes" },
        { id: "s3e", label: "Spreadsheet-heavy workflow" },
        { id: "s3f", label: "Multiple disconnected tools" },
        { id: "s3g", label: "Signs of employee frustration" },
        { id: "s3h", label: "Long turnaround times" },
      ],
    },
    {
      id: "step4",
      title: "Determine automability",
      hint: "Score this in the Opportunity Score panel — can software actually reach the data?",
      items: [
        { id: "s4a", label: "Software can access the relevant data" },
        { id: "s4b", label: "Workflow is repetitive (scored)" },
        { id: "s4c", label: "Process is rules-based (scored)" },
        { id: "s4d", label: "AI could assist (scored)" },
        { id: "s4e", label: "Automation would reduce human work (scored)" },
      ],
    },
    {
      id: "step5",
      title: "Identify the buyer",
      hint: "Who benefits financially? Name a person, not a department.",
      items: [
        { id: "s5a", label: "Budget owner identified by name" },
        { id: "s5b", label: "Contact route found (email / LinkedIn / phone)" },
        { id: "s5c", label: "Confirmed they own this workflow" },
      ],
    },
    {
      id: "step6",
      title: "Create the opportunity",
      hint: "Current workflow → pain point → proposed solution → expected benefit → decision maker → outreach angle.",
      items: [
        { id: "s6a", label: "Current workflow documented" },
        { id: "s6b", label: "Pain point written in their words" },
        { id: "s6c", label: "Proposed solution drafted" },
        { id: "s6d", label: "Expected benefit quantified" },
        { id: "s6e", label: "Outreach angle written" },
      ],
    },
  ],
};
