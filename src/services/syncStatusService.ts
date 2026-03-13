import { sql, type SQL } from 'drizzle-orm'
import type { Db } from '../db/client'

export interface SyncStatusSummary {
  masterCount: number
  masterUpdatedAt: string | null
  priceTotalCount: number
  priceDateCount: number
  priceLatestDate: string | null
  priceLatestDateCount: number
  financialTotalCount: number
  financialCodeCount: number
  financialLatestDiscDate: string | null
  financialLatestDiscDateCount: number
  finsDetailsTotalCount: number
  finsDetailsCodeCount: number
  finsDetailsDnaCount: number
  finsDetailsLatestDiscDate: string | null
  finsDetailsLatestDiscDateCount: number
  missingPriceOnLatest: number | null
  financialCoveragePct: number | null
  finsDetailsCoveragePct: number | null
  ebitdaReadyCount: number
  evEbitdaReadyCount: number
  edinetRunTotal: number
  edinetRunSuccess: number
  edinetSuccessRatePct: number | null
  edinetLatestSuccessAt: string | null
  edinetHttp429Total: number
  edinetHttp5xxTotal: number
  edinetTimelineCodeCount: number
  edinetForecastCodeCount: number
  edinetBridgeCodeCount: number
  edinetQualityCodeCount: number
  edinetTextCodeCount: number
}

function toNum(v: unknown): number {
  return Number(v ?? 0)
}

function toText(v: unknown): string | null {
  return v == null ? null : String(v)
}

async function queryRow(db: Db, statement: SQL): Promise<Record<string, unknown>> {
  const result = await db.execute(statement)
  return (result.rows[0] ?? {}) as Record<string, unknown>
}

