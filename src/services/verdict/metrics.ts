import type { FinancialPoint, VerdictSources } from './series'
import type { MetricId, MetricSeriesMap, MetricSeriesPoint } from './types'
import { PHASE1_METRIC_IDS } from './weights'

// BPS 取得（IFRS 中間で空のとき自己資本/(発行済 - 自己株式) で代替）
export function bpsFallback(fp: FinancialPoint): number | null {
  if (fp.bps !== null && fp.bps > 0) return fp.bps
  const equity = fp.equity
  if (equity === null) return null
  const shOut = fp.shOutFy
  if (shOut === null) return null
  const trSh = fp.trShFy ?? 0
  const float = shOut - trSh
  if (float > 0) return equity / float
  return null
}

// 配列 (discDate 昇順) から discDate <= asOfDate を満たす最後の要素を返す
export function findFinancialAsOf(
  financials: FinancialPoint[],
  asOfDate: string,
): FinancialPoint | null {
  let result: FinancialPoint | null = null
  for (const f of financials) {
    if (f.discDate <= asOfDate) result = f
    else break
  }
  return result
}

// 3 年前の FY を見つける（base.discDate から 3 年前以前で最新）
export function findFinancialThreeYearsAgo(
  financials: FinancialPoint[],
  base: FinancialPoint,
): FinancialPoint | null {
  const target = new Date(`${base.discDate}T00:00:00Z`)
  target.setUTCFullYear(target.getUTCFullYear() - 3)
  const targetIso = target.toISOString().slice(0, 10)
  let result: FinancialPoint | null = null
  for (const f of financials) {
    if (f.discDate <= targetIso) result = f
    else break
  }
  // 同一行になっている場合は無効
  if (result && result.discDate === base.discDate) return null
  return result
}

// 単一時点 (price + financial) からの指標値を計算
export interface MetricInputs {
  close: number
  financial: FinancialPoint
  threeYearAgo: FinancialPoint | null
}

export function computePhase1Values(input: MetricInputs): Partial<Record<MetricId, number | null>> {
  const { close, financial: f, threeYearAgo: f3y } = input
  const eps = f.eps
  const bps = bpsFallback(f)
  const sales = f.sales
  const np = f.np
  const equity = f.equity
  const divAnn = f.divAnn
  const shOut = f.shOutFy

  // PER (実績)
  const perActual = eps !== null && eps > 0 ? close / eps : null

  // PBR
  const pbr = bps !== null && bps > 0 ? close / bps : null

  // PSR = 時価総額 / 売上(直近開示)
  let psr: number | null = null
  if (shOut !== null && shOut > 0 && sales !== null && sales > 0) {
    psr = (close * shOut) / sales
  }

  // 配当利回り(%)
  const dividendYield =
    divAnn !== null && divAnn > 0 && close > 0 ? (divAnn / close) * 100 : null

  // ROE(%)
  const roe = np !== null && equity !== null && equity > 0 ? (np / equity) * 100 : null

  // 配当性向(%) = 配当(per share) / EPS × 100
  let payoutRatio: number | null = null
  if (eps !== null && eps > 0 && divAnn !== null && divAnn >= 0) {
    payoutRatio = (divAnn / eps) * 100
  }

  // Graham Ratio = 株価 / √(22.5 × EPS × BPS)
  let grahamRatio: number | null = null
  if (eps !== null && eps > 0 && bps !== null && bps > 0) {
    const denom = Math.sqrt(22.5 * eps * bps)
    if (denom > 0) grahamRatio = close / denom
  }

  // EPS 3年 CAGR(%)
  let epsCagr3y: number | null = null
  if (f3y && f3y.eps !== null && f3y.eps > 0 && eps !== null && eps > 0) {
    epsCagr3y = (Math.pow(eps / f3y.eps, 1 / 3) - 1) * 100
  }

  return {
    per_actual: perActual,
    pbr,
    psr,
    dividend_yield: dividendYield,
    roe,
    payout_ratio: payoutRatio,
    graham_ratio: grahamRatio,
    eps_cagr_3y: epsCagr3y,
  }
}

// 株価系列 × 財務系列 → 各指標の時系列
export function computePhase1Series(sources: VerdictSources): MetricSeriesMap {
  const { prices, financials } = sources

  const series: Record<string, MetricSeriesPoint[]> = {}
  for (const id of PHASE1_METRIC_IDS) series[id] = []

  for (const p of prices) {
    const f = findFinancialAsOf(financials, p.date)
    if (!f) {
      for (const id of PHASE1_METRIC_IDS) {
        series[id].push({ date: p.date, value: null })
      }
      continue
    }
    const f3y = findFinancialThreeYearsAgo(financials, f)
    const values = computePhase1Values({ close: p.close, financial: f, threeYearAgo: f3y })
    for (const id of PHASE1_METRIC_IDS) {
      const v = values[id]
      series[id].push({ date: p.date, value: v ?? null })
    }
  }

  return series as MetricSeriesMap
}
