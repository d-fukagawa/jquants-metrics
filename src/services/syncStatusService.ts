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
  missingPriceOnLatest: number | null
  financialCoveragePct: number | null
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

  const missingPriceOnLatest = priceLatestDate
    ? Math.max(masterCount - priceLatestDateCount, 0)
    : null
  const financialCoveragePct = masterCount > 0
    ? Math.round((financialCodeCount / masterCount) * 1000) / 10
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
    missingPriceOnLatest,
    financialCoveragePct,
  }
}

