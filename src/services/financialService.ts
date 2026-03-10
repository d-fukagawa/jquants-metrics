import { desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { financialSummary } from '../db/schema'

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

function parseNum(s: string | null | undefined): number | null {
  if (!s) return null
  const n = parseFloat(s)
  return isNaN(n) ? null : n
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

  const eps    = parseNum(fy.eps)
  const equity = parseNum(fy.equity)
  const np     = parseNum(fy.np)
  const divAnn = parseNum(fy.divAnn)

  // BPS フォールバック: IFRS 中間では空 → Eq / (ShOutFY - TrShFY)
  let bps = parseNum(fy.bps)
  if (bps === null && equity !== null) {
    const shOut = parseNum(fy.shOutFy)
    const trSh  = parseNum(fy.trShFy)
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
  const n = parseNum(s)
  if (n === null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '▼ ' : ''
  if (abs >= 1e12) return `${sign}¥${(n / 1e12).toFixed(2)}兆`
  if (abs >= 1e8)  return `${sign}¥${(n / 1e8).toFixed(2)}億`
  return `${sign}¥${n.toLocaleString()}`
}

// 万株単位に変換
export function fmtVolume(s: string | null | undefined): string {
  const n = parseNum(s)
  if (n === null) return '—'
  return `${Math.round(n / 1000).toLocaleString()}`
}

function round1(n: number) { return Math.round(n * 10) / 10 }
function round2(n: number) { return Math.round(n * 100) / 100 }
