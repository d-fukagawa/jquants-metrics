import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'

export type ThemeDailySummaryScope = 'themes' | 'sector17'
export type ThemeDailySummaryStatusTone = 'strong' | 'flow' | 'caution' | 'weak' | 'neutral'

export interface ThemeDailySummaryRow {
  date: string
  stockCount: number
  dataStockCount: number
  return1d: number | null
  return5d: number | null
  return20d: number | null
  advancersPct: number | null
  turnover: number | null
  turnoverRatio: number | null
  volumeRatio: number | null
  intradayRange: number | null
  leaderGroupId: string | null
  leaderGroupName: string | null
  leaderReturn1d: number | null
  leaderTurnoverRatio: number | null
  momentumScore: number
  flowScore: number
  volatilityScore: number
  status: string
  statusTone: ThemeDailySummaryStatusTone
}

export interface ThemeDailySummaryOptions {
  scope?: ThemeDailySummaryScope
  from?: string
  to?: string
  limit?: number
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function calcDailyMarketScores(input: {
  return1d: number | null
  return5d: number | null
  advancersPct: number | null
  turnoverRatio: number | null
  volumeRatio: number | null
  intradayRange: number | null
}): { momentumScore: number; flowScore: number; volatilityScore: number } {
  const return1dPoints = input.return1d == null
    ? 40
    : clamp(50 + input.return1d * 500, 0, 100)
  const return5dPoints = input.return5d == null
    ? 40
    : clamp(50 + input.return5d * 250, 0, 100)
  const breadthPoints = input.advancersPct == null
    ? 40
    : clamp(input.advancersPct, 0, 100)
  const momentumScore = Math.round(return1dPoints * 0.45 + return5dPoints * 0.25 + breadthPoints * 0.3)

  const turnoverPoints = input.turnoverRatio == null
    ? 40
    : clamp(input.turnoverRatio * 40, 0, 100)
  const volumePoints = input.volumeRatio == null
    ? 40
    : clamp(input.volumeRatio * 30, 0, 100)
  const flowScore = Math.round(turnoverPoints * 0.7 + volumePoints * 0.3)

  const volatilityScore = input.intradayRange == null
    ? 40
    : Math.round(clamp(input.intradayRange * 1500, 0, 100))

  return { momentumScore, flowScore, volatilityScore }
}

export function judgeDailyMarket(input: {
  return1d: number | null
  return5d: number | null
  advancersPct: number | null
  turnoverRatio: number | null
  volumeRatio: number | null
  intradayRange: number | null
}): { status: string; tone: ThemeDailySummaryStatusTone } {
  const r1 = input.return1d
  const r5 = input.return5d
  const adv = input.advancersPct
  const tr = input.turnoverRatio
  const vr = input.volumeRatio
  const range = input.intradayRange

  if (r1 != null && r1 <= -0.02 && adv != null && adv <= 35) {
    return { status: 'リスクオフ', tone: 'weak' }
  }
  if (r1 != null && r1 >= 0.025 && tr != null && tr >= 2.2 && range != null && range >= 0.04) {
    return { status: '過熱注意', tone: 'caution' }
  }
  if (r1 != null && r1 >= 0.02 && adv != null && adv >= 70 && tr != null && tr >= 1.3) {
    return { status: '全面高・資金流入', tone: 'strong' }
  }
  if (r1 != null && r1 >= 0.01 && tr != null && tr >= 1.5) {
    return { status: '資金流入上昇', tone: 'flow' }
  }
  if (
    r1 != null
    && Math.abs(r1) < 0.005
    && adv != null
    && adv >= 40
    && adv <= 60
    && tr != null
    && tr >= 1.4
  ) {
    return { status: '選別物色', tone: 'flow' }
  }
  if (r1 != null && r1 < 0 && adv != null && adv < 50 && (tr == null || tr < 1.0)) {
    return { status: '弱含み', tone: 'weak' }
  }
  if ((tr != null && tr < 0.8) && (vr != null && vr < 0.8) && (r5 == null || Math.abs(r5) < 0.03)) {
    return { status: '薄商い', tone: 'neutral' }
  }
  return { status: '横ばい', tone: 'neutral' }
}

export async function listThemeDailySummaries(
  db: Db,
  options: ThemeDailySummaryOptions = {},
): Promise<ThemeDailySummaryRow[]> {
  const scope = options.scope ?? 'sector17'
  const limit = Math.min(Math.max(options.limit ?? 60, 1), 250)
  const calcDateLimit = limit + 25
  const dateLowerBound = options.from
    ? sql`date >= (${options.from}::date - INTERVAL '90 days')`
    : sql`TRUE`
  const dateUpperBound = options.to
    ? sql`date <= ${options.to}::date`
    : sql`TRUE`
  const targetDateFilter = options.from
    ? sql`od.date >= ${options.from}::date`
    : sql`od.rn <= ${limit}`
  const dateLimitClause = options.from
    ? sql``
    : sql`LIMIT ${calcDateLimit}`
  const groupFilter = scope === 'themes'
    ? sql`WHERE group_type = 'themes'`
    : sql`WHERE group_type = 'sector17'`

  const result = await db.execute(sql`
    WITH available_dates AS (
      SELECT DISTINCT date
      FROM daily_prices
      WHERE ${dateLowerBound}
        AND ${dateUpperBound}
      ORDER BY date DESC
      ${dateLimitClause}
    ),
    ordered_dates AS (
      SELECT
        date,
        ROW_NUMBER() OVER (ORDER BY date DESC)::int AS rn
      FROM available_dates
    ),
    target_dates AS (
      SELECT od.date
      FROM ordered_dates od
      WHERE ${targetDateFilter}
    ),
    price_points AS (
      SELECT
        dp.code,
        od.date,
        dp.adj_close::float AS close,
        dp.adj_high::float AS high,
        dp.adj_low::float AS low,
        COALESCE(dp.adj_volume, dp.volume)::float AS volume,
        dp.turnover::float AS turnover,
        LAG(dp.adj_close::float, 1) OVER (PARTITION BY dp.code ORDER BY od.date) AS close_1d,
        LAG(dp.adj_close::float, 5) OVER (PARTITION BY dp.code ORDER BY od.date) AS close_5d,
        LAG(dp.adj_close::float, 20) OVER (PARTITION BY dp.code ORDER BY od.date) AS close_20d,
        AVG(dp.turnover::float) OVER (
          PARTITION BY dp.code
          ORDER BY od.date
          ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING
        ) AS turnover_20d_avg,
        AVG(COALESCE(dp.adj_volume, dp.volume)::float) OVER (
          PARTITION BY dp.code
          ORDER BY od.date
          ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING
        ) AS volume_20d_avg
      FROM daily_prices dp
      JOIN ordered_dates od
        ON od.date = dp.date
      WHERE dp.adj_close IS NOT NULL
    ),
    code_metrics AS (
      SELECT
        code,
        date,
        close,
        turnover,
        volume,
        turnover_20d_avg,
        volume_20d_avg,
        CASE WHEN close > 0 AND close_1d > 0 THEN close / close_1d - 1 ELSE NULL END AS return_1d,
        CASE WHEN close > 0 AND close_5d > 0 THEN close / close_5d - 1 ELSE NULL END AS return_5d,
        CASE WHEN close > 0 AND close_20d > 0 THEN close / close_20d - 1 ELSE NULL END AS return_20d,
        CASE WHEN close > 0 AND high > 0 AND low > 0 THEN (high - low) / close ELSE NULL END AS intraday_range
      FROM price_points
    ),
    market_daily AS (
      SELECT
        cm.date,
        COUNT(*)::int AS stock_count,
        COUNT(*) FILTER (WHERE cm.return_1d IS NOT NULL)::int AS data_stock_count,
        AVG(cm.return_1d) AS return_1d,
        AVG(cm.return_5d) AS return_5d,
        AVG(cm.return_20d) AS return_20d,
        ROUND((
          COUNT(*) FILTER (WHERE cm.return_1d > 0)::float
          / NULLIF(COUNT(*) FILTER (WHERE cm.return_1d IS NOT NULL), 0)
          * 100
        )::numeric, 1)::float AS advancers_pct,
        SUM(cm.turnover) AS turnover,
        CASE WHEN SUM(cm.turnover_20d_avg) > 0
          THEN SUM(cm.turnover) / SUM(cm.turnover_20d_avg)
          ELSE NULL END AS turnover_ratio,
        CASE WHEN SUM(cm.volume_20d_avg) > 0
          THEN SUM(cm.volume) / SUM(cm.volume_20d_avg)
          ELSE NULL END AS volume_ratio,
        AVG(cm.intraday_range) AS intraday_range
      FROM code_metrics cm
      JOIN target_dates td
        ON td.date = cm.date
      GROUP BY cm.date
    ),
    all_groups AS (
      SELECT
        'themes'::text AS group_type,
        t.id::text AS group_id,
        t.name::text AS group_name,
        ts.code
      FROM themes t
      JOIN theme_stocks ts
        ON ts.theme_id = t.id

      UNION ALL

      SELECT
        'sector17'::text AS group_type,
        sm.sector17::text AS group_id,
        sm.sector17_nm::text AS group_name,
        sm.code
      FROM stock_master sm
      WHERE sm.sector17 <> ''
        AND sm.sector17_nm <> ''
    ),
    group_members AS (
      SELECT *
      FROM all_groups
      ${groupFilter}
    ),
    group_daily AS (
      SELECT
        cm.date,
        gm.group_id,
        gm.group_name,
        COUNT(*) FILTER (WHERE cm.return_1d IS NOT NULL)::int AS data_stock_count,
        AVG(cm.return_1d) AS return_1d,
        ROUND((
          COUNT(*) FILTER (WHERE cm.return_1d > 0)::float
          / NULLIF(COUNT(*) FILTER (WHERE cm.return_1d IS NOT NULL), 0)
          * 100
        )::numeric, 1)::float AS advancers_pct,
        CASE WHEN SUM(cm.turnover_20d_avg) > 0
          THEN SUM(cm.turnover) / SUM(cm.turnover_20d_avg)
          ELSE NULL END AS turnover_ratio
      FROM group_members gm
      JOIN code_metrics cm
        ON cm.code = gm.code
      JOIN target_dates td
        ON td.date = cm.date
      GROUP BY cm.date, gm.group_id, gm.group_name
    ),
    leader_ranked AS (
      SELECT
        gd.*,
        ROW_NUMBER() OVER (
          PARTITION BY gd.date
          ORDER BY
            (
              COALESCE(gd.return_1d, 0) * 100
              + COALESCE(LEAST(gd.turnover_ratio, 3), 0) * 1.5
              + COALESCE(gd.advancers_pct, 0) / 100
            ) DESC,
            gd.group_name ASC
        )::int AS rank
      FROM group_daily gd
      WHERE gd.data_stock_count > 0
    )
    SELECT
      md.date::text AS date,
      md.stock_count,
      md.data_stock_count,
      md.return_1d,
      md.return_5d,
      md.return_20d,
      md.advancers_pct,
      md.turnover,
      md.turnover_ratio,
      md.volume_ratio,
      md.intraday_range,
      lr.group_id AS leader_group_id,
      lr.group_name AS leader_group_name,
      lr.return_1d AS leader_return_1d,
      lr.turnover_ratio AS leader_turnover_ratio
    FROM market_daily md
    LEFT JOIN leader_ranked lr
      ON lr.date = md.date
     AND lr.rank = 1
    ORDER BY md.date DESC
  `)

  return (result.rows as Record<string, unknown>[]).map((row) => {
    const return1d = toNullableNumber(row.return_1d)
    const return5d = toNullableNumber(row.return_5d)
    const return20d = toNullableNumber(row.return_20d)
    const advancersPct = toNullableNumber(row.advancers_pct)
    const turnoverRatio = toNullableNumber(row.turnover_ratio)
    const volumeRatio = toNullableNumber(row.volume_ratio)
    const intradayRange = toNullableNumber(row.intraday_range)
    const scores = calcDailyMarketScores({
      return1d,
      return5d,
      advancersPct,
      turnoverRatio,
      volumeRatio,
      intradayRange,
    })
    const judgment = judgeDailyMarket({
      return1d,
      return5d,
      advancersPct,
      turnoverRatio,
      volumeRatio,
      intradayRange,
    })

    return {
      date: String(row.date ?? ''),
      stockCount: Number(row.stock_count ?? 0),
      dataStockCount: Number(row.data_stock_count ?? 0),
      return1d,
      return5d,
      return20d,
      advancersPct,
      turnover: toNullableNumber(row.turnover),
      turnoverRatio,
      volumeRatio,
      intradayRange,
      leaderGroupId: row.leader_group_id == null ? null : String(row.leader_group_id),
      leaderGroupName: row.leader_group_name == null ? null : String(row.leader_group_name),
      leaderReturn1d: toNullableNumber(row.leader_return_1d),
      leaderTurnoverRatio: toNullableNumber(row.leader_turnover_ratio),
      momentumScore: scores.momentumScore,
      flowScore: scores.flowScore,
      volatilityScore: scores.volatilityScore,
      status: judgment.status,
      statusTone: judgment.tone,
    }
  })
}
