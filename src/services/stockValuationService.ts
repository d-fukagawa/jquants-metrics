import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'

export interface StockValuationPoint {
  date: string
  epsTtm: number | null
  epsCompanyForecast: number | null
  previousEpsCompanyForecast: number | null
  bps: number | null
  roeTtm: number | null
  roeCompanyForecast: number | null
  perTtm: number | null
  perCompanyForecast: number | null
  pbr: number | null
  marketCapMillion: number | null
  close: number | null
  epsChangePct: number | null
  relatedDisclosureDate: string | null
  relatedDisclosureType: string | null
  relatedPeriodType: string | null
  corporateActionSuspected: boolean
}

export interface StockValuationAnalysis {
  latest: StockValuationPoint | null
  series: StockValuationPoint[]
  changes: StockValuationPoint[]
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

export async function getStockValuationAnalysis(
  db: Db,
  code: string,
  limit = 90,
): Promise<StockValuationAnalysis> {
  const result = await db.execute(sql`
    SELECT
      valuation.date::text AS date,
      valuation.eps_ttm,
      valuation.eps_company_forecast,
      valuation.bps,
      valuation.roe_ttm,
      valuation.roe_company_forecast,
      valuation.per_ttm,
      valuation.per_company_forecast,
      valuation.pbr,
      valuation.market_cap_million,
      price.adj_close,
      price.adj_factor,
      disclosure.disc_date::text AS latest_disclosure_date,
      disclosure.doc_type AS latest_disclosure_type,
      disclosure.cur_per_type AS latest_period_type
    FROM equity_valuations valuation
    LEFT JOIN daily_prices price
      ON price.code = valuation.code
     AND price.date = valuation.date
    LEFT JOIN LATERAL (
      SELECT
        financial.disc_date,
        financial.doc_type,
        financial.cur_per_type
      FROM financial_summary financial
      WHERE financial.code = valuation.code
        AND financial.disc_date < valuation.date
      ORDER BY financial.disc_date DESC, financial.disc_no DESC
      LIMIT 1
    ) disclosure ON TRUE
    WHERE valuation.code = ${code}
    ORDER BY valuation.date DESC
    LIMIT ${limit}
  `)

  const mapped = (result.rows as Record<string, unknown>[]).map(row => ({
    date: String(row.date),
    epsTtm: toNullableNumber(row.eps_ttm),
    epsCompanyForecast: toNullableNumber(row.eps_company_forecast),
    bps: toNullableNumber(row.bps),
    roeTtm: toNullableNumber(row.roe_ttm),
    roeCompanyForecast: toNullableNumber(row.roe_company_forecast),
    perTtm: toNullableNumber(row.per_ttm),
    perCompanyForecast: toNullableNumber(row.per_company_forecast),
    pbr: toNullableNumber(row.pbr),
    marketCapMillion: toNullableNumber(row.market_cap_million),
    close: toNullableNumber(row.adj_close),
    adjFactor: toNullableNumber(row.adj_factor),
    latestDisclosureDate: row.latest_disclosure_date == null
      ? null
      : String(row.latest_disclosure_date),
    latestDisclosureType: row.latest_disclosure_type == null
      ? null
      : String(row.latest_disclosure_type),
    latestPeriodType: row.latest_period_type == null
      ? null
      : String(row.latest_period_type),
  }))

  const series = mapped.map((row, index): StockValuationPoint => {
    const previous = mapped[index + 1]
    const epsChangePct = row.epsCompanyForecast != null
      && previous?.epsCompanyForecast != null
      && previous.epsCompanyForecast !== 0
      ? (row.epsCompanyForecast / previous.epsCompanyForecast - 1) * 100
      : null
    const hasNewDisclosure = previous != null
      && row.latestDisclosureDate != null
      && row.latestDisclosureDate !== previous?.latestDisclosureDate

    return {
      date: row.date,
      epsTtm: row.epsTtm,
      epsCompanyForecast: row.epsCompanyForecast,
      previousEpsCompanyForecast: previous?.epsCompanyForecast ?? null,
      bps: row.bps,
      roeTtm: row.roeTtm,
      roeCompanyForecast: row.roeCompanyForecast,
      perTtm: row.perTtm,
      perCompanyForecast: row.perCompanyForecast,
      pbr: row.pbr,
      marketCapMillion: row.marketCapMillion,
      close: row.close,
      epsChangePct,
      relatedDisclosureDate: hasNewDisclosure ? row.latestDisclosureDate : null,
      relatedDisclosureType: hasNewDisclosure ? row.latestDisclosureType : null,
      relatedPeriodType: hasNewDisclosure ? row.latestPeriodType : null,
      corporateActionSuspected: row.adjFactor != null && row.adjFactor !== 1,
    }
  })

  return {
    latest: series[0] ?? null,
    series,
    changes: series.filter(row => row.epsChangePct != null || row.relatedDisclosureDate != null).slice(0, 8),
  }
}
