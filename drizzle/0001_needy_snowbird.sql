CREATE TABLE "fins_details" (
	"code" varchar(5) NOT NULL,
	"disc_no" text NOT NULL,
	"disc_date" date,
	"doc_type" text,
	"cur_per_type" text,
	"debt_current" numeric,
	"debt_non_curr" numeric,
	"dna" numeric,
	"pretax_profit" numeric,
	"tax_expense" numeric,
	CONSTRAINT "fins_details_code_disc_no_pk" PRIMARY KEY("code","disc_no")
);
--> statement-breakpoint
CREATE INDEX "idx_fins_details_disc_date" ON "fins_details" USING btree ("disc_date");