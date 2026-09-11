ALTER TABLE "settings" ADD COLUMN "notify_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "notify_email" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "notify_only_when_due" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "last_digest_sent_at" date;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "last_digest_error" text;