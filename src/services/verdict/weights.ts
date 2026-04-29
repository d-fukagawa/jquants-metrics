import type { MetricId } from './types'

// 重み配分（バランス型）— 合計 1.0
export const VERDICT_WEIGHTS_BALANCED: Record<MetricId, number> = {
  net_cash_ratio: 0.044,
  per_actual:     0.132,
  per_forecast:   0.132,
  pbr:            0.105,
  psr:            0.070,
  per_pbr:        0.070,
  per_pbr_psr:    0.070,
  quad_dividend:  0.070,
  dividend_yield: 0.070,
  price_fcf:      0.070,
  graham_ratio:   0.088,
  roe:            0.070,
  payout_ratio:   0.026,
  de_ratio:       0.044,
  eps_cagr_3y:    0.070,
}

// Phase 1（MVP）で利用可能な ✅ 完全データ指標
export const PHASE1_METRIC_IDS: ReadonlyArray<MetricId> = [
  'per_actual',
  'pbr',
  'psr',
  'dividend_yield',
  'roe',
  'payout_ratio',
  'graham_ratio',
  'eps_cagr_3y',
]

// 利用可能な指標群で重みを再正規化して合計 1.0 にする
export function normalizeWeights(
  weights: Record<MetricId, number>,
  enabledIds: ReadonlyArray<MetricId>,
): Partial<Record<MetricId, number>> {
  const filtered: Partial<Record<MetricId, number>> = {}
  let sum = 0
  for (const id of enabledIds) {
    const w = weights[id]
    if (w === undefined || w <= 0) continue
    filtered[id] = w
    sum += w
  }
  if (sum <= 0) return {}
  for (const id of Object.keys(filtered) as MetricId[]) {
    filtered[id] = filtered[id]! / sum
  }
  return filtered
}
