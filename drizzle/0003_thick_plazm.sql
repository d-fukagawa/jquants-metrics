CREATE TABLE "edinet_bridge_facts" (
	"code" varchar(5) NOT NULL,
	"edinet_code" text NOT NULL,
	"fiscal_year" text NOT NULL,
	"period_type" text NOT NULL,
	"operating_profit" numeric,
	"pretax_profit" numeric,
	"net_profit" numeric,
	"cfo" numeric,
	"depreciation" numeric,
	"adjustment_items_json" jsonb,
	"disclosed_at" date,
	"source_doc_id" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "edinet_bridge_facts_code_fiscal_year_period_type_pk" PRIMARY KEY("code","fiscal_year","period_type")
);
--> statement-breakpoint
CREATE TABLE "edinet_company_map" (
	"code" varchar(5) PRIMARY KEY NOT NULL,
	"edinet_code" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "edinet_filings" (
	"edinet_code" text NOT NULL,
	"doc_id" text NOT NULL,
	"code" varchar(5),
	"filing_date" date NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"is_amendment" boolean DEFAULT false NOT NULL,
	"submitted_at" timestamp with time zone,
	"source_updated_at" timestamp with time zone,
	CONSTRAINT "edinet_filings_edinet_code_doc_id_pk" PRIMARY KEY("edinet_code","doc_id")
);
--> statement-breakpoint
CREATE TABLE "edinet_forecasts" (
	"code" varchar(5) NOT NULL,
	"edinet_code" text NOT NULL,
	"fiscal_year" text NOT NULL,
	"horizon" text NOT NULL,
	"sales_forecast" numeric,
	"op_forecast" numeric,
	"np_forecast" numeric,
	"eps_forecast" numeric,
	"disclosed_at" date,
	"source_doc_id" text,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "edinet_forecasts_code_horizon_fiscal_year_pk" PRIMARY KEY("code","horizon","fiscal_year")
);
--> statement-breakpoint
CREATE TABLE "edinet_quality_scores" (
	"code" varchar(5) NOT NULL,
	"as_of_date" date NOT NULL,
	"quality_score" integer NOT NULL,
	"components_json" jsonb NOT NULL,
	"formula_text" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "edinet_quality_scores_code_as_of_date_pk" PRIMARY KEY("code","as_of_date")
);
--> statement-breakpoint
CREATE TABLE "edinet_sync_runs" (
	"run_id" text PRIMARY KEY NOT NULL,
	"target" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"success" boolean NOT NULL,
	"http_429_count" integer DEFAULT 0 NOT NULL,
	"http_5xx_count" integer DEFAULT 0 NOT NULL,
	"rows_synced" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "edinet_text_scores" (
	"code" varchar(5) NOT NULL,
	"as_of_date" date NOT NULL,
	"anomaly_score" integer NOT NULL,
	"components_json" jsonb NOT NULL,
	"formula_text" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "edinet_text_scores_code_as_of_date_pk" PRIMARY KEY("code","as_of_date")
);
--> statement-breakpoint
CREATE INDEX "idx_edinet_bridge_facts_code" ON "edinet_bridge_facts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_edinet_bridge_facts_disclosed_at" ON "edinet_bridge_facts" USING btree ("disclosed_at");--> statement-breakpoint
CREATE INDEX "idx_edinet_company_map_edinet_code" ON "edinet_company_map" USING btree ("edinet_code");--> statement-breakpoint
CREATE INDEX "idx_edinet_filings_code_date" ON "edinet_filings" USING btree ("code","filing_date");--> statement-breakpoint
CREATE INDEX "idx_edinet_filings_date" ON "edinet_filings" USING btree ("filing_date");--> statement-breakpoint
CREATE INDEX "idx_edinet_filings_event_type" ON "edinet_filings" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_edinet_forecasts_code" ON "edinet_forecasts" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_edinet_forecasts_disclosed_at" ON "edinet_forecasts" USING btree ("disclosed_at");--> statement-breakpoint
CREATE INDEX "idx_edinet_quality_scores_code" ON "edinet_quality_scores" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_edinet_sync_runs_target_started" ON "edinet_sync_runs" USING btree ("target","started_at");--> statement-breakpoint
CREATE INDEX "idx_edinet_text_scores_code" ON "edinet_text_scores" USING btree ("code");