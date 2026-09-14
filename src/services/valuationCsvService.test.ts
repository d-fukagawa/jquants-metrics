import { describe, expect, it } from 'vitest'
import type { ValuationRankingResult } from './valuationService'
import { serializeValuationRankingCsv } from './valuationCsvService'

const result: ValuationRankingResult = {
  date: '2026-08-26',
  rows: [{
    rank: 1,
    code: '72030',
    code4: '7203',
    coName: 'トヨタ自動車',
    market: 'プライム',
    comparisonDate: '2026-07-25',
    epsTtm: 250,
    epsCompanyForecast: 280,
    previousEpsCompanyForecast: 250,
    epsChange: 30,
    epsChangePct: 12,
    perCompanyForecast: 11,
    previousPerCompanyForecast: 12,
    perChangePct: -8.33,
    close: 3080,
    previousClose: 3000,
    priceChangePct: 2.67,
    epsPriceGapPct: 9.33,
    epsPriceGap1mPct: 8.5,
    epsPriceGap3mPct: 15.25,
    forecastVsTtmEpsPct: 12,
    roeTtm: 0.08,
    roeCompanyForecast: 0.09,
    roeImprovementPoint: 1,
    marketCapMillion: 4_500_000,
    hasFinancialDisclosure: true,
    corporateActionSuspected: false,
    judgment: 'EPS上昇・PER低下',
  }],
}

describe('serializeValuationRankingCsv', () => {
  it('writes all comparison windows with an Excel-compatible BOM', () => {
    const csv = serializeValuationRankingCsv(result, '1m')

    expect(csv.startsWith('\uFEFF基準日,比較期間,比較日')).toBe(true)
    expect(csv).toContain(',9.33,8.5,15.25,')
    expect(csv).toContain(',あり,\r\n')
  })

  it('guards spreadsheet formulas in names', () => {
    const csv = serializeValuationRankingCsv({
      ...result,
      rows: [{ ...result.rows[0], coName: '=HYPERLINK("bad")' }],
    }, '3m')

    expect(csv).toContain('"\'=HYPERLINK(""bad"")"')
  })
})
