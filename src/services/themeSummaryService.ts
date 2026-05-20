import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'

export type ThemeSummaryScope = 'themes' | 'sector17'

export type ThemeSummaryStatusTone = 'strong' | 'flow' | 'caution' | 'weak' | 'neutral'
export type ThemeSummarySortKey =
  | 'groupName'
  | 'stockCount'
  | 'return5d'
  | 'return20d'
  | 'return60d'
  | 'advancersPct'
  | 'turnover5dAvg'
  | 'turnoverRatio'
  | 'volumeRatio'
  | 'momentumScore'
  | 'flowScore'
  | 'status'
export type ThemeSummarySortDirection = 'asc' | 'desc'

export interface ThemeSummaryRow {
  groupType: ThemeSummaryScope
  groupId: string
  groupName: string
  stockCount: number
  dataStockCount: number
  latestDate: string | null
  return5d: number | null
  return20d: number | null
  return60d: number | null
  advancersPct: number | null
  turnover5dAvg: number | null
  turnover20dAvg: number | null
  turnoverRatio: number | null
  volumeRatio: number | null
  momentumScore: number
  flowScore: number
  status: string
  statusTone: ThemeSummaryStatusTone
}

export interface ThemeSummaryOptions {
  scope?: ThemeSummaryScope
  sort?: ThemeSummarySortKey
  direction?: ThemeSummarySortDirection
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function compareNullableNumber(a: number | null, b: number | null, direction: ThemeSummarySortDirection): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return direction === 'asc' ? a - b : b - a
}

function compareText(a: string, b: string, direction: ThemeSummarySortDirection): number {
  const compared = a.localeCompare(b, 'ja')
  return direction === 'asc' ? compared : -compared
}

function compareSummaryRows(
  a: ThemeSummaryRow,
  b: ThemeSummaryRow,
  sort: ThemeSummarySortKey,
  direction: ThemeSummarySortDirection,
): number {
  switch (sort) {
    case 'groupName':
      return compareText(a.groupName, b.groupName, direction)
    case 'stockCount':
      return compareNullableNumber(a.stockCount, b.stockCount, direction)
    case 'return5d':
      return compareNullableNumber(a.return5d, b.return5d, direction)
    case 'return20d':
      return compareNullableNumber(a.return20d, b.return20d, direction)
    case 'return60d':
      return compareNullableNumber(a.return60d, b.return60d, direction)
    case 'advancersPct':
      return compareNullableNumber(a.advancersPct, b.advancersPct, direction)
    case 'turnover5dAvg':
      return compareNullableNumber(a.turnover5dAvg, b.turnover5dAvg, direction)
    case 'turnoverRatio':
      return compareNullableNumber(a.turnoverRatio, b.turnoverRatio, direction)
    case 'volumeRatio':
      return compareNullableNumber(a.volumeRatio, b.volumeRatio, direction)
    case 'momentumScore':
      return compareNullableNumber(a.momentumScore, b.momentumScore, direction)
    case 'flowScore':
      return compareNullableNumber(a.flowScore, b.flowScore, direction)
    case 'status':
      return compareText(a.status, b.status, direction)
  }
}

export function sortThemeSummaryRows(
  rows: ThemeSummaryRow[],
  sort: ThemeSummarySortKey,
  direction: ThemeSummarySortDirection,
): ThemeSummaryRow[] {
  return [...rows].sort((a, b) => {
    const primary = compareSummaryRows(a, b, sort, direction)
    if (primary !== 0) return primary
    return a.groupName.localeCompare(b.groupName, 'ja')
  })
}

export function calcThemeSummaryScores(input: {
  return20d: number | null
  advancersPct: number | null
  turnoverRatio: number | null
  volumeRatio: number | null
}): { momentumScore: number; flowScore: number } {
  const returnPoints = input.return20d == null
    ? 40
    : clamp(50 + input.return20d * 250, 0, 100)
  const breadthPoints = input.advancersPct == null
    ? 40
    : clamp(input.advancersPct, 0, 100)
  const momentumScore = Math.round(returnPoints * 0.65 + breadthPoints * 0.35)

  const turnoverPoints = input.turnoverRatio == null
    ? 40
    : clamp(input.turnoverRatio * 40, 0, 100)
  const volumePoints = input.volumeRatio == null
    ? 40
    : clamp(input.volumeRatio * 30, 0, 100)
  const flowScore = Math.round(turnoverPoints * 0.7 + volumePoints * 0.3)

  return { momentumScore, flowScore }
}

