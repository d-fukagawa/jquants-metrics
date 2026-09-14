CREATE TABLE "equity_valuations" (
	"code" varchar(5) NOT NULL,
	"date" date NOT NULL,
	"eps_ttm" numeric,
	"eps_company_forecast" numeric,
	"bps" numeric,
	"roe_ttm" numeric,
	"roe_company_forecast" numeric,
	"per_ttm" numeric,
	"per_company_forecast" numeric,
	"pbr" numeric,
	"market_cap_million" numeric,
	CONSTRAINT "equity_valuations_code_date_pk" PRIMARY KEY("code","date")
);
--> statement-breakpoint
CREATE INDEX "idx_equity_valuations_date" ON "equity_valuations" USING btree ("date");