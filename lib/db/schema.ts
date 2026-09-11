import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import type {
  ActionStatus,
  ActionType,
  ActivityKind,
  Category,
  DailyGoal,
  EmailStatus,
  RequiredDocument,
  ScoringWeights,
  Sentiment,
  SopChecklist,
  Stage,
  WorkMode,
} from "@/lib/domain/types";
import type {
  ConversationSource,
  IngestStatus,
  InsightKind,
  InsightStatus,
  LinkKind,
  LinkStatus,
  Movement,
  Stance,
} from "@/lib/domain/archaeology";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/* -------------------------------------------------------------------------- */
/*  Users                                                                     */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * One row per user. Holds everything the operator is allowed to tune:
 * daily targets, scoring weights, follow-up cadence, and the editable SOP.
 */
export const settings = pgTable("settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  dailyGoals: jsonb("daily_goals").$type<DailyGoal[]>().notNull().default([]),
  scoringWeights: jsonb("scoring_weights").$type<ScoringWeights>().notNull(),
  followUpDefaultDays: integer("follow_up_default_days").notNull().default(5),
  sopChecklist: jsonb("sop_checklist").$type<SopChecklist>().notNull(),

  /* --- Emailed reminder digest --- */
  notifyEnabled: boolean("notify_enabled").notNull().default(false),
  /** Falls back to the account email when null. */
  notifyEmail: text("notify_email"),
  /**
   * Suppress the digest on days with nothing due. On by default: a mail that
   * arrives every morning saying "nothing to do" is a mail you stop opening,
   * and then you miss the one that mattered.
   */
  notifyOnlyWhenDue: boolean("notify_only_when_due").notNull().default(true),
  /** Guards against a scheduler that fires twice — one digest per day, per user. */
  lastDigestSentAt: date("last_digest_sent_at"),
  /** Surfaced in Settings, so a failing integration is visible rather than silent. */
  lastDigestError: text("last_digest_error"),

  /* --- Browser capture --- */
  /**
   * scrypt hash of the device token the browser extension sends. Hashed, not
   * stored plainly, for the same reason a password is: this row is readable by
   * anything that can read the database, and the token grants write access to
   * the ingest endpoint. Regenerating it revokes every installed extension.
   */
  ingestTokenHash: text("ingest_token_hash"),
  /** First 6 characters, so Settings can show *which* token is live. */
  ingestTokenHint: text("ingest_token_hint"),
  ingestTokenCreatedAt: timestamp("ingest_token_created_at", { withTimezone: true }),

  updatedAt: updatedAt(),
});

/* -------------------------------------------------------------------------- */
/*  Companies — one company can hold many opportunities                       */
/* -------------------------------------------------------------------------- */

export const companies = pgTable(
  "companies",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    website: text("website"),
    industry: text("industry"),
    size: text("size"),
    location: text("location"),
    linkedinUrl: text("linkedin_url"),
    notes: text("notes"),
    isMock: boolean("is_mock").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("companies_user_idx").on(t.userId)],
);

/* -------------------------------------------------------------------------- */
/*  Opportunities — the spine of the product                                  */
/* -------------------------------------------------------------------------- */

