import type { Judgment, MetricId, MetricKind, VerdictColor } from './types'
import { METRIC_KINDS } from './types'

// パーセンタイル → スコア (-6 .. +6)
// p=0 (最割安) → +6, p=100 (最割高) → -6
export function scoreLowerBetter(p: number): number {
  return round2(6 - (p / 100) * 12)
}

export function scoreHigherBetter(p: number): number {
  const v = -scoreLowerBetter(p)
  return v === 0 ? 0 : v
}

// パーセンタイル系 (lower_better / higher_better) の判定
export function judgePercentile(p: number, kind: 'lower_better' | 'higher_better'): Judgment {
  // unfavorable: 0 = 最も望ましい, 100 = 最も避けたい
  const unfavorable = kind === 'lower_better' ? p : 100 - p

  if (kind === 'lower_better') {
    if (unfavorable <= 10) return { label: '超割安', color: 'green-strong' }
    if (unfavorable <= 25) return { label: '割安（下位25%）', color: 'green' }
    if (unfavorable <= 50) return { label: 'やや低い', color: 'gray' }
    if (unfavorable <= 75) return { label: '平均超', color: 'gray' }
    if (unfavorable <= 90) return { label: '割高（上位25%超）', color: 'orange' }
    return { label: '歴史的高水準', color: 'red' }
  }

  if (unfavorable <= 10) return { label: '極めて高水準', color: 'green-strong' }
  if (unfavorable <= 25) return { label: '高水準（上位25%）', color: 'green' }
  if (unfavorable <= 50) return { label: 'やや高い', color: 'gray' }
  if (unfavorable <= 75) return { label: '平均未満', color: 'gray' }
  if (unfavorable <= 90) return { label: '低水準', color: 'orange' }
  return { label: '歴史的低水準', color: 'red' }
}

// 配当性向（band 判定）: 30-70%=+1, <30%=0, >70%=-1
export function judgePayoutRatio(value: number): { score: number; judgment: Judgment } {
  if (value < 30) {
    return { score: 0, judgment: { label: '低水準', color: 'gray' } }
  }
  if (value <= 70) {
    return { score: 1, judgment: { label: '健全', color: 'green' } }
  }
  return { score: -1, judgment: { label: '過剰配当', color: 'orange' } }
}

// D/E レシオ（band 判定）: ≤0.5=+2, ≤1.0=0, >1.0=-2
export function judgeDeRatio(value: number): { score: number; judgment: Judgment } {
  if (value <= 0.5) {
    return { score: 2, judgment: { label: '低負債', color: 'green' } }
  }
  if (value <= 1.0) {
    return { score: 0, judgment: { label: '標準', color: 'gray' } }
  }
  return { score: -2, judgment: { label: '高負債', color: 'orange' } }
}

// 指標 + 値 + パーセンタイル → 判定とスコアを返す
export function judgeMetric(
  metricId: MetricId,
  value: number | null,
  percentile: number | null,
): { score: number; judgment: Judgment } {
  if (value === null) {
    return { score: 0, judgment: { label: '—', color: 'gray' } }
  }

  if (metricId === 'payout_ratio') return judgePayoutRatio(value)
  if (metricId === 'de_ratio') return judgeDeRatio(value)

  if (percentile === null) {
    return { score: 0, judgment: { label: '—', color: 'gray' } }
  }

  const kind: MetricKind = METRIC_KINDS[metricId]
  if (kind === 'lower_better') {
    return {
      score: scoreLowerBetter(percentile),
      judgment: judgePercentile(percentile, 'lower_better'),
    }
  }
  if (kind === 'higher_better') {
    return {
      score: scoreHigherBetter(percentile),
      judgment: judgePercentile(percentile, 'higher_better'),
    }
  }
  return { score: 0, judgment: { label: '—', color: 'gray' } }
}

// 総合スコア → ラベル/色
export function judgeTotalScore(score: number | null): Judgment {
  if (score === null) return { label: 'データ不足', color: 'gray' }
  if (score >= 2.0) return { label: '顕著に割安', color: 'green-strong' }
  if (score >= 1.0) return { label: 'やや割安', color: 'green' }
  if (score > -1.0) return { label: '適正水準', color: 'gray' }
  if (score > -2.0) return { label: 'やや割高', color: 'orange' }
  return { label: '顕著に割高', color: 'red' }
}

export function colorClass(color: VerdictColor): string {
  return `verdict-cell--${color}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
