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
  marketRank: number
  sectorRank: number
  code: string
  code4: string
  coName: string
  market: string
  sector17Name: string
  sector33Name: string
  scaleCategory: string
  close: number | null
  change: number | null
  changePct: number | null
  turnover: number
  turnover20dAverage: number | null
  turnover20dRatio: number | null
  marketCap: number | null
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
  const marketFilter = options.market ? sql`AND mkt_nm = ${options.market}` : sql``

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
    current_universe AS (
      SELECT
        current_price.code,
        sm.co_name,
        sm.mkt_nm,
        sm.sector17_nm,
        sm.sector33,
        sm.sector33_nm,
        sm.scale_cat,
        ROW_NUMBER() OVER (
          PARTITION BY sm.mkt_nm
          ORDER BY current_price.turnover DESC, current_price.code ASC
        )::int AS market_rank,
        ROW_NUMBER() OVER (
          PARTITION BY sm.sector33
          ORDER BY current_price.turnover DESC, current_price.code ASC
        )::int AS sector_rank,
        current_price.adj_close::float AS close,
        current_price.close::float AS raw_close,
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
    ),
    filtered_ranked AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY turnover DESC, code ASC)::int AS rank,
        *
      FROM current_universe
      WHERE TRUE
        ${marketFilter}
      ORDER BY turnover DESC, code ASC
      LIMIT ${limit}
    ),
    enriched AS (
      SELECT
        ranked.*,
        CASE
          WHEN history.observation_count = 20 THEN history.turnover_20d_average
          ELSE NULL
        END AS turnover_20d_average,
        CASE
          WHEN history.observation_count = 20 AND history.turnover_20d_average > 0
            THEN ranked.turnover / history.turnover_20d_average
          ELSE NULL
        END AS turnover_20d_ratio,
        CASE
          WHEN COALESCE(ranked.raw_close, ranked.close) > 0
            AND financial.net_shares > 0
            THEN COALESCE(ranked.raw_close, ranked.close) * financial.net_shares
          ELSE NULL
        END AS market_cap
      FROM filtered_ranked ranked
      CROSS JOIN ranking_dates dates
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS observation_count,
          AVG(recent.turnover) AS turnover_20d_average
        FROM (
          SELECT historical_price.turnover::float AS turnover
          FROM daily_prices historical_price
          WHERE historical_price.code = ranked.code
            AND historical_price.date < dates.target_date
            AND historical_price.turnover IS NOT NULL
          ORDER BY historical_price.date DESC
          LIMIT 20
        ) recent
      ) history ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          financial_row.sh_out_fy::float - COALESCE(financial_row.tr_sh_fy::float, 0) AS net_shares
        FROM financial_summary financial_row
        WHERE financial_row.code = ranked.code
          AND financial_row.cur_per_type = 'FY'
          AND financial_row.disc_date <= dates.target_date
          AND financial_row.sh_out_fy IS NOT NULL
        ORDER BY financial_row.disc_date DESC, financial_row.disc_no DESC
        LIMIT 1
      ) financial ON TRUE
    )
    SELECT
      dates.target_date::text AS target_date,
      dates.previous_date::text AS previous_date,
      enriched.rank,
      enriched.market_rank,
      enriched.sector_rank,
      enriched.code,
      enriched.co_name,
      enriched.mkt_nm,
      enriched.sector17_nm,
      enriched.sector33_nm,
      enriched.scale_cat,
      enriched.close,
      enriched.change,
      enriched.change_pct,
      enriched.turnover,
      enriched.turnover_20d_average,
      enriched.turnover_20d_ratio,
      enriched.market_cap
    FROM ranking_dates dates
    LEFT JOIN enriched ON TRUE
    ORDER BY enriched.rank ASC NULLS LAST
  `)

  const rawRows = result.rows as Record<string, unknown>[]
  const metadata = rawRows[0]
  const rows = rawRows
    .filter(row => row.code != null)
    .map((row) => ({
      rank: Number(row.rank),
      marketRank: Number(row.market_rank),
      sectorRank: Number(row.sector_rank),
      code: String(row.code),
      code4: String(row.code).slice(0, 4),
      coName: String(row.co_name ?? ''),
      market: String(row.mkt_nm ?? ''),
      sector17Name: String(row.sector17_nm ?? ''),
      sector33Name: String(row.sector33_nm ?? ''),
      scaleCategory: String(row.scale_cat ?? ''),
      close: toNullableNumber(row.close),
      change: toNullableNumber(row.change),
      changePct: toNullableNumber(row.change_pct),
      turnover: Number(row.turnover),
      turnover20dAverage: toNullableNumber(row.turnover_20d_average),
      turnover20dRatio: toNullableNumber(row.turnover_20d_ratio),
      marketCap: toNullableNumber(row.market_cap),
    }))

  return {
    date: metadata?.target_date == null ? null : String(metadata.target_date),
    previousDate: metadata?.previous_date == null ? null : String(metadata.previous_date),
    rows,
  }
}