export const opportunities = pgTable(
  "opportunities",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "set null",
    }),

    category: text("category").$type<Category>().notNull(),
    title: text("title").notNull(),
    stage: text("stage").$type<Stage>().notNull().default("sourced"),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),

    /** Demo data. Flagged so it is never mistaken for a real lead. */
    isMock: boolean("is_mock").notNull().default(false),
    /** Decorative header image. Purely visual — nothing depends on it. */
    imageUrl: text("image_url"),

    /* Links — "never lose an application because I forgot where I found it" */
    applicationUrl: text("application_url"),
    contactUrl: text("contact_url"),
    documentsUrl: text("documents_url"),

    /* Outreach / email tracking (all manual, no automation) */
    emailStatus: text("email_status").$type<EmailStatus>().notNull().default("none"),
    sentAt: date("sent_at"),
    lastActionAt: date("last_action_at"),
    lastActionLabel: text("last_action_label"),
    nextFollowUpAt: date("next_follow_up_at"),
    followUpCount: integer("follow_up_count").notNull().default(0),
    closedAt: date("closed_at"),

    /* --- Workflow / inefficiency opportunities --- */
    problemObserved: text("problem_observed"),
    evidence: text("evidence"),
    currentProcess: text("current_process"),
    proposedSolution: text("proposed_solution"),
    expectedValue: text("expected_value"),
    outreachAngle: text("outreach_angle"),
    buyerRole: text("buyer_role"),

    /* Opportunity score — raw 0-10 factors; weights live in settings */
    scoreRepetition: integer("score_repetition"),
    scoreFrequency: integer("score_frequency"),
    scorePain: integer("score_pain"),
    scoreAutomability: integer("score_automability"),
    scoreFinancialValue: integer("score_financial_value"),
    scoreDecisionMaker: integer("score_decision_maker"),
    scoreCapability: integer("score_capability"),
    dataAccessible: boolean("data_accessible"),
    /** Ids of SOP checklist items ticked for this opportunity. */
    sopProgress: jsonb("sop_progress").$type<string[]>().notNull().default([]),

    /* --- Speculative shots --- */
    whyInterested: text("why_interested"),
    contribution: text("contribution"),
    contactMethod: text("contact_method"),

    /* --- Active jobs --- */
    salary: text("salary"),
    location: text("location"),
    workMode: text("work_mode").$type<WorkMode>(),
    skills: jsonb("skills").$type<string[]>().notNull().default([]),
    appliedAt: date("applied_at"),

    /* --- Builds --- */
    /**
     * The raw dump, kept verbatim and never rewritten by the structurer. The
     * messy original is the thing you actually meant; the structured fields are
     * an interpretation of it and can always be regenerated from this.
     */
    brainDump: text("brain_dump"),
    /** What shipping it demonstrates — the reason it is worth the weekend. */
    whatItProves: text("what_it_proves"),
    /** The single next physical move, so a stalled build has an obvious restart. */
    firstStep: text("first_step"),
    scopeEstimate: text("scope_estimate"),

    /* --- Scholarships --- */
    country: text("country"),
    degreeLevel: text("degree_level"),
    fundingAmount: text("funding_amount"),
    eligibility: text("eligibility"),
    requirements: text("requirements"),
    documents: jsonb("documents").$type<RequiredDocument[]>().notNull().default([]),

    /* Shared deadline: job closing date or scholarship deadline */
    deadline: date("deadline"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("opportunities_user_idx").on(t.userId),
    index("opportunities_stage_idx").on(t.userId, t.stage),
    index("opportunities_category_idx").on(t.userId, t.category),
    index("opportunities_followup_idx").on(t.userId, t.nextFollowUpAt),
    index("opportunities_company_idx").on(t.companyId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Contacts                                                                  */
/* -------------------------------------------------------------------------- */

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    role: text("role"),
    email: text("email"),
    linkedinUrl: text("linkedin_url"),
    phone: text("phone"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("contacts_user_idx").on(t.userId),
    index("contacts_company_idx").on(t.companyId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Actions — the to-do layer ("Apply", "Email founder", "Build demo"...)      */
/* -------------------------------------------------------------------------- */

export const actions = pgTable(
  "actions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    type: text("type").$type<ActionType>().notNull(),
    title: text("title").notNull(),
    status: text("status").$type<ActionStatus>().notNull().default("todo"),
    dueDate: date("due_date"),
    completedDate: date("completed_date"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("actions_user_idx").on(t.userId),
    index("actions_due_idx").on(t.userId, t.status, t.dueDate),
    index("actions_opportunity_idx").on(t.opportunityId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Responses — what came back. Powers the "which shots work?" analytics.     */
/* -------------------------------------------------------------------------- */

export const responses = pgTable(
  "responses",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    receivedAt: date("received_at").notNull(),
    sentiment: text("sentiment").$type<Sentiment>().notNull(),
    channel: text("channel"),
    summary: text("summary").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("responses_user_idx").on(t.userId),
    index("responses_opportunity_idx").on(t.opportunityId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Activity — append-only timeline                                           */
/* -------------------------------------------------------------------------- */

export const activities = pgTable(
  "activities",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, {
      onDelete: "cascade",
    }),
    companyId: text("company_id").references(() => companies.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").$type<ActivityKind>().notNull(),
    message: text("message").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("activities_user_idx").on(t.userId, t.occurredAt),
    index("activities_opportunity_idx").on(t.opportunityId),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Idea archaeology — raw capture                                            */
/*                                                                            */
/*  Raw conversations are never rewritten by extraction. Everything the model  */
/*  concludes lives in `insights` and points back here, which is what makes    */
/*  "why does the system think I wanted this?" answerable, and why re-running  */
/*  extraction can never corrupt the source. See docs/archaeology.md.          */
/* -------------------------------------------------------------------------- */

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    source: text("source").$type<ConversationSource>().notNull(),
    /** The chat's id on its own platform. Lets a re-sync update, not duplicate. */
    sourceConversationId: text("source_conversation_id"),
    title: text("title").notNull(),
    url: text("url"),

    /** Earliest message — the conversation's own date, not the capture date. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).defaultNow().notNull(),

    messageCount: integer("message_count").notNull().default(0),
    charCount: integer("char_count").notNull().default(0),

    status: text("status").$type<IngestStatus>().notNull().default("pending"),
    /** Why extraction failed, kept so a failed run can be understood and retried. */
    error: text("error"),
    extractedAt: timestamp("extracted_at", { withTimezone: true }),
    /** How many insights this conversation yielded — cheap enough to store. */
    insightCount: integer("insight_count").notNull().default(0),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("conversations_user_idx").on(t.userId, t.capturedAt),
    index("conversations_status_idx").on(t.userId, t.status),
    // Re-syncing the same chat must update it rather than pile up copies.
    uniqueIndex("conversations_source_idx").on(
      t.userId,
      t.source,
      t.sourceConversationId,
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant" | "system">().notNull(),
    content: text("content").notNull(),
    /** Order within the conversation; the platform's own ids are not reliable. */
    position: integer("position").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.position)],
);

/* -------------------------------------------------------------------------- */
/*  Idea archaeology — derived                                                */
/* -------------------------------------------------------------------------- */

export const insights = pgTable(
  "insights",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    kind: text("kind").$type<InsightKind>().notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    detail: text("detail"),

    /**
     * Deterministic identity for the title — a second mention matching this key
     * lands on this row instead of creating a twin. See `insightKey()`.
     */
    dedupeKey: text("dedupe_key").notNull(),

    /** How firmly *you* said it. Not the same as `confidence`. */
    stance: text("stance").$type<Stance>().notNull().default("discussed"),
    /** 0-100: how sure the extractor is it read the text correctly. */
    confidence: integer("confidence"),
    status: text("status").$type<InsightStatus>().notNull().default("open"),

    /** Commitments: when it was said it would happen. */
    dueDate: date("due_date"),

    /* Derived from mention rows, never estimated. */
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    mentionCount: integer("mention_count").notNull().default(0),

    /** Set when promoted into the spine — the one bridge to real work. */
    opportunityId: text("opportunity_id").references(() => opportunities.id, {
      onDelete: "set null",
    }),

    /** User-owned fields. The model proposes; these always win. */
    pinned: boolean("pinned").notNull().default(false),
    notes: text("notes"),
    /** True once a human has touched it, so re-extraction leaves it alone. */
    edited: boolean("edited").notNull().default(false),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("insights_user_idx").on(t.userId, t.kind),
    index("insights_status_idx").on(t.userId, t.status),
    index("insights_recency_idx").on(t.userId, t.lastSeenAt),
    index("insights_dedupe_idx").on(t.userId, t.dedupeKey),
  ],
);

/**
 * Provenance: one row per time an insight showed up. Mention counts and the
 * whole evolution timeline are read from these rows, so a headline number is
 * always an inspectable list of excerpts rather than a model's guess.
 */
export const insightMentions = pgTable(
  "insight_mentions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    insightId: text("insight_id")
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    messageId: text("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),

    /** Quoted from the source. This is the evidence, so it is never generated. */
    excerpt: text("excerpt").notNull(),
    /** What this mention did to the idea — turns 11 hits into a readable story. */
    movement: text("movement").$type<Movement>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),

    createdAt: createdAt(),
  },
  (t) => [
    index("mentions_insight_idx").on(t.insightId, t.occurredAt),
    index("mentions_conversation_idx").on(t.conversationId),
  ],
);

export const insightLinks = pgTable(
  "insight_links",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromId: text("from_id")
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    toId: text("to_id")
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    kind: text("kind").$type<LinkKind>().notNull(),
    confidence: integer("confidence"),
    /** Suggestions stay suggestions until a human confirms. Never auto-merge. */
    status: text("status").$type<LinkStatus>().notNull().default("suggested"),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [
    index("links_from_idx").on(t.fromId, t.status),
    index("links_to_idx").on(t.toId, t.status),
    uniqueIndex("links_pair_idx").on(t.fromId, t.toId, t.kind),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Relations                                                                 */
/* -------------------------------------------------------------------------- */

export const companiesRelations = relations(companies, ({ many }) => ({
  opportunities: many(opportunities),
  contacts: many(contacts),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  company: one(companies, {
    fields: [opportunities.companyId],
    references: [companies.id],
  }),
  actions: many(actions),
  responses: many(responses),
  activities: many(activities),
  contacts: many(contacts),
}));

export const actionsRelations = relations(actions, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [actions.opportunityId],
    references: [opportunities.id],
  }),
}));

export const responsesRelations = relations(responses, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [responses.opportunityId],
    references: [opportunities.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(messages),
  mentions: many(insightMentions),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

export const insightsRelations = relations(insights, ({ one, many }) => ({
  mentions: many(insightMentions),
  opportunity: one(opportunities, {
    fields: [insights.opportunityId],
    references: [opportunities.id],
  }),
}));

export const insightMentionsRelations = relations(insightMentions, ({ one }) => ({
  insight: one(insights, {
    fields: [insightMentions.insightId],
    references: [insights.id],
  }),
  conversation: one(conversations, {
    fields: [insightMentions.conversationId],
    references: [conversations.id],
  }),
  message: one(messages, {
    fields: [insightMentions.messageId],
    references: [messages.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type NewOpportunity = typeof opportunities.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type Response = typeof responses.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
export type InsightMention = typeof insightMentions.$inferSelect;
export type InsightLink = typeof insightLinks.$inferSelect;
