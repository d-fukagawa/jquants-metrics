import type { Db } from '../../db/client'
import { getStockByCode } from '../stockService'
import { toCode4 } from '../../utils/stockCode'
import { computePhase1Series } from './metrics'
import { buildVerdictSources } from './series'
import { mean, percentile, quantile } from './stats'
import { judgeMetric, judgeTotalScore } from './score'
import type {
  MetricId,
  MetricSeriesMap,
  MetricSeriesPoint,
  MetricStats,
  VerdictResult,
} from './types'
import { METRIC_GROUPS } from './types'
import { VERDICT_WEIGHTS_BALANCED, normalizeWeights, PHASE1_METRIC_IDS } from './weights'

export interface ComputeVerdictOptions {
  asOf?: string                       // YYYY-MM-DD
  lookbackYears?: number | 'auto'     // 'auto' = 利用可能最大
  enabledMetricIds?: ReadonlyArray<MetricId>
}

const DEFAULT_LOOKBACK_YEARS_FALLBACK = 25

function startOfLookback(toDate: string, years: number): string {
  const d = new Date(`${toDate}T00:00:00Z`)
  d.setUTCFullYear(d.getUTCFullYear() - years)
  return d.toISOString().slice(0, 10)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function pickCurrentValue(series: MetricSeriesPoint[], asOf: string): number | null {
  // series は date 昇順前提。asOf <= の最後の値を返す
  for (let i = series.length - 1; i >= 0; i--) {
    const p = series[i]
    if (p.date <= asOf && p.value !== null && Number.isFinite(p.value)) {
      return p.value
    }
  }
  return null
}

function extractValues(series: MetricSeriesPoint[]): number[] {
  const out: number[] = []
  for (const p of series) {
    if (p.value !== null && Number.isFinite(p.value)) out.push(p.value)
  }
  return out
}

export function buildMetricStats(
  metricId: MetricId,
  series: MetricSeriesPoint[] | undefined,
  asOf: string,
  weight: number,
): MetricStats {
  if (!series || series.length === 0) {
    return {
      metricId,
      current: null,
      mean: null,
      median: null,
      q1: null,
      q3: null,
      percentile: null,
      judgment: { label: '—', color: 'gray' },
      score: 0,
      weight,
      available: false,
      sampleSize: 0,
    }
  }

  const current = pickCurrentValue(series, asOf)
  const values = extractValues(series)
  const sampleSize = values.length

  if (current === null || sampleSize === 0) {
    return {
      metricId,
      current,
      mean: mean(values),
      median: quantile(values, 0.5),
      q1: quantile(values, 0.25),
      q3: quantile(values, 0.75),
      percentile: null,
      judgment: { label: '—', color: 'gray' },
      score: 0,
      weight,
      available: false,
      sampleSize,
    }
  }

  const pct = percentile(values, current)
  const { score, judgment } = judgeMetric(metricId, current, pct)

  return {
    metricId,
    current,
    mean: mean(values),
    median: quantile(values, 0.5),
    q1: quantile(values, 0.25),
    q3: quantile(values, 0.75),
    percentile: pct,
    judgment,
    score,
    weight,
    available: true,
    sampleSize,
  }
}

function totalScoreOf(
  metrics: Partial<Record<MetricId, MetricStats>>,
  weights: Partial<Record<MetricId, number>>,
): number | null {
  let sum = 0
  let wsum = 0
  for (const id of Object.keys(weights) as MetricId[]) {
    const w = weights[id] ?? 0
    const m = metrics[id]
    if (!m || !m.available) continue
    sum += m.score * w
    wsum += w
  }
  if (wsum <= 0) return null
  return sum / wsum
}

function groupWeights(
  weights: Partial<Record<MetricId, number>>,
): { basic: number; composite: number; financial: number } {
  let basic = 0
  let composite = 0
  let financial = 0
  for (const id of Object.keys(weights) as MetricId[]) {
    const w = weights[id] ?? 0
    const g = METRIC_GROUPS[id]
    if (g === 'basic') basic += w
    else if (g === 'composite') composite += w
    else if (g === 'financial') financial += w
  }
  return { basic, composite, financial }
}

export interface ComputeVerdictInput {
  code5: string
  name: string
  asOf: string
  dataPeriod: { from: string; to: string }
  series: MetricSeriesMap
  enabledMetricIds: ReadonlyArray<MetricId>
}

export function computeVerdictResult(input: ComputeVerdictInput): VerdictResult {
  const weights = normalizeWeights(VERDICT_WEIGHTS_BALANCED, input.enabledMetricIds)
  const metrics: Partial<Record<MetricId, MetricStats>> = {}
  for (const id of input.enabledMetricIds) {
    metrics[id] = buildMetricStats(id, input.series[id], input.asOf, weights[id] ?? 0)
  }
  const actual = totalScoreOf(metrics, weights)

  return {
    code: input.code5,
    code4: toCode4(input.code5),
    name: input.name,
    asOf: input.asOf,
    dataPeriod: input.dataPeriod,
    mode: 'balanced',
    weights,
    metrics,
    totalScore: { actual, forecast: null },
    totalJudgment: {
      actual: judgeTotalScore(actual),
      forecast: judgeTotalScore(null),
    },
    groupWeights: groupWeights(weights),
  }
}

// 高レベルエントリーポイント — Phase 1
export async function computeVerdict(
  db: Db,
  code5: string,
  options: ComputeVerdictOptions = {},
): Promise<VerdictResult | null> {
  const stock = await getStockByCode(db, code5)
  if (!stock) return null

  const asOf = options.asOf ?? todayIso()
  const lookback = options.lookbackYears ?? 'auto'
  const years = lookback === 'auto' ? DEFAULT_LOOKBACK_YEARS_FALLBACK : lookback
  const from = startOfLookback(asOf, years)

  const sources = await buildVerdictSources(db, code5, from, asOf)

  // 利用可能な実データ範囲の from / to を抽出
  const firstDate = sources.prices[0]?.date ?? from
  const lastDate = sources.prices[sources.prices.length - 1]?.date ?? asOf
  const effectiveAsOf = lastDate < asOf ? lastDate : asOf

  const series = computePhase1Series(sources)
  const enabledMetricIds = options.enabledMetricIds ?? PHASE1_METRIC_IDS

  return computeVerdictResult({
    code5,
    name: stock.coName,
    asOf: effectiveAsOf,
    dataPeriod: { from: firstDate, to: lastDate },
    series,
    enabledMetricIds,
  })
}
