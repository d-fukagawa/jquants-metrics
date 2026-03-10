CREATE TABLE "daily_prices" (
	"code" varchar(5) NOT NULL,
	"date" date NOT NULL,
	"open" numeric,
	"high" numeric,
	"low" numeric,
	"close" numeric,
	"volume" numeric,
	"turnover" numeric,
	"adj_factor" numeric,
	"adj_open" numeric,
	"adj_high" numeric,
	"adj_low" numeric,
	"adj_close" numeric,
	"adj_volume" numeric,
	CONSTRAINT "daily_prices_code_date_pk" PRIMARY KEY("code","date")
);
--> statement-breakpoint
CREATE TABLE "financial_summary" (
	"code" varchar(5) NOT NULL,
	"disc_no" text NOT NULL,
	"disc_date" date,
	"doc_type" text,
	"cur_per_type" text,
	"sales" numeric,
	"op" numeric,
	"np" numeric,
	"eps" numeric,
	"bps" numeric,
	"equity" numeric,
	"eq_ar" numeric,
	"total_assets" numeric,
	"cfo" numeric,
	"cash_eq" numeric,
	"sh_out_fy" numeric,
	"tr_sh_fy" numeric,
	"div_ann" numeric,
	"f_sales" numeric,
	"f_op" numeric,
	"f_np" numeric,
	"f_eps" numeric,
	"f_div_ann" numeric,
	CONSTRAINT "financial_summary_code_disc_no_pk" PRIMARY KEY("code","disc_no")
);
--> statement-breakpoint
CREATE TABLE "stock_master" (
	"code" varchar(5) PRIMARY KEY NOT NULL,
	"co_name" text NOT NULL,
	"co_name_en" text NOT NULL,
	"sector17" text NOT NULL,
	"sector17_nm" text NOT NULL,
	"sector33" text NOT NULL,
	"sector33_nm" text NOT NULL,
	"scale_cat" text NOT NULL,
	"mkt" text NOT NULL,
	"mkt_nm" text NOT NULL,
	"mrgn" text NOT NULL,
	"mrgn_nm" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_daily_prices_date" ON "daily_prices" USING btree ("date");