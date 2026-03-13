CREATE TABLE "stock_memo_meta" (
	"code" varchar(5) PRIMARY KEY NOT NULL,
	"is_watched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_stock_memo_meta_watched" ON "stock_memo_meta" USING btree ("is_watched");
--> statement-breakpoint
CREATE INDEX "idx_stock_memo_meta_updated_at" ON "stock_memo_meta" USING btree ("updated_at");
--> statement-breakpoint
CREATE TABLE "stock_memos" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(5) NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_stock_memos_code" ON "stock_memos" USING btree ("code");
--> statement-breakpoint
CREATE INDEX "idx_stock_memos_updated_at" ON "stock_memos" USING btree ("updated_at");
--> statement-breakpoint
INSERT INTO "stock_memo_meta" ("code", "is_watched", "created_at", "updated_at")
SELECT
	"code",
	true,
	"created_at",
	"updated_at"
FROM "watchlist";
--> statement-breakpoint
INSERT INTO "stock_memos" ("id", "code", "body", "created_at", "updated_at")
SELECT
	"code" || '-legacy',
	"code",
	LEFT(BTRIM("note"), 1000),
	"created_at",
	"updated_at"
FROM "watchlist"
WHERE "note" IS NOT NULL
	AND BTRIM("note") <> '';
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_watchlist_created_at";
--> statement-breakpoint
DROP TABLE "watchlist";
