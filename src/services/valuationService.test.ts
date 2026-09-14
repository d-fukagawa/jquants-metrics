import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/client'
import { listValuationRankings } from './valuationService'

function makeMockDb(rows: unknown[]) {
  const execute = vi.fn().mockResolvedValue({ rows })
  return { db: { execute } as unknown as Db, execute }
}

const baseRow = {
  target_date: '2026-08-26',
  rank: 1,
  code: '72030',
  co_name: 'トヨタ自動車',
  mkt_nm: 'プライム',
  comparison_date: '2026-08-25',
  eps_ttm: '250.5',
  eps_company_forecast: '280',
  previous_eps_company_forecast: '250',
  eps_change: '30',
  eps_change_pct: '12',
  per_company_forecast: '11',
  previous_per_company_forecast: '12',
  per_change_pct: '-8.3333',
  current_close: '3080',
  previous_close: '3000',
  price_change_pct: '2.6667',
  eps_price_gap_pct: '9.3333',
  eps_price_gap_1m_pct: '8.5',
  eps_price_gap_3m_pct: '15.25',
  forecast_vs_ttm_eps_pct: '11.7764',
  roe_ttm: '0.0812',
  roe_company_forecast: '0.0904',
  roe_improvement_point: '0.92',
  market_cap_million: '4500000',
  has_financial_disclosure: true,
  corporate_action_suspected: false,
}

describe('listValuationRankings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('converts numeric values and classifies EPS growth with PER compression', async () => {
    const { db } = makeMockDb([baseRow])

    const result = await listValuationRankings(db)

    expect(result.date).toBe('2026-08-26')
    expect(result.rows[0]).toEqual({
      rank: 1,
      code: '72030',
      code4: '7203',
      coName: 'トヨタ自動車',
      market: 'プライム',
      comparisonDate: '2026-08-25',
      epsTtm: 250.5,
      epsCompanyForecast: 280,
      previousEpsCompanyForecast: 250,
      epsChange: 30,
      epsChangePct: 12,
      perCompanyForecast: 11,
      previousPerCompanyForecast: 12,
      perChangePct: -8.3333,
      close: 3080,
      previousClose: 3000,
      priceChangePct: 2.6667,
      epsPriceGapPct: 9.3333,
      epsPriceGap1mPct: 8.5,
      epsPriceGap3mPct: 15.25,
      forecastVsTtmEpsPct: 11.7764,
      roeTtm: 0.0812,
      roeCompanyForecast: 0.0904,
      roeImprovementPoint: 0.92,
      marketCapMillion: 4500000,
      hasFinancialDisclosure: true,
      corporateActionSuspected: false,
      judgment: 'EPS上昇・PER低下',
    })
  })

  it('marks corporate-action intervals for review and preserves null comparisons', async () => {
    const { db } = makeMockDb([{
      ...baseRow,
      per_company_forecast: null,
      previous_per_company_forecast: null,
      per_change_pct: null,
      current_close: null,
      previous_close: null,
      price_change_pct: null,
      eps_price_gap_pct: null,
      eps_price_gap_1m_pct: null,
      eps_price_gap_3m_pct: null,
      corporate_action_suspected: true,
    }])

    const row = (await listValuationRankings(db)).rows[0]

    expect(row).toMatchObject({
      perCompanyForecast: null,
      perChangePct: null,
      close: null,
      priceChangePct: null,
      corporateActionSuspected: true,
      judgment: '要確認',
    })
  })

  it('returns a selected date with no rows', async () => {
    const { db, execute } = makeMockDb([{ target_date: '2026-08-24', code: null }])

    const result = await listValuationRankings(db, {
      date: '2026-08-24',
      market: 'グロース',
      period: '3m',
      ranking: 'expectation_driven',
      limit: 100,
    })

    expect(result).toEqual({ date: '2026-08-24', rows: [] })
    expect(execute).toHaveBeenCalledOnce()
  })
})
