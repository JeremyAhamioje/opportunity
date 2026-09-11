CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"source_conversation_id" text,
	"title" text NOT NULL,
	"url" text,
	"started_at" timestamp with time zone,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"char_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"extracted_at" timestamp with time zone,
	"insight_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_links" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"from_id" text NOT NULL,
	"to_id" text NOT NULL,
	"kind" text NOT NULL,
	"confidence" integer,
	"status" text DEFAULT 'suggested' NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insight_mentions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"insight_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"message_id" text,
	"excerpt" text NOT NULL,
	"movement" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"detail" text,
	"dedupe_key" text NOT NULL,
	"stance" text DEFAULT 'discussed' NOT NULL,
	"confidence" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"due_date" date,
	"first_seen_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"mention_count" integer DEFAULT 0 NOT NULL,
	"opportunity_id" text,
	"pinned" boolean DEFAULT false NOT NULL,
	"notes" text,
	"edited" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"position" integer NOT NULL,
	"occurred_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ingest_token_hash" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ingest_token_hint" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "ingest_token_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_links" ADD CONSTRAINT "insight_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_links" ADD CONSTRAINT "insight_links_from_id_insights_id_fk" FOREIGN KEY ("from_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_links" ADD CONSTRAINT "insight_links_to_id_insights_id_fk" FOREIGN KEY ("to_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_mentions" ADD CONSTRAINT "insight_mentions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_mentions" ADD CONSTRAINT "insight_mentions_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "public"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_mentions" ADD CONSTRAINT "insight_mentions_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_mentions" ADD CONSTRAINT "insight_mentions_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversations_user_idx" ON "conversations" USING btree ("user_id","captured_at");--> statement-breakpoint
CREATE INDEX "conversations_status_idx" ON "conversations" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_source_idx" ON "conversations" USING btree ("user_id","source","source_conversation_id");--> statement-breakpoint
CREATE INDEX "links_from_idx" ON "insight_links" USING btree ("from_id","status");--> statement-breakpoint
CREATE INDEX "links_to_idx" ON "insight_links" USING btree ("to_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "links_pair_idx" ON "insight_links" USING btree ("from_id","to_id","kind");--> statement-breakpoint
CREATE INDEX "mentions_insight_idx" ON "insight_mentions" USING btree ("insight_id","occurred_at");--> statement-breakpoint
CREATE INDEX "mentions_conversation_idx" ON "insight_mentions" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "insights_user_idx" ON "insights" USING btree ("user_id","kind");--> statement-breakpoint
CREATE INDEX "insights_status_idx" ON "insights" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "insights_recency_idx" ON "insights" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "insights_dedupe_idx" ON "insights" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id","position");