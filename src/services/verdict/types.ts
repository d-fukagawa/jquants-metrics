// Verdict（バリュエーション判定）— 型定義
// 時系列パーセンタイル + 加重平均でバリュエーションを評価する

export type MetricId =
  | 'net_cash_ratio'
  | 'per_actual'
  | 'per_forecast'
  | 'pbr'
  | 'psr'
  | 'per_pbr'
  | 'per_pbr_psr'
  | 'quad_dividend'
  | 'dividend_yield'
  | 'price_fcf'
  | 'graham_ratio'
  | 'roe'
  | 'payout_ratio'
  | 'de_ratio'
  | 'eps_cagr_3y'

export type MetricKind = 'lower_better' | 'higher_better' | 'band'

export type VerdictColor =
  | 'green-strong'
  | 'green'
  | 'gray'
  | 'orange'
  | 'red'
  | 'red-strong'

export interface Judgment {
  label: string
  color: VerdictColor
}

export interface MetricSeriesPoint {
  date: string
  value: number | null
}

export type MetricSeriesMap = Partial<Record<MetricId, MetricSeriesPoint[]>>

export interface MetricStats {
  metricId: MetricId
  current: number | null
  mean: number | null
  median: number | null
  q1: number | null
  q3: number | null
  percentile: number | null
  judgment: Judgment
  score: number
  weight: number
  available: boolean
  sampleSize: number
}

export interface VerdictResult {
  code: string
  code4: string
  name: string
  asOf: string
  dataPeriod: { from: string; to: string }
  mode: 'balanced'
  weights: Partial<Record<MetricId, number>>
  metrics: Partial<Record<MetricId, MetricStats>>
  totalScore: {
    actual: number | null
    forecast: number | null
  }
  totalJudgment: {
    actual: Judgment
    forecast: Judgment
  }
  groupWeights: {
    basic: number
    composite: number
    financial: number
  }
}

export const METRIC_KINDS: Record<MetricId, MetricKind> = {
  net_cash_ratio: 'higher_better',
  per_actual:     'lower_better',
  per_forecast:   'lower_better',
  pbr:            'lower_better',
  psr:            'lower_better',
  per_pbr:        'lower_better',
  per_pbr_psr:    'lower_better',
  quad_dividend:  'lower_better',
  dividend_yield: 'higher_better',
  price_fcf:      'lower_better',
  graham_ratio:   'lower_better',
  roe:            'higher_better',
  payout_ratio:   'band',
  de_ratio:       'band',
  eps_cagr_3y:    'higher_better',
}

export const METRIC_LABELS: Record<MetricId, string> = {
  net_cash_ratio: 'ネットキャッシュ比率(%)',
  per_actual:     '実績 PER',
  per_forecast:   '予想 PER',
  pbr:            'PBR',
  psr:            'PSR',
  per_pbr:        '予想 PER × PBR',
  per_pbr_psr:    '予想 PER × PBR × PSR',
  quad_dividend:  '(予想 PER×PBR×PSR) ÷ (1+配当×5)',
  dividend_yield: '配当利回り(%, 実績)',
  price_fcf:      '株価 FCF 倍率',
  graham_ratio:   '株価 / Graham 比',
  roe:            'ROE(%)',
  payout_ratio:   '配当性向(%)',
  de_ratio:       'D/E レシオ',
  eps_cagr_3y:    'EPS(TTM) 3年 CAGR(%)',
}

export const METRIC_GROUPS: Record<MetricId, 'basic' | 'composite' | 'financial'> = {
  net_cash_ratio: 'basic',
  per_actual:     'basic',
  per_forecast:   'basic',
  pbr:            'basic',
  psr:            'basic',
  per_pbr:        'composite',
  per_pbr_psr:    'composite',
  quad_dividend:  'composite',
  dividend_yield: 'financial',
  price_fcf:      'financial',
  graham_ratio:   'financial',
  roe:            'financial',
  payout_ratio:   'financial',
  de_ratio:       'financial',
  eps_cagr_3y:    'financial',
}
