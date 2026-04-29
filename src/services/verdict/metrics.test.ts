import { describe, expect, it } from 'vitest'
import {
  bpsFallback,
  computePhase1Series,
  computePhase1Values,
  findFinancialAsOf,
  findFinancialThreeYearsAgo,
} from './metrics'
import type { FinancialPoint } from './series'

const fy = (overrides: Partial<FinancialPoint> = {}): FinancialPoint => ({
  discDate: '2024-05-15',
  curPerType: 'FY',
  eps: 100,
  bps: 1000,
  sales: 5_000_000_000,
  np: 500_000_000,
  equity: 4_000_000_000,
  divAnn: 50,
  shOutFy: 50_000_000,
  trShFy: 0,
  ...overrides,
})

describe('bpsFallback', () => {
  it('returns the BPS when present and positive', () => {
    expect(bpsFallback(fy({ bps: 1234 }))).toBe(1234)
  })

  it('falls back to equity / (shOut - trSh) when BPS is null', () => {
    const f = fy({ bps: null, equity: 1000, shOutFy: 100, trShFy: 10 })
    expect(bpsFallback(f)).toBe(1000 / 90)
  })

  it('returns null when no fallback is possible', () => {
    expect(bpsFallback(fy({ bps: null, equity: null }))).toBeNull()
  })
})

describe('findFinancialAsOf', () => {
  const f1 = fy({ discDate: '2020-05-01' })
  const f2 = fy({ discDate: '2021-05-01' })
  const f3 = fy({ discDate: '2022-05-01' })
  const arr = [f1, f2, f3]

  it('returns the latest financial with discDate <= asOf', () => {
    expect(findFinancialAsOf(arr, '2021-12-31')?.discDate).toBe('2021-05-01')
  })

  it('returns null when no financial exists by asOf', () => {
    expect(findFinancialAsOf(arr, '2019-01-01')).toBeNull()
  })

  it('does not look ahead', () => {
    expect(findFinancialAsOf(arr, '2020-04-30')).toBeNull()
  })
})

describe('findFinancialThreeYearsAgo', () => {
  it('returns the FY closest to 3 years before base', () => {
    const arr = [
      fy({ discDate: '2018-05-01', eps: 50 }),
      fy({ discDate: '2021-05-01', eps: 80 }),
      fy({ discDate: '2024-05-01', eps: 100 }),
    ]
    const base = arr[2]
    const r = findFinancialThreeYearsAgo(arr, base)
    expect(r?.discDate).toBe('2021-05-01')
  })

  it('returns null when no prior FY', () => {
    const arr = [fy({ discDate: '2024-05-01' })]
    expect(findFinancialThreeYearsAgo(arr, arr[0])).toBeNull()
  })
})

describe('computePhase1Values', () => {
  it('computes PER, PBR, PSR, dividend yield, ROE, payout ratio, Graham, EPS CAGR', () => {
    const f = fy({ eps: 100, bps: 1000, sales: 1_000_000_000, np: 500_000_000, equity: 4_000_000_000, divAnn: 30, shOutFy: 50_000_000, trShFy: 0 })
    const f3y = fy({ discDate: '2021-05-15', eps: 80 })
    const v = computePhase1Values({ close: 1500, financial: f, threeYearAgo: f3y })

    // PER = 1500 / 100 = 15
    expect(v.per_actual).toBe(15)
    // PBR = 1500 / 1000 = 1.5
    expect(v.pbr).toBe(1.5)
    // PSR = (1500 * 50,000,000) / 1,000,000,000 = 75
    expect(v.psr).toBe(75)
    // Dividend yield = 30 / 1500 * 100 = 2.0
    expect(v.dividend_yield).toBeCloseTo(2.0, 5)
    // ROE = 500M / 4B * 100 = 12.5
    expect(v.roe).toBeCloseTo(12.5, 5)
    // Payout = 30 / 100 * 100 = 30
    expect(v.payout_ratio).toBe(30)
    // Graham = 1500 / sqrt(22.5 * 100 * 1000) = 1500 / sqrt(2,250,000)
    expect(v.graham_ratio).toBeCloseTo(1500 / Math.sqrt(22.5 * 100 * 1000), 5)
    // EPS CAGR = (100/80)^(1/3) - 1 ≈ 0.0772 → 7.72%
    expect(v.eps_cagr_3y).toBeCloseTo((Math.pow(100 / 80, 1 / 3) - 1) * 100, 4)
  })

  it('returns null PER when EPS is non-positive', () => {
    const v = computePhase1Values({ close: 1500, financial: fy({ eps: 0 }), threeYearAgo: null })
    expect(v.per_actual).toBeNull()
  })

  it('returns null EPS CAGR when 3-year-ago EPS missing', () => {
    const v = computePhase1Values({ close: 1500, financial: fy({ eps: 100 }), threeYearAgo: null })
    expect(v.eps_cagr_3y).toBeNull()
  })
})

describe('computePhase1Series', () => {
  it('produces one series per Phase 1 metric across price dates', () => {
    const f = fy({ discDate: '2020-05-01', eps: 100, bps: 1000 })
    const f3y = fy({ discDate: '2017-05-01', eps: 80 })
    const series = computePhase1Series({
      prices: [
        { date: '2020-06-01', close: 1000 },
        { date: '2020-07-01', close: 1500 },
        { date: '2020-08-01', close: 2000 },
      ],
      financials: [f3y, f],
    })
    expect(series.per_actual?.length).toBe(3)
    expect(series.per_actual?.[0]).toEqual({ date: '2020-06-01', value: 10 })
    expect(series.per_actual?.[2]).toEqual({ date: '2020-08-01', value: 20 })
  })

  it('emits null values when no financial is available yet (no lookahead)', () => {
    const f = fy({ discDate: '2024-05-01', eps: 100, bps: 1000 })
    const series = computePhase1Series({
      prices: [
        { date: '2024-04-30', close: 1000 },  // before disclosure
        { date: '2024-05-01', close: 1100 },  // on disclosure
      ],
      financials: [f],
    })
    expect(series.per_actual?.[0].value).toBeNull()
    expect(series.per_actual?.[1].value).toBe(11)
  })
})