export function judgeThemeSummary(input: {
  return5d: number | null
  return20d: number | null
  advancersPct: number | null
  turnoverRatio: number | null
}): { status: string; tone: ThemeSummaryStatusTone } {
  const r5 = input.return5d
  const r20 = input.return20d
  const adv = input.advancersPct
  const tr = input.turnoverRatio

  if (r5 != null && r5 >= 0.1 && tr != null && tr >= 2.5) {
    return { status: '過熱注意', tone: 'caution' }
  }
  if (r20 != null && r20 >= 0.05 && adv != null && adv >= 60 && tr != null && tr >= 1.5) {
    return { status: '勢いあり・資金流入', tone: 'strong' }
  }
  if (r20 != null && r20 >= 0 && tr != null && tr >= 1.8) {
    return { status: '資金流入先行', tone: 'flow' }
  }
  if (r20 != null && r20 >= 0.05 && tr != null && tr < 1.0) {
    return { status: '上昇薄商い', tone: 'caution' }
  }
  if (r20 != null && r20 < 0 && adv != null && adv < 50 && (tr == null || tr < 1.1)) {
    return { status: '弱い', tone: 'weak' }
  }
  if (tr != null && tr >= 1.5) {
    return { status: '資金増', tone: 'flow' }
  }
  return { status: '横ばい', tone: 'neutral' }
}

