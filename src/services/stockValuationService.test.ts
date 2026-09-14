import { describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/client'
import { getStockValuationAnalysis } from './stockValuationService'

describe('getStockValuationAnalysis', () => {
  it('maps official values and relates the first valuation after a disclosure', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [
      {
        date: '2026-08-26',
        eps_ttm: '250',
        eps_company_forecast: '280',
        bps: '3100',
        roe_ttm: '0.08',
        roe_company_forecast: '0.09',
        per_ttm: '12.5',
        per_company_forecast: '11',
        pbr: '1.1',
        market_cap_million: '4500000',
        adj_close: '3080',
        adj_factor: '1',
        latest_disclosure_date: '2026-08-25',
        latest_disclosure_type: '2QFinancialStatements',
        latest_period_type: '2Q',
      },
      {
        date: '2026-08-25',
        eps_ttm: '245',
        eps_company_forecast: '250',
        bps: '3050',
        roe_ttm: '0.079',
        roe_company_forecast: '0.082',
        per_ttm: '12.7',
        per_company_forecast: '12',
        pbr: '1.08',
        market_cap_million: '4400000',
        adj_close: '3000',
        adj_factor: '1',
        latest_disclosure_date: '2026-05-10',
        latest_disclosure_type: 'FYFinancialStatements',
        latest_period_type: 'FY',
      },
    ] })
    const db = { execute } as unknown as Db

    const analysis = await getStockValuationAnalysis(db, '72030')

    expect(analysis.latest).toMatchObject({
      date: '2026-08-26',
      epsTtm: 250,
      epsCompanyForecast: 280,
      previousEpsCompanyForecast: 250,
      relatedDisclosureDate: '2026-08-25',
      relatedPeriodType: '2Q',
      marketCapMillion: 4500000,
    })
    expect(analysis.latest?.epsChangePct).toBeCloseTo(12)
    expect(analysis.changes).toHaveLength(1)
  })

  it('keeps nulls and flags corporate actions without inventing a percentage', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{
      date: '2026-08-26',
      eps_company_forecast: null,
      adj_factor: '0.5',
    }] })
    const db = { execute } as unknown as Db

    const analysis = await getStockValuationAnalysis(db, '72030')

    expect(analysis.latest).toMatchObject({
      epsCompanyForecast: null,
      epsChangePct: null,
      corporateActionSuspected: true,
      relatedDisclosureDate: null,
    })
    expect(analysis.changes).toEqual([])
  })
})
