import { sql } from 'drizzle-orm'
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
}

function toNum(v: unknown): number {
  return Number(v ?? 0)
}

function toText(v: unknown): string | null {
  return v == null ? null : String(v)
}

export async function getSyncStatusSummary(db: Db): Promise<SyncStatusSummary> {
  const masterResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS count,
      MAX(updated_at)::text AS latest_updated_at
    FROM stock_master
  `)
  const masterRow = (masterResult.rows[0] ?? {}) as Record<string, unknown>
  const masterCount = toNum(masterRow.count)
  const masterUpdatedAt = toText(masterRow.latest_updated_at)

  const priceResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(DISTINCT date)::int AS date_count,
      MAX(date)::text AS latest_date
    FROM daily_prices
  `)
  const priceRow = (priceResult.rows[0] ?? {}) as Record<string, unknown>
  const priceTotalCount = toNum(priceRow.total_count)
  const priceDateCount = toNum(priceRow.date_count)
  const priceLatestDate = toText(priceRow.latest_date)

  const priceLatestResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS latest_count
    FROM daily_prices
    WHERE date = (SELECT MAX(date) FROM daily_prices)
  `)
  const priceLatestRow = (priceLatestResult.rows[0] ?? {}) as Record<string, unknown>
  const priceLatestDateCount = toNum(priceLatestRow.latest_count)

  const finResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(DISTINCT code)::int AS code_count,
      MAX(disc_date)::text AS latest_disc_date
    FROM financial_summary
  `)
  const finRow = (finResult.rows[0] ?? {}) as Record<string, unknown>
  const financialTotalCount = toNum(finRow.total_count)
  const financialCodeCount = toNum(finRow.code_count)
  const financialLatestDiscDate = toText(finRow.latest_disc_date)

  const finLatestResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS latest_count
    FROM financial_summary
    WHERE disc_date = (SELECT MAX(disc_date) FROM financial_summary)
  `)
  const finLatestRow = (finLatestResult.rows[0] ?? {}) as Record<string, unknown>
  const financialLatestDiscDateCount = toNum(finLatestRow.latest_count)

  const detailsResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total_count,
      COUNT(DISTINCT code)::int AS code_count,
      COUNT(*) FILTER (WHERE dna IS NOT NULL)::int AS dna_count,
      MAX(disc_date)::text AS latest_disc_date
    FROM fins_details
  `)
  const detailsRow = (detailsResult.rows[0] ?? {}) as Record<string, unknown>
  const finsDetailsTotalCount = toNum(detailsRow.total_count)
  const finsDetailsCodeCount = toNum(detailsRow.code_count)
  const finsDetailsDnaCount = toNum(detailsRow.dna_count)
  const finsDetailsLatestDiscDate = toText(detailsRow.latest_disc_date)

  const detailsLatestResult = await db.execute(sql`
    SELECT
      COUNT(*)::int AS latest_count
    FROM fins_details
    WHERE disc_date = (SELECT MAX(disc_date) FROM fins_details)
  `)
  const detailsLatestRow = (detailsLatestResult.rows[0] ?? {}) as Record<string, unknown>
  const finsDetailsLatestDiscDateCount = toNum(detailsLatestRow.latest_count)

  const ebitdaReadyResult = await db.execute(sql`
    WITH latest_fin AS (
      SELECT DISTINCT ON (code)
        code,
        op::float AS op
      FROM financial_summary
      WHERE cur_per_type = 'FY'
      ORDER BY code, disc_date DESC
    ),
    latest_details AS (
      SELECT DISTINCT ON (code)
        code,
        dna::float AS dna
      FROM fins_details
      ORDER BY code, (dna IS NOT NULL) DESC, disc_date DESC
    )
    SELECT COUNT(*)::int AS ready_count
    FROM latest_fin f
    JOIN latest_details d ON d.code = f.code
    WHERE f.op IS NOT NULL
      AND d.dna IS NOT NULL
  `)
  const ebitdaReadyRow = (ebitdaReadyResult.rows[0] ?? {}) as Record<string, unknown>
  const ebitdaReadyCount = toNum(ebitdaReadyRow.ready_count)

  const evReadyResult = await db.execute(sql`
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
    latest_details AS (
      SELECT DISTINCT ON (code)
        code,
        dna::float AS dna,
        COALESCE(debt_current::float, 0) AS debt_current,
        COALESCE(debt_non_curr::float, 0) AS debt_non_curr
      FROM fins_details
      ORDER BY code, (dna IS NOT NULL) DESC, disc_date DESC
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
  `)
  const evReadyRow = (evReadyResult.rows[0] ?? {}) as Record<string, unknown>
  const evEbitdaReadyCount = toNum(evReadyRow.ready_count)

  const missingPriceOnLatest = priceLatestDate
    ? Math.max(masterCount - priceLatestDateCount, 0)
    : null
  const financialCoveragePct = masterCount > 0
    ? Math.round((financialCodeCount / masterCount) * 1000) / 10
    : null
  const finsDetailsCoveragePct = masterCount > 0
    ? Math.round((finsDetailsCodeCount / masterCount) * 1000) / 10
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
  }
}