export async function getSyncStatusSummary(db: Db): Promise<SyncStatusSummary> {
  const [
    masterRow,
    priceRow,
    priceLatestRow,
    finRow,
    finLatestRow,
    detailsRow,
    detailsLatestRow,
    ebitdaReadyRow,
    evReadyRow,
    edinetRunRow,
    edinetCoverageRow,
  ] = await Promise.all([
    queryRow(db, sql`
      SELECT
        COUNT(*)::int AS count,
        MAX(updated_at)::text AS latest_updated_at
      FROM stock_master
    `),
    queryRow(db, sql`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(DISTINCT date)::int AS date_count,
        MAX(date)::text AS latest_date
      FROM daily_prices
    `),
    queryRow(db, sql`
      SELECT
        COUNT(*)::int AS latest_count
      FROM daily_prices
      WHERE date = (SELECT MAX(date) FROM daily_prices)
    `),
    queryRow(db, sql`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(DISTINCT code)::int AS code_count,
        MAX(disc_date)::text AS latest_disc_date
      FROM financial_summary
    `),
    queryRow(db, sql`
      SELECT
        COUNT(*)::int AS latest_count
      FROM financial_summary
      WHERE disc_date = (SELECT MAX(disc_date) FROM financial_summary)
    `),
    queryRow(db, sql`
      SELECT
        COUNT(*)::int AS total_count,
        COUNT(DISTINCT code)::int AS code_count,
        COUNT(*) FILTER (WHERE dna IS NOT NULL)::int AS dna_count,
        MAX(disc_date)::text AS latest_disc_date
      FROM fins_details
    `),
    queryRow(db, sql`
      SELECT
        COUNT(*)::int AS latest_count
      FROM fins_details
      WHERE disc_date = (SELECT MAX(disc_date) FROM fins_details)
    `),
    queryRow(db, sql`
      WITH latest_fin AS (
        SELECT DISTINCT ON (code)
          code,
          op::float AS op
        FROM financial_summary
        WHERE cur_per_type = 'FY'
        ORDER BY code, disc_date DESC
      ),
      latest_jquants_details AS (
        SELECT DISTINCT ON (code)
          code,
          dna::float AS dna
        FROM fins_details
        WHERE disc_no NOT LIKE 'EDINET:%'
        ORDER BY code, (dna IS NOT NULL) DESC, disc_date DESC
      ),
      latest_edinet_details AS (
        SELECT DISTINCT ON (code)
          code,
          dna::float AS dna
        FROM fins_details
        WHERE disc_no LIKE 'EDINET:%'
        ORDER BY code, disc_date DESC
      ),
      latest_details AS (
        SELECT
          COALESCE(j.code, e.code) AS code,
          COALESCE(j.dna, e.dna) AS dna
        FROM latest_jquants_details j
        FULL OUTER JOIN latest_edinet_details e
          ON e.code = j.code
      )
      SELECT COUNT(*)::int AS ready_count
      FROM latest_fin f
      JOIN latest_details d ON d.code = f.code
      WHERE f.op IS NOT NULL
        AND d.dna IS NOT NULL
    `),
    queryRow(db, sql`
      WITH latest_price AS (
        SELECT DISTINCT ON (code) code, adj_close::float AS close
        FROM daily_prices
        WHERE adj_close IS NOT NULL
        ORDER BY code, date DESC
      ),
      latest_fin AS (
        SELECT DISTINCT ON (code)
          code,
          op::float AS op,
          cash_eq::float AS cash_eq,
          sh_out_fy::float AS sh_out_fy
        FROM financial_summary
        WHERE cur_per_type = 'FY'
        ORDER BY code, disc_date DESC
      ),
      latest_jquants_details AS (
        SELECT DISTINCT ON (code)
          code,
          dna::float AS dna,
          debt_current::float AS debt_current,
          debt_non_curr::float AS debt_non_curr
        FROM fins_details
        WHERE disc_no NOT LIKE 'EDINET:%'
        ORDER BY code, (dna IS NOT NULL) DESC, disc_date DESC
      ),
      latest_edinet_details AS (
        SELECT DISTINCT ON (code)
          code,
          dna::float AS dna,
          debt_current::float AS debt_current,
          debt_non_curr::float AS debt_non_curr
        FROM fins_details
        WHERE disc_no LIKE 'EDINET:%'
        ORDER BY code, disc_date DESC
      ),
      latest_details AS (
        SELECT
          COALESCE(j.code, e.code) AS code,
          COALESCE(j.dna, e.dna) AS dna,
          COALESCE(j.debt_current, e.debt_current, 0) AS debt_current,
          COALESCE(j.debt_non_curr, e.debt_non_curr, 0) AS debt_non_curr
        FROM latest_jquants_details j
        FULL OUTER JOIN latest_edinet_details e
          ON e.code = j.code
      )
      SELECT COUNT(*)::int AS ready_count
      FROM latest_price p
      JOIN latest_fin f ON f.code = p.code
      JOIN latest_details d ON d.code = p.code
      WHERE d.dna IS NOT NULL
        AND f.op IS NOT NULL
        AND (f.op + d.dna) > 0
        AND f.sh_out_fy > 0
        AND f.cash_eq IS NOT NULL
    `),
    queryRow(db, sql`
      SELECT
        COUNT(*)::int AS run_total,
        COUNT(*) FILTER (WHERE success = true)::int AS run_success,
        MAX(ended_at) FILTER (WHERE success = true) AS latest_success_at,
        COALESCE(SUM(http_429_count), 0)::int AS http429_total,
        COALESCE(SUM(http_5xx_count), 0)::int AS http5xx_total
      FROM edinet_sync_runs
    `),
    queryRow(db, sql`
      SELECT
        (SELECT COUNT(DISTINCT code)::int FROM edinet_filings WHERE code IS NOT NULL) AS timeline_code_count,
        (SELECT COUNT(DISTINCT code)::int FROM edinet_forecasts) AS forecast_code_count,
        (SELECT COUNT(DISTINCT code)::int FROM edinet_bridge_facts) AS bridge_code_count,
        (SELECT COUNT(DISTINCT code)::int FROM edinet_quality_scores) AS quality_code_count,
        (SELECT COUNT(DISTINCT code)::int FROM edinet_text_scores) AS text_code_count
    `),
  ])

  const masterCount = toNum(masterRow.count)
  const masterUpdatedAt = toText(masterRow.latest_updated_at)
  const priceTotalCount = toNum(priceRow.total_count)
  const priceDateCount = toNum(priceRow.date_count)
  const priceLatestDate = toText(priceRow.latest_date)
  const priceLatestDateCount = toNum(priceLatestRow.latest_count)
  const financialTotalCount = toNum(finRow.total_count)
  const financialCodeCount = toNum(finRow.code_count)
  const financialLatestDiscDate = toText(finRow.latest_disc_date)
  const financialLatestDiscDateCount = toNum(finLatestRow.latest_count)
  const finsDetailsTotalCount = toNum(detailsRow.total_count)
  const finsDetailsCodeCount = toNum(detailsRow.code_count)
  const finsDetailsDnaCount = toNum(detailsRow.dna_count)
  const finsDetailsLatestDiscDate = toText(detailsRow.latest_disc_date)
  const finsDetailsLatestDiscDateCount = toNum(detailsLatestRow.latest_count)
  const ebitdaReadyCount = toNum(ebitdaReadyRow.ready_count)
  const evEbitdaReadyCount = toNum(evReadyRow.ready_count)
  const edinetRunTotal = toNum(edinetRunRow.run_total)
  const edinetRunSuccess = toNum(edinetRunRow.run_success)
  const edinetLatestSuccessAt = toText(edinetRunRow.latest_success_at)
  const edinetHttp429Total = toNum(edinetRunRow.http429_total)
  const edinetHttp5xxTotal = toNum(edinetRunRow.http5xx_total)
  const edinetTimelineCodeCount = toNum(edinetCoverageRow.timeline_code_count)
  const edinetForecastCodeCount = toNum(edinetCoverageRow.forecast_code_count)
  const edinetBridgeCodeCount = toNum(edinetCoverageRow.bridge_code_count)
  const edinetQualityCodeCount = toNum(edinetCoverageRow.quality_code_count)
  const edinetTextCodeCount = toNum(edinetCoverageRow.text_code_count)

  const missingPriceOnLatest = priceLatestDate
    ? Math.max(masterCount - priceLatestDateCount, 0)
    : null
  const financialCoveragePct = masterCount > 0
    ? Math.round((financialCodeCount / masterCount) * 1000) / 10
    : null
  const finsDetailsCoveragePct = masterCount > 0
    ? Math.round((finsDetailsCodeCount / masterCount) * 1000) / 10
    : null
  const edinetSuccessRatePct = edinetRunTotal > 0
    ? Math.round((edinetRunSuccess / edinetRunTotal) * 1000) / 10
    : null

  return {
    masterCount,
    masterUpdatedAt,
    priceTotalCount,
    priceDateCount,
    priceLatestDate,
    priceLatestDateCount,
    financialTotalCount,
    financialCodeCount,
    financialLatestDiscDate,
    financialLatestDiscDateCount,
    finsDetailsTotalCount,
    finsDetailsCodeCount,
    finsDetailsDnaCount,
    finsDetailsLatestDiscDate,
    finsDetailsLatestDiscDateCount,
    missingPriceOnLatest,
    financialCoveragePct,
    finsDetailsCoveragePct,
    ebitdaReadyCount,
    evEbitdaReadyCount,
    edinetRunTotal,
    edinetRunSuccess,
    edinetSuccessRatePct,
    edinetLatestSuccessAt,
    edinetHttp429Total,
    edinetHttp5xxTotal,
    edinetTimelineCodeCount,
    edinetForecastCodeCount,
    edinetBridgeCodeCount,
    edinetQualityCodeCount,
    edinetTextCodeCount,
  }
}
