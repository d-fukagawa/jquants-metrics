import { renderToString } from 'hono/jsx/dom/server'
import { describe, expect, it } from 'vitest'
import type { StockValuationPoint } from '../services/stockValuationService'
import { buildIndexedValuationSeries, ValuationTrendChart } from './ValuationTrendChart'

function point(
  date: string,
  close: number | null,
  epsCompanyForecast: number | null,
  perCompanyForecast: number | null,
): StockValuationPoint {
  return {
    date,
    close,
    epsCompanyForecast,
    perCompanyForecast,
    previousEpsCompanyForecast: null,
    epsTtm: null,
    bps: null,
    roeTtm: null,
    roeCompanyForecast: null,
    perTtm: null,
    pbr: null,
    marketCapMillion: null,
    epsChangePct: null,
    relatedDisclosureDate: null,
    relatedDisclosureType: null,
    relatedPeriodType: null,
    corporateActionSuspected: false,
  }
}

describe('ValuationTrendChart', () => {
  const rows = [
    point('2026-08-26', 110, 12, 18),
    point('2026-08-25', 100, 10, 20),
  ]

  it('indexes each positive series from its first value', () => {
    const indexed = buildIndexedValuationSeries(rows)

    expect(indexed.close[0].value).toBe(100)
    expect(indexed.close[1].value).toBeCloseTo(110)
    expect(indexed.epsCompanyForecast.map(row => row.value)).toEqual([100, 120])
    expect(indexed.perCompanyForecast.map(row => row.value)).toEqual([100, 90])
  })

  it('renders three labeled lines', () => {
    const html = renderToString(<ValuationTrendChart rows={rows} />)

    expect(html).toContain('指数化チャート')
    expect(html).toContain('会社予想EPS')
    expect(html).toContain('会社予想PER')
    expect(html).toContain('valuation-line-close')
    expect(html).toContain('valuation-line-eps')
    expect(html).toContain('valuation-line-per')
  })

  it('renders an empty state when positive values are insufficient', () => {
    const html = renderToString(<ValuationTrendChart rows={[point('2026-08-26', null, -10, null)]} />)
    expect(html).toContain('2日以上の正の値')
  })
})
