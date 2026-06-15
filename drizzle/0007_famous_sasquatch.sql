ALTER TABLE "theme_stocks" ADD COLUMN "relevance" text;--> statement-breakpoint
ALTER TABLE "theme_stocks" ADD COLUMN "rationale" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "theme_stocks" ADD COLUMN "source_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "theme_stocks" ADD COLUMN "source_type" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "theme_stocks" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "external_key" text;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "source_type" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "themes" ADD COLUMN "imported_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_theme_stocks_import_source" ON "theme_stocks" USING btree ("theme_id","source_type");--> statement-breakpoint
CREATE INDEX "idx_themes_external_key" ON "themes" USING btree ("external_key");--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_external_key_unique" UNIQUE("external_key");