export async function listThemeSummaries(
  db: Db,
  options: ThemeSummaryOptions = {},
): Promise<ThemeSummaryRow[]> {
  const scope = options.scope ?? 'themes'
  const sort = options.sort ?? 'turnoverRatio'
  const direction = options.direction ?? 'desc'
  const groupFilter = scope === 'sector17'
    ? sql`WHERE group_type = 'sector17'`
    : sql`WHERE group_type = 'themes'`

  const result = await db.execute(sql`
    WITH recent_dates AS (
      SELECT
        date,
        ROW_NUMBER() OVER (ORDER BY date DESC)::int AS rn
      FROM (
        SELECT DISTINCT date
        FROM daily_prices
        ORDER BY date DESC
        LIMIT 61
      ) d
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
    member_counts AS (
      SELECT
        group_type,
        group_id,
        group_name,
        COUNT(DISTINCT code)::int AS stock_count
      FROM group_members
      GROUP BY group_type, group_id, group_name
    ),
    code_points AS (
      SELECT
        gm.group_type,
        gm.group_id,
        gm.group_name,
        gm.code,
        MAX(dp.adj_close::float) FILTER (WHERE rd.rn = 1) AS close_latest,
        MAX(dp.adj_close::float) FILTER (WHERE rd.rn = 6) AS close_5d,
        MAX(dp.adj_close::float) FILTER (WHERE rd.rn = 21) AS close_20d,
        MAX(dp.adj_close::float) FILTER (WHERE rd.rn = 61) AS close_60d
      FROM group_members gm
      JOIN daily_prices dp
        ON dp.code = gm.code
      JOIN recent_dates rd
        ON rd.date = dp.date
      WHERE dp.adj_close IS NOT NULL
      GROUP BY gm.group_type, gm.group_id, gm.group_name, gm.code
    ),
    code_returns AS (
      SELECT
        group_type,
        group_id,
        group_name,
        code,
        CASE WHEN close_latest > 0 AND close_5d > 0
          THEN close_latest / close_5d - 1
          ELSE NULL END AS return_5d,
        CASE WHEN close_latest > 0 AND close_20d > 0
          THEN close_latest / close_20d - 1
          ELSE NULL END AS return_20d,
        CASE WHEN close_latest > 0 AND close_60d > 0
          THEN close_latest / close_60d - 1
          ELSE NULL END AS return_60d
      FROM code_points
    ),
    group_returns AS (
      SELECT
        group_type,
        group_id,
        group_name,
        COUNT(*) FILTER (WHERE return_20d IS NOT NULL)::int AS data_stock_count,
        AVG(return_5d) AS return_5d,
        AVG(return_20d) AS return_20d,
        AVG(return_60d) AS return_60d,
        ROUND((
          COUNT(*) FILTER (WHERE return_20d > 0)::float
          / NULLIF(COUNT(*) FILTER (WHERE return_20d IS NOT NULL), 0)
          * 100
        )::numeric, 1)::float AS advancers_pct
      FROM code_returns
      GROUP BY group_type, group_id, group_name
    ),
    daily_liquidity AS (
      SELECT
        gm.group_type,
        gm.group_id,
        gm.group_name,
        rd.date,
        rd.rn,
        SUM(dp.turnover::float) AS turnover,
        SUM(COALESCE(dp.adj_volume, dp.volume)::float) AS volume
      FROM group_members gm
      JOIN daily_prices dp
        ON dp.code = gm.code
      JOIN recent_dates rd
        ON rd.date = dp.date
      GROUP BY gm.group_type, gm.group_id, gm.group_name, rd.date, rd.rn
    ),
    liquidity AS (
      SELECT
        group_type,
        group_id,
        group_name,
        AVG(turnover) FILTER (WHERE rn <= 5) AS turnover_5d_avg,
        AVG(turnover) FILTER (WHERE rn <= 20) AS turnover_20d_avg,
        AVG(volume) FILTER (WHERE rn <= 5) AS volume_5d_avg,
        AVG(volume) FILTER (WHERE rn <= 20) AS volume_20d_avg
      FROM daily_liquidity
      GROUP BY group_type, group_id, group_name
    )
    SELECT
      mc.group_type,
      mc.group_id,
      mc.group_name,
      mc.stock_count,
      COALESCE(gr.data_stock_count, 0)::int AS data_stock_count,
      (SELECT date::text FROM recent_dates WHERE rn = 1) AS latest_date,
      gr.return_5d,
      gr.return_20d,
      gr.return_60d,
      gr.advancers_pct,
      l.turnover_5d_avg,
      l.turnover_20d_avg,
      CASE WHEN l.turnover_20d_avg > 0
        THEN l.turnover_5d_avg / l.turnover_20d_avg
        ELSE NULL END AS turnover_ratio,
      CASE WHEN l.volume_20d_avg > 0
        THEN l.volume_5d_avg / l.volume_20d_avg
        ELSE NULL END AS volume_ratio
    FROM member_counts mc
    LEFT JOIN group_returns gr
      ON gr.group_type = mc.group_type
     AND gr.group_id = mc.group_id
    LEFT JOIN liquidity l
      ON l.group_type = mc.group_type
     AND l.group_id = mc.group_id
  `)

  const rows: ThemeSummaryRow[] = (result.rows as Record<string, unknown>[]).map((row) => {
    const return5d = toNullableNumber(row.return_5d)
    const return20d = toNullableNumber(row.return_20d)
    const return60d = toNullableNumber(row.return_60d)
    const advancersPct = toNullableNumber(row.advancers_pct)
    const turnoverRatio = toNullableNumber(row.turnover_ratio)
    const volumeRatio = toNullableNumber(row.volume_ratio)
    const scores = calcThemeSummaryScores({
      return20d,
      advancersPct,
      turnoverRatio,
      volumeRatio,
    })
    const judgment = judgeThemeSummary({
      return5d,
      return20d,
      advancersPct,
      turnoverRatio,
    })

    const groupType: ThemeSummaryScope = row.group_type === 'sector17' ? 'sector17' : 'themes'

    return {
      groupType,
      groupId: String(row.group_id ?? ''),
      groupName: String(row.group_name ?? ''),
      stockCount: Number(row.stock_count ?? 0),
      dataStockCount: Number(row.data_stock_count ?? 0),
      latestDate: row.latest_date == null ? null : String(row.latest_date),
      return5d,
      return20d,
      return60d,
      advancersPct,
      turnover5dAvg: toNullableNumber(row.turnover_5d_avg),
      turnover20dAvg: toNullableNumber(row.turnover_20d_avg),
      turnoverRatio,
      volumeRatio,
      momentumScore: scores.momentumScore,
      flowScore: scores.flowScore,
      status: judgment.status,
      statusTone: judgment.tone,
    }
  })

  return sortThemeSummaryRows(rows, sort, direction)
}
