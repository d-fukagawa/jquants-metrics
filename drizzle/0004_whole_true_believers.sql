CREATE TABLE "watchlist" (
	"code" varchar(5) PRIMARY KEY NOT NULL,
	"note" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_watchlist_created_at" ON "watchlist" USING btree ("created_at");