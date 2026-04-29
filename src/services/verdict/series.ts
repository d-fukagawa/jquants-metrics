import { and, asc, eq, gte, lte } from 'drizzle-orm'
import type { Db } from '../../db/client'
import { dailyPrices, financialSummary } from '../../db/schema'
import { parseNumber } from '../../utils/number'

export interface PricePoint {
  date: string
  close: number
}

export interface FinancialPoint {
  discDate: string
  curPerType: string | null
  eps: number | null
  bps: number | null
  sales: number | null
  np: number | null
  equity: number | null
  divAnn: number | null
  shOutFy: number | null
  trShFy: number | null
}

export interface VerdictSources {
  prices: PricePoint[]
  financials: FinancialPoint[]
}

// 期間内の調整後終値を昇順で返す
export async function fetchPriceSeries(
  db: Db,
  code5: string,
  from: string,
  to: string,
): Promise<PricePoint[]> {
  const rows = await db
    .select({
      date: dailyPrices.date,
      adjClose: dailyPrices.adjClose,
    })
    .from(dailyPrices)
    .where(and(
      eq(dailyPrices.code, code5),
      gte(dailyPrices.date, from),
      lte(dailyPrices.date, to),
    ))
    .orderBy(asc(dailyPrices.date))

  const out: PricePoint[] = []
  for (const r of rows) {
    if (!r.date) continue
    const close = parseNumber(r.adjClose)
    if (close === null || close <= 0) continue
    out.push({ date: r.date, close })
  }
  return out
}

// FY 決算の財務サマリーを開示日昇順で返す（ as-of join 用 ）
export async function fetchFinancialFySeries(
  db: Db,
  code5: string,
): Promise<FinancialPoint[]> {
  const rows = await db
    .select({
      discDate: financialSummary.discDate,
      curPerType: financialSummary.curPerType,
      eps: financialSummary.eps,
      bps: financialSummary.bps,
      sales: financialSummary.sales,
      np: financialSummary.np,
      equity: financialSummary.equity,
      divAnn: financialSummary.divAnn,
      shOutFy: financialSummary.shOutFy,
      trShFy: financialSummary.trShFy,
    })
    .from(financialSummary)
    .where(and(
      eq(financialSummary.code, code5),
      eq(financialSummary.curPerType, 'FY'),
    ))
    .orderBy(asc(financialSummary.discDate))

  const out: FinancialPoint[] = []
  for (const r of rows) {
    if (!r.discDate) continue
    out.push({
      discDate: r.discDate,
      curPerType: r.curPerType,
      eps: parseNumber(r.eps),
      bps: parseNumber(r.bps),
      sales: parseNumber(r.sales),
      np: parseNumber(r.np),
      equity: parseNumber(r.equity),
      divAnn: parseNumber(r.divAnn),
      shOutFy: parseNumber(r.shOutFy),
      trShFy: parseNumber(r.trShFy),
    })
  }
  return out
}

export async function buildVerdictSources(
  db: Db,
  code5: string,
  from: string,
  to: string,
): Promise<VerdictSources> {
  const [prices, financials] = await Promise.all([
    fetchPriceSeries(db, code5, from, to),
    fetchFinancialFySeries(db, code5),
  ])
  return { prices, financials }
}
