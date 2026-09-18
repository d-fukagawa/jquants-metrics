ALTER TABLE "edinet_bridge_facts" ADD COLUMN "cfi" numeric;--> statement-breakpoint
ALTER TABLE "edinet_bridge_facts" ADD COLUMN "capex" numeric;--> statement-breakpoint
ALTER TABLE "edinet_bridge_facts" ADD COLUMN "accounting_standard" text;--> statement-breakpoint
ALTER TABLE "edinet_bridge_facts" ADD COLUMN "basis" text;--> statement-breakpoint
ALTER TABLE "edinet_bridge_facts" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "disc_time" text;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "cur_per_start" date;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "cur_per_end" date;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "cur_fy_start" date;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "cur_fy_end" date;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "cfi" numeric;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "cff" numeric;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "retro_restatement" boolean;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "changed_by_as_revision" boolean;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "changed_other_than_as_revision" boolean;--> statement-breakpoint
ALTER TABLE "financial_summary" ADD COLUMN "changed_accounting_estimate" boolean;