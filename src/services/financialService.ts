import { and, desc, eq, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { financialAdjustments, financialSummary, finsDetails } from '../db/schema'
import { parseNumber } from '../utils/number'

export type FinancialRow = Awaited<ReturnType<typeof getLatestFinancials>>[number]

// 直近 20 件の財務情報を開示日の新しい順で返す
export async function getLatestFinancials(db: Db, code5: string) {
  return db
    .select()
    .from(financialSummary)
    .where(eq(financialSummary.code, code5))
    .orderBy(desc(financialSummary.discDate))
    .limit(20)
}

export interface Metrics {
  per:      number | null
  pbr:      number | null
  roe:      number | null
  divYield: number | null
  eps:      number | null
  bps:      number | null
  divAnn:   number | null
  curPerType: string | null
  discDate:   string | null
}

export function calcMetrics(
  latestClose: number | null,
  financials: FinancialRow[],
): Metrics {
  // FY（通期）の最新を優先、なければ直近の開示
  const fy = financials.find(f => f.curPerType === 'FY') ?? financials[0] ?? null

  if (!fy || latestClose === null) {
    return { per: null, pbr: null, roe: null, divYield: null,
             eps: null, bps: null, divAnn: null, curPerType: null, discDate: null }
  }

  const eps    = parseNumber(fy.eps)
  const equity = parseNumber(fy.equity)
  const np     = parseNumber(fy.np)
  const divAnn = parseNumber(fy.divAnn)

  // BPS フォールバック: IFRS 中間では空 → Eq / (ShOutFY - TrShFY)
  let bps = parseNumber(fy.bps)
  if (bps === null && equity !== null) {
    const shOut = parseNumber(fy.shOutFy)
    const trSh  = parseNumber(fy.trShFy)
    if (shOut !== null && trSh !== null) {
      const float = shOut - trSh
      bps = float > 0 ? equity / float : null
    }
  }

  const per      = eps    && eps    > 0 ? round1(latestClose / eps)                : null
  const pbr      = bps    && bps    > 0 ? round2(latestClose / bps)                : null
  const roe      = np     && equity && equity > 0 ? round1((np / equity) * 100)    : null
  const divYield = divAnn && latestClose > 0 ? round2((divAnn / latestClose) * 100): null

  return {
    per, pbr, roe, divYield,
    eps:        eps    !== null ? round1(eps)    : null,
    bps:        bps    !== null ? Math.round(bps) : null,
    divAnn,
    curPerType: fy.curPerType,
    discDate:   fy.discDate,
  }
}

// 大きな数値を兆/億で整形（例: 45,100,000,000,000 → "¥45.10兆"）
export function fmtJpy(s: string | null | undefined): string {
  const n = parseNumber(s)
  if (n === null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '▼ ' : ''
  if (abs >= 1e12) return `${sign}¥${(n / 1e12).toFixed(2)}兆`
  if (abs >= 1e8)  return `${sign}¥${(n / 1e8).toFixed(2)}億`
  return `${sign}¥${n.toLocaleString()}`
}

// 万株単位に変換
export function fmtVolume(s: string | null | undefined): string {
  const n = parseNumber(s)
  if (n === null) return '—'
  return `${Math.round(n / 1000).toLocaleString()}`
}

function round0(n: number) { return Math.round(n) }
function round1(n: number) { return Math.round(n * 10) / 10 }
function round2(n: number) { return Math.round(n * 100) / 100 }

// ── 高度財務指標（fins_details が必要）───────────────────────────────────────

export type FinsDetailRow = Awaited<ReturnType<typeof getFinsDetailsLatest>>
export type FinancialAdjustmentRow = Awaited<ReturnType<typeof getFinancialAdjustmentsLatest>>[number]

// 最新の fins_details レコードを返す（なければ null）
export async function getFinsDetailsLatest(db: Db, code5: string): Promise<typeof finsDetails.$inferSelect | null> {
  const jquantsRows = await db
    .select()
    .from(finsDetails)
    .where(and(
      eq(finsDetails.code, code5),
      sql`${finsDetails.discNo} NOT LIKE 'EDINET:%'`,
    ))
    .orderBy(desc(sql`${finsDetails.dna} IS NOT NULL`), desc(finsDetails.discDate))
    .limit(1)

  const edinetRows = await db
    .select()
    .from(finsDetails)
    .where(and(
      eq(finsDetails.code, code5),
      sql`${finsDetails.discNo} LIKE 'EDINET:%'`,
    ))
    .orderBy(desc(finsDetails.discDate))
    .limit(1)

  const j = jquantsRows[0] ?? null
  const e = edinetRows[0] ?? null
  if (!j && !e) return null
  if (j && !e) return j
  if (!j && e) return e

  return {
    ...j!,
    debtCurrent: j!.debtCurrent ?? e!.debtCurrent,
    debtNonCurr: j!.debtNonCurr ?? e!.debtNonCurr,
    dna: j!.dna ?? e!.dna,
    pretaxProfit: j!.pretaxProfit ?? e!.pretaxProfit,
    taxExpense: j!.taxExpense ?? e!.taxExpense,
  }
}

// 最新開示の financial_adjustments 一式を返す（なければ空配列）
export async function getFinancialAdjustmentsLatest(db: Db, code5: string) {
  const jquantsRows = await db
    .select()
    .from(financialAdjustments)
    .where(and(
      eq(financialAdjustments.code, code5),
      eq(financialAdjustments.source, 'fins_details.statement'),
    ))
    .orderBy(desc(financialAdjustments.discDate))

  if (jquantsRows.length > 0) {
    const latestDiscNo = jquantsRows[0].discNo
    return jquantsRows.filter(r => r.discNo === latestDiscNo)
  }

  const edinetRows = await db
    .select()
    .from(financialAdjustments)
    .where(and(
      eq(financialAdjustments.code, code5),
      sql`${financialAdjustments.source} <> 'fins_details.statement'`,
    ))
    .orderBy(desc(financialAdjustments.discDate))

  if (edinetRows.length === 0) return []
  const latestDiscNo = edinetRows[0].discNo
  return edinetRows.filter(r => r.discNo === latestDiscNo)
}

export interface AdvancedMetrics {
  mktCap:       number | null   // 時価総額（円）
  netCash:      number | null   // ネットキャッシュ = CashEq - 有利子負債合計
  netCashRatio: number | null   // ネットキャッシュ比率 = netCash / mktCap
  ev:           number | null   // EV = 時価総額 - ネットキャッシュ
  ebitda:       number | null   // EBITDA = OP + D&A
  evEbitda:     number | null   // EV/EBITDA（倍）
  roic:         number | null   // ROIC（%）
  nopat:        number | null   // NOPAT = OP × (1 - 実効税率)
  investedCap:  number | null   // 投下資本 = Eq + 有利子負債 - CashEq
}

export type AdjustedEbitdaReason =
  | 'ok'
  | 'op_missing'
  | 'dna_missing'
  | 'adjustment_missing'

export interface AdjustedEbitdaMetrics {
  ebitda: number | null
  adjustedEbitda: number | null
  addbackTotal: number
  deductionTotal: number
  reason: AdjustedEbitdaReason
}

export function calcAdvancedMetrics(
  latestClose: number | null,
  fy: FinancialRow | null,
  detail: FinsDetailRow | null,
): AdvancedMetrics {
  const empty: AdvancedMetrics = {
    mktCap: null, netCash: null, netCashRatio: null,
    ev: null, ebitda: null, evEbitda: null,
    roic: null, nopat: null, investedCap: null,
  }
  if (!fy || latestClose === null) return empty

  const shOut  = parseNumber(fy.shOutFy)
  const cashEq = parseNumber(fy.cashEq)
  const op     = parseNumber(fy.op)
  const equity = parseNumber(fy.equity)

  const debtCurrent  = detail ? parseNumber(detail.debtCurrent)  : null
  const debtNonCurr  = detail ? parseNumber(detail.debtNonCurr)  : null
  const dna          = detail ? parseNumber(detail.dna)          : null
  const pretaxProfit = detail ? parseNumber(detail.pretaxProfit) : null
  const taxExpense   = detail ? parseNumber(detail.taxExpense)   : null

  // 時価総額
  const mktCap = shOut !== null ? round0(latestClose * shOut) : null

  // 有利子負債合計・ネットキャッシュ
  const totalDebt = (debtCurrent ?? 0) + (debtNonCurr ?? 0)
  const netCash = cashEq !== null ? round0(cashEq - totalDebt) : null

  // ネットキャッシュ比率
  const netCashRatio = netCash !== null && mktCap !== null && mktCap > 0
    ? round2(netCash / mktCap)
    : null

  // EV = 時価総額 − ネットキャッシュ
  const ev = mktCap !== null && netCash !== null ? round0(mktCap - netCash) : null

  // EBITDA = OP + D&A（D&A が不明な場合は null）
  const ebitda = op !== null && dna !== null ? round0(op + dna) : null

  // EV/EBITDA
  const evEbitda = ev !== null && ebitda !== null && ebitda > 0
    ? round1(ev / ebitda)
    : null

  // 実効税率（データなし時は 30% を仮定）
  const taxRate = pretaxProfit !== null && pretaxProfit > 0 && taxExpense !== null
    ? taxExpense / pretaxProfit
    : 0.30

  // NOPAT = OP × (1 - 実効税率)
  const nopat = op !== null ? round0(op * (1 - taxRate)) : null

  // 投下資本 = Eq + 有利子負債 - CashEq
  const investedCap = equity !== null && cashEq !== null
    ? round0(equity + totalDebt - cashEq)
    : null

  // ROIC = NOPAT / 投下資本 × 100
  const roic = nopat !== null && investedCap !== null && investedCap > 0
    ? round1((nopat / investedCap) * 100)
    : null

  return { mktCap, netCash, netCashRatio, ev, ebitda, evEbitda, roic, nopat, investedCap }
}

export function calcAdjustedEbitda(
  fy: FinancialRow | null,
  detail: FinsDetailRow | null,
  adjustments: FinancialAdjustmentRow[],
): AdjustedEbitdaMetrics {
  const op = fy ? parseNumber(fy.op) : null
  if (op === null) {
    return { ebitda: null, adjustedEbitda: null, addbackTotal: 0, deductionTotal: 0, reason: 'op_missing' }
  }

  const dna = detail ? parseNumber(detail.dna) : null
  if (dna === null) {
    return { ebitda: null, adjustedEbitda: null, addbackTotal: 0, deductionTotal: 0, reason: 'dna_missing' }
  }

  const ebitda = round0(op + dna)
  if (!adjustments || adjustments.length === 0) {
    return { ebitda, adjustedEbitda: null, addbackTotal: 0, deductionTotal: 0, reason: 'adjustment_missing' }
  }

  let addbackTotal = 0
  let deductionTotal = 0
  for (const a of adjustments) {
    const n = parseNumber(a.amount)
    if (n === null || n === 0) continue
    if (a.direction === 'addback') addbackTotal += Math.abs(n)
    if (a.direction === 'deduction') deductionTotal += Math.abs(n)
  }

  const adjustedEbitda = round0(ebitda + addbackTotal - deductionTotal)
  return {
    ebitda,
    adjustedEbitda,
    addbackTotal: round0(addbackTotal),
    deductionTotal: round0(deductionTotal),
    reason: 'ok',
  }
}
