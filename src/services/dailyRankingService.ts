import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'

export const DAILY_RANKING_LIMITS = [50, 100] as const
export type DailyRankingLimit = typeof DAILY_RANKING_LIMITS[number]

export const DAILY_RANKING_MARKETS = ['プライム', 'スタンダード', 'グロース'] as const
export type DailyRankingMarket = typeof DAILY_RANKING_MARKETS[number]

export interface DailyRankingOptions {
  date?: string
  market?: DailyRankingMarket
  limit?: DailyRankingLimit
}

export interface DailyRankingRow {
  rank: number
  code: string
  code4: string
  coName: string
  market: string
  sector17Name: string
  close: number | null
  change: number | null
  changePct: number | null
  turnover: number
}

export interface DailyRankingResult {
  date: string | null
  previousDate: string | null
  rows: DailyRankingRow[]
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export async function listDailyTurnoverRankings(
  db: Db,
  options: DailyRankingOptions = {},
): Promise<DailyRankingResult> {
  const limit = DAILY_RANKING_LIMITS.includes(options.limit ?? 50) ? (options.limit ?? 50) : 50
  const targetDate = options.date ? sql`${options.date}::date` : sql`(SELECT MAX(date) FROM daily_prices)`
  const marketFilter = options.market ? sql`AND sm.mkt_nm = ${options.market}` : sql``

  const result = await db.execute(sql`
    WITH ranking_dates AS (
      SELECT
        ${targetDate} AS target_date,
        (
          SELECT MAX(date)
          FROM daily_prices
          WHERE date < ${targetDate}
        ) AS previous_date
    ),
    ranked AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY current_price.turnover DESC, current_price.code ASC)::int AS rank,
        current_price.code,
        sm.co_name,
        sm.mkt_nm,
        sm.sector17_nm,
        current_price.adj_close::float AS close,
        CASE
          WHEN current_price.adj_close IS NOT NULL AND previous_price.adj_close IS NOT NULL
            THEN current_price.adj_close::float - previous_price.adj_close::float
          ELSE NULL
        END AS change,
        CASE
          WHEN current_price.adj_close IS NOT NULL AND previous_price.adj_close::float > 0
            THEN (current_price.adj_close::float / previous_price.adj_close::float - 1) * 100
          ELSE NULL
        END AS change_pct,
        current_price.turnover::float AS turnover
      FROM ranking_dates dates
      JOIN daily_prices current_price
        ON current_price.date = dates.target_date
      LEFT JOIN daily_prices previous_price
        ON previous_price.code = current_price.code
       AND previous_price.date = dates.previous_date
      JOIN stock_master sm
        ON sm.code = current_price.code
      WHERE current_price.turnover IS NOT NULL
        ${marketFilter}
      ORDER BY current_price.turnover DESC, current_price.code ASC
      LIMIT ${limit}
    )
    SELECT
      dates.target_date::text AS target_date,
      dates.previous_date::text AS previous_date,
      ranked.rank,
      ranked.code,
      ranked.co_name,
      ranked.mkt_nm,
      ranked.sector17_nm,
      ranked.close,
      ranked.change,
      ranked.change_pct,
      ranked.turnover
    FROM ranking_dates dates
    LEFT JOIN ranked ON TRUE
    ORDER BY ranked.rank ASC NULLS LAST
  `)

  const rawRows = result.rows as Record<string, unknown>[]
  const metadata = rawRows[0]
  const rows = rawRows
    .filter(row => row.code != null)
    .map((row) => ({
      rank: Number(row.rank),
      code: String(row.code),
      code4: String(row.code).slice(0, 4),
      coName: String(row.co_name ?? ''),
      market: String(row.mkt_nm ?? ''),
      sector17Name: String(row.sector17_nm ?? ''),
      close: toNullableNumber(row.close),
      change: toNullableNumber(row.change),
      changePct: toNullableNumber(row.change_pct),
      turnover: Number(row.turnover),
    }))

  return {
    date: metadata?.target_date == null ? null : String(metadata.target_date),
    previousDate: metadata?.previous_date == null ? null : String(metadata.previous_date),
    rows,
  }
}
