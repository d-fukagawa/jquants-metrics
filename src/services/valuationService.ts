import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'

export const VALUATION_MARKETS = ['プライム', 'スタンダード', 'グロース'] as const
export type ValuationMarket = typeof VALUATION_MARKETS[number]

export const VALUATION_PERIODS = ['previous', '1m', '3m'] as const
export type ValuationPeriod = typeof VALUATION_PERIODS[number]

export const VALUATION_RANKINGS = [
  'eps_up',
  'eps_down',
  'eps_up_per_down',
  'expectation_driven',
  'historically_cheap',
  'roe_improvement',
  'forecast_growth',
] as const
export type ValuationRanking = typeof VALUATION_RANKINGS[number]

export const VALUATION_LIMITS = [50, 100] as const
export type ValuationLimit = typeof VALUATION_LIMITS[number]

export interface ValuationRankingOptions {
  date?: string
  market?: ValuationMarket
  period?: ValuationPeriod
  ranking?: ValuationRanking
  limit?: ValuationLimit
}

export interface ValuationRankingRow {
  rank: number
  code: string
  code4: string
  coName: string
  market: string
  comparisonDate: string | null
  epsTtm: number | null
  epsCompanyForecast: number
  previousEpsCompanyForecast: number | null
  epsChange: number | null
  epsChangePct: number | null
  perCompanyForecast: number | null
  previousPerCompanyForecast: number | null
  perChangePct: number | null
  close: number | null
  previousClose: number | null
  priceChangePct: number | null
  epsPriceGapPct: number | null
  epsPriceGap1mPct: number | null
  epsPriceGap3mPct: number | null
  forecastVsTtmEpsPct: number | null
  roeTtm: number | null
  roeCompanyForecast: number | null
  roeImprovementPoint: number | null
  marketCapMillion: number | null
  perPercentile1y: number | null
  perPercentile3y: number | null
  perPercentile5y: number | null
  perMedian1y: number | null
  perMedian3y: number | null
  perMedian5y: number | null
  perObservationCount1y: number
  perObservationCount3y: number
  perObservationCount5y: number
  perHistoryStartDate: string | null
  hasFinancialDisclosure: boolean
  corporateActionSuspected: boolean
  judgment: '業績優位' | '期待先行' | 'EPS上昇・PER低下' | '要確認'
}

