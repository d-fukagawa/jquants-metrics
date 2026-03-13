CREATE TABLE "theme_stocks" (
	"theme_id" text NOT NULL,
	"code" varchar(5) NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "theme_stocks_theme_id_code_pk" PRIMARY KEY("theme_id","code")
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"memo" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_theme_stocks_theme_sort" ON "theme_stocks" USING btree ("theme_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_theme_stocks_code" ON "theme_stocks" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_themes_updated_at" ON "themes" USING btree ("updated_at");