CREATE TABLE "financial_adjustments" (
	"code" varchar(5) NOT NULL,
	"disc_no" text NOT NULL,
	"disc_date" date,
	"item_key" text NOT NULL,
	"amount" numeric NOT NULL,
	"direction" text NOT NULL,
	"category" text NOT NULL,
	"source" text NOT NULL,
	CONSTRAINT "financial_adjustments_code_disc_no_item_key_direction_pk" PRIMARY KEY("code","disc_no","item_key","direction")
);
--> statement-breakpoint
CREATE INDEX "idx_financial_adjustments_disc_date" ON "financial_adjustments" USING btree ("disc_date");--> statement-breakpoint
CREATE INDEX "idx_financial_adjustments_code" ON "financial_adjustments" USING btree ("code");