export interface ValuationRankingResult {
  date: string | null
  rows: ValuationRankingRow[]
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

function classify(row: {
  epsChangePct: number | null
  perChangePct: number | null
  priceChangePct: number | null
  corporateActionSuspected: boolean
}): ValuationRankingRow['judgment'] {
  if (row.corporateActionSuspected) return '要確認'
  if (row.epsChangePct != null && row.epsChangePct > 0 && row.perChangePct != null && row.perChangePct < 0) {
    return 'EPS上昇・PER低下'
  }
  if (row.priceChangePct != null && row.epsChangePct != null && row.priceChangePct - row.epsChangePct >= 10) {
    return '期待先行'
  }
  if (row.priceChangePct != null && row.epsChangePct != null && row.epsChangePct > row.priceChangePct) {
    return '業績優位'
  }
  return '要確認'
}

export async function listValuationRankings(
  db: Db,
  options: ValuationRankingOptions = {},
): Promise<ValuationRankingResult> {
  const period = VALUATION_PERIODS.includes(options.period ?? 'previous')
    ? (options.period ?? 'previous')
    : 'previous'
  const ranking = VALUATION_RANKINGS.includes(options.ranking ?? 'eps_up')
    ? (options.ranking ?? 'eps_up')
    : 'eps_up'
  const limit = VALUATION_LIMITS.includes(options.limit ?? 50)
    ? (options.limit ?? 50)
    : 50
  const targetDate = options.date
    ? sql`${options.date}::date`
    : sql`(SELECT MAX(date) FROM equity_valuations)`
  const marketFilter = options.market ? sql`AND sm.mkt_nm = ${options.market}` : sql``
  const comparisonFilter = period === '1m'
    ? sql`AND previous.date <= current_row.date - INTERVAL '1 month'`
    : period === '3m'
      ? sql`AND previous.date <= current_row.date - INTERVAL '3 months'`
      : sql``
  const rankingFilter = ranking === 'eps_down'
    ? sql`eps_change_pct < 0`
    : ranking === 'eps_up_per_down'
      ? sql`eps_change_pct > 0 AND per_change_pct < 0`
      : ranking === 'expectation_driven'
        ? sql`price_change_pct - eps_change_pct >= 10`
        : ranking === 'historically_cheap'
          ? sql`per_percentile_5y <= 20 AND per_observation_count_5y >= 200`
          : ranking === 'roe_improvement'
            ? sql`roe_improvement_point > 0`
            : ranking === 'forecast_growth'
              ? sql`forecast_vs_ttm_eps_pct > 0`
              : sql`eps_change_pct > 0`
  const rankingScore = ranking === 'eps_down'
    ? sql`-eps_change_pct`
    : ranking === 'eps_up_per_down'
      ? sql`eps_change_pct - per_change_pct`
      : ranking === 'expectation_driven'
        ? sql`price_change_pct - eps_change_pct`
        : ranking === 'historically_cheap'
          ? sql`100 - per_percentile_5y`
          : ranking === 'roe_improvement'
            ? sql`roe_improvement_point`
            : ranking === 'forecast_growth'
              ? sql`forecast_vs_ttm_eps_pct`
              : sql`eps_change_pct`

  const result = await db.execute(sql`
    WITH selected_date AS (
      SELECT ${targetDate} AS target_date
    ),
    current_valuations AS (
      SELECT
        valuation.*,
        sm.co_name,
        sm.mkt_nm
      FROM selected_date selected
      JOIN equity_valuations valuation ON valuation.date = selected.target_date
      JOIN stock_master sm ON sm.code = valuation.code
      WHERE TRUE
        ${marketFilter}
    ),
    historical_per_stats AS (
      SELECT
        current_row.code,
        MIN(history.date)::text AS per_history_start_date,
        COUNT(history.date) FILTER (
          WHERE history.date >= current_row.date - INTERVAL '1 year'
        )::int AS per_observation_count_1y,
        COUNT(history.date) FILTER (
          WHERE history.date >= current_row.date - INTERVAL '3 years'
        )::int AS per_observation_count_3y,
        COUNT(history.date)::int AS per_observation_count_5y,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY history.per_company_forecast::float
        ) FILTER (
          WHERE history.date >= current_row.date - INTERVAL '1 year'
        ) AS per_median_1y,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY history.per_company_forecast::float
        ) FILTER (
          WHERE history.date >= current_row.date - INTERVAL '3 years'
        ) AS per_median_3y,
        percentile_cont(0.5) WITHIN GROUP (
          ORDER BY history.per_company_forecast::float
        ) AS per_median_5y,
        CASE
          WHEN current_row.per_company_forecast::float > 0 THEN
            COUNT(history.date) FILTER (
              WHERE history.date >= current_row.date - INTERVAL '1 year'
                AND history.per_company_forecast::float <= current_row.per_company_forecast::float
            )::float
            / NULLIF(COUNT(history.date) FILTER (
              WHERE history.date >= current_row.date - INTERVAL '1 year'
            ), 0) * 100
          ELSE NULL
        END AS per_percentile_1y,
        CASE
          WHEN current_row.per_company_forecast::float > 0 THEN
            COUNT(history.date) FILTER (
              WHERE history.date >= current_row.date - INTERVAL '3 years'
                AND history.per_company_forecast::float <= current_row.per_company_forecast::float
            )::float
            / NULLIF(COUNT(history.date) FILTER (
              WHERE history.date >= current_row.date - INTERVAL '3 years'
            ), 0) * 100
          ELSE NULL
        END AS per_percentile_3y,
        CASE
          WHEN current_row.per_company_forecast::float > 0 THEN
            COUNT(history.date) FILTER (
              WHERE history.per_company_forecast::float <= current_row.per_company_forecast::float
            )::float
            / NULLIF(COUNT(history.date), 0) * 100
          ELSE NULL
        END AS per_percentile_5y
      FROM current_valuations current_row
      LEFT JOIN equity_valuations history
        ON history.code = current_row.code
       AND history.date <= current_row.date
       AND history.date >= current_row.date - INTERVAL '5 years'
       AND history.per_company_forecast::float > 0
      GROUP BY current_row.code, current_row.date, current_row.per_company_forecast
    ),
    paired AS (
      SELECT
        current_row.*,
        previous.date AS comparison_date,
        previous.eps_company_forecast AS previous_eps_company_forecast,
        previous.per_company_forecast AS previous_per_company_forecast,
        current_price.adj_close AS current_close,
        previous_price.adj_close AS previous_close,
        one_month.eps_company_forecast AS eps_company_forecast_1m,
        one_month.adj_close AS close_1m,
        three_month.eps_company_forecast AS eps_company_forecast_3m,
        three_month.adj_close AS close_3m,
        per_stats.per_history_start_date,
        per_stats.per_observation_count_1y,
        per_stats.per_observation_count_3y,
        per_stats.per_observation_count_5y,
        per_stats.per_median_1y,
        per_stats.per_median_3y,
        per_stats.per_median_5y,
        per_stats.per_percentile_1y,
        per_stats.per_percentile_3y,
        per_stats.per_percentile_5y,
        EXISTS (
          SELECT 1
          FROM daily_prices action_price
          WHERE action_price.code = current_row.code
            AND action_price.date > previous.date
            AND action_price.date <= current_row.date
            AND action_price.adj_factor IS NOT NULL
            AND action_price.adj_factor::float <> 1
        ) AS corporate_action_suspected,
        EXISTS (
          SELECT 1
          FROM financial_summary financial
          WHERE financial.code = current_row.code
            AND financial.disc_date > previous.date
            AND financial.disc_date <= current_row.date
        ) AS has_financial_disclosure
      FROM current_valuations current_row
      JOIN historical_per_stats per_stats ON per_stats.code = current_row.code
      LEFT JOIN LATERAL (
        SELECT
          previous.date,
          previous.eps_company_forecast,
          previous.per_company_forecast
        FROM equity_valuations previous
        WHERE previous.code = current_row.code
          AND previous.date < current_row.date
          ${comparisonFilter}
        ORDER BY previous.date DESC
        LIMIT 1
      ) previous ON TRUE
      LEFT JOIN daily_prices current_price
        ON current_price.code = current_row.code
       AND current_price.date = current_row.date
      LEFT JOIN daily_prices previous_price
        ON previous_price.code = current_row.code
       AND previous_price.date = previous.date
      LEFT JOIN LATERAL (
        SELECT
          history.eps_company_forecast,
          history_price.adj_close
        FROM equity_valuations history
        LEFT JOIN daily_prices history_price
          ON history_price.code = history.code
         AND history_price.date = history.date
        WHERE history.code = current_row.code
          AND history.date <= current_row.date - INTERVAL '1 month'
        ORDER BY history.date DESC
        LIMIT 1
      ) one_month ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          history.eps_company_forecast,
          history_price.adj_close
        FROM equity_valuations history
        LEFT JOIN daily_prices history_price
          ON history_price.code = history.code
         AND history_price.date = history.date
        WHERE history.code = current_row.code
          AND history.date <= current_row.date - INTERVAL '3 months'
        ORDER BY history.date DESC
        LIMIT 1
      ) three_month ON TRUE
    ),
    calculated AS (
      SELECT
        paired.*,
        eps_company_forecast::float - previous_eps_company_forecast::float AS eps_change,
        CASE
          WHEN previous_eps_company_forecast::float <> 0
            THEN (eps_company_forecast::float / previous_eps_company_forecast::float - 1) * 100
          ELSE NULL
        END AS eps_change_pct,
        CASE
          WHEN previous_per_company_forecast::float > 0
            THEN (per_company_forecast::float / previous_per_company_forecast::float - 1) * 100
          ELSE NULL
        END AS per_change_pct,
        CASE
          WHEN previous_close::float > 0
            THEN (current_close::float / previous_close::float - 1) * 100
          ELSE NULL
        END AS price_change_pct,
        CASE
          WHEN eps_ttm::float <> 0
            THEN (eps_company_forecast::float / eps_ttm::float - 1) * 100
          ELSE NULL
        END AS forecast_vs_ttm_eps_pct,
        CASE
          WHEN roe_company_forecast IS NOT NULL AND roe_ttm IS NOT NULL
            THEN (roe_company_forecast::float - roe_ttm::float) * 100
          ELSE NULL
        END AS roe_improvement_point,
        CASE
          WHEN eps_company_forecast_1m::float <> 0 AND close_1m::float > 0
            THEN (
              eps_company_forecast::float / eps_company_forecast_1m::float
              - current_close::float / close_1m::float
            ) * 100
          ELSE NULL
        END AS eps_price_gap_1m_pct,
        CASE
          WHEN eps_company_forecast_3m::float <> 0 AND close_3m::float > 0
            THEN (
              eps_company_forecast::float / eps_company_forecast_3m::float
              - current_close::float / close_3m::float
            ) * 100
          ELSE NULL
        END AS eps_price_gap_3m_pct
      FROM paired
    ),
    with_gap AS (
      SELECT
        calculated.*,
        CASE
          WHEN price_change_pct IS NOT NULL THEN eps_change_pct - price_change_pct
          ELSE NULL
        END AS eps_price_gap_pct
      FROM calculated
    ),
    filtered AS (
      SELECT
        with_gap.*,
        ${rankingScore} AS ranking_score
      FROM with_gap
      WHERE ${rankingFilter}
    ),
    ranked AS (
      SELECT
        ROW_NUMBER() OVER (ORDER BY ranking_score DESC NULLS LAST, code ASC)::int AS rank,
        *
      FROM filtered
      ORDER BY ranking_score DESC NULLS LAST, code ASC
      LIMIT ${limit}
    )
    SELECT
      selected.target_date::text AS target_date,
      ranked.rank,
      ranked.code,
      ranked.co_name,
      ranked.mkt_nm,
      ranked.comparison_date::text AS comparison_date,
      ranked.eps_ttm,
      ranked.eps_company_forecast,
      ranked.previous_eps_company_forecast,
      ranked.eps_change,
      ranked.eps_change_pct,
      ranked.per_company_forecast,
      ranked.previous_per_company_forecast,
      ranked.per_change_pct,
      ranked.current_close,
      ranked.previous_close,
      ranked.price_change_pct,
      ranked.eps_price_gap_pct,
      ranked.eps_price_gap_1m_pct,
      ranked.eps_price_gap_3m_pct,
      ranked.forecast_vs_ttm_eps_pct,
      ranked.roe_ttm,
      ranked.roe_company_forecast,
      ranked.roe_improvement_point,
      ranked.market_cap_million,
      ranked.per_history_start_date,
      ranked.per_observation_count_1y,
      ranked.per_observation_count_3y,
      ranked.per_observation_count_5y,
      ranked.per_median_1y,
      ranked.per_median_3y,
      ranked.per_median_5y,
      ranked.per_percentile_1y,
      ranked.per_percentile_3y,
      ranked.per_percentile_5y,
      ranked.has_financial_disclosure,
      ranked.corporate_action_suspected
    FROM selected_date selected
    LEFT JOIN ranked ON TRUE
    ORDER BY ranked.rank ASC NULLS LAST
  `)

  const rawRows = result.rows as Record<string, unknown>[]
  const metadata = rawRows[0]
  const rows = rawRows
    .filter(row => row.code != null)
    .map((row): ValuationRankingRow => {
      const epsChangePct = toNullableNumber(row.eps_change_pct)
      const perChangePct = toNullableNumber(row.per_change_pct)
      const priceChangePct = toNullableNumber(row.price_change_pct)
      const corporateActionSuspected = toBoolean(row.corporate_action_suspected)
      const classification = {
        epsChangePct,
        perChangePct,
        priceChangePct,
        corporateActionSuspected,
      }
      return {
        rank: Number(row.rank),
        code: String(row.code),
        code4: String(row.code).slice(0, 4),
        coName: String(row.co_name ?? ''),
        market: String(row.mkt_nm ?? ''),
        comparisonDate: row.comparison_date == null ? null : String(row.comparison_date),
        epsTtm: toNullableNumber(row.eps_ttm),
        epsCompanyForecast: Number(row.eps_company_forecast),
        previousEpsCompanyForecast: toNullableNumber(row.previous_eps_company_forecast),
        epsChange: toNullableNumber(row.eps_change),
        epsChangePct,
        perCompanyForecast: toNullableNumber(row.per_company_forecast),
        previousPerCompanyForecast: toNullableNumber(row.previous_per_company_forecast),
        perChangePct,
        close: toNullableNumber(row.current_close),
        previousClose: toNullableNumber(row.previous_close),
        priceChangePct,
        epsPriceGapPct: toNullableNumber(row.eps_price_gap_pct),
        epsPriceGap1mPct: toNullableNumber(row.eps_price_gap_1m_pct),
        epsPriceGap3mPct: toNullableNumber(row.eps_price_gap_3m_pct),
        forecastVsTtmEpsPct: toNullableNumber(row.forecast_vs_ttm_eps_pct),
        roeTtm: toNullableNumber(row.roe_ttm),
        roeCompanyForecast: toNullableNumber(row.roe_company_forecast),
        roeImprovementPoint: toNullableNumber(row.roe_improvement_point),
        marketCapMillion: toNullableNumber(row.market_cap_million),
        perPercentile1y: toNullableNumber(row.per_percentile_1y),
        perPercentile3y: toNullableNumber(row.per_percentile_3y),
        perPercentile5y: toNullableNumber(row.per_percentile_5y),
        perMedian1y: toNullableNumber(row.per_median_1y),
        perMedian3y: toNullableNumber(row.per_median_3y),
        perMedian5y: toNullableNumber(row.per_median_5y),
        perObservationCount1y: Number(row.per_observation_count_1y ?? 0),
        perObservationCount3y: Number(row.per_observation_count_3y ?? 0),
        perObservationCount5y: Number(row.per_observation_count_5y ?? 0),
        perHistoryStartDate: row.per_history_start_date == null
          ? null
          : String(row.per_history_start_date),
        hasFinancialDisclosure: toBoolean(row.has_financial_disclosure),
        corporateActionSuspected,
        judgment: classify(classification),
      }
    })

  return {
    date: metadata?.target_date == null ? null : String(metadata.target_date),
    rows,
  }
}
