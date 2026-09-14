import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { equityValuations } from '../db/schema'
import { fetchEquityValuationsByDate } from '../jquants/client'
import type { EquityValuation } from '../jquants/types'

const BATCH_SIZE = 500

function toNumeric(value: number | null): string | null {
  return value == null ? null : String(value)
}

export function mapEquityValuation(row: EquityValuation) {
  return {
    code: row.Code,
    date: row.Date,
    epsTtm: toNumeric(row.EPS),
    epsCompanyForecast: toNumeric(row.FwdEPS),
    bps: toNumeric(row.BPS),
    roeTtm: toNumeric(row.ROE),
    roeCompanyForecast: toNumeric(row.FwdROE),
    perTtm: toNumeric(row.PER),
    perCompanyForecast: toNumeric(row.FwdPER),
    pbr: toNumeric(row.PBR),
    marketCapMillion: toNumeric(row.MktCap),
  }
}

export async function syncEquityValuationsByDate(
  db: Db,
  apiKey: string,
  date: string,
): Promise<number> {
  const rows = await fetchEquityValuationsByDate(apiKey, date)

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE).map(mapEquityValuation)
    await db.insert(equityValuations)
      .values(batch)
      .onConflictDoUpdate({
        target: [equityValuations.code, equityValuations.date],
        set: {
          epsTtm: sql`excluded.eps_ttm`,
          epsCompanyForecast: sql`excluded.eps_company_forecast`,
          bps: sql`excluded.bps`,
          roeTtm: sql`excluded.roe_ttm`,
          roeCompanyForecast: sql`excluded.roe_company_forecast`,
          perTtm: sql`excluded.per_ttm`,
          perCompanyForecast: sql`excluded.per_company_forecast`,
          pbr: sql`excluded.pbr`,
          marketCapMillion: sql`excluded.market_cap_million`,
        },
      })
  }

  return rows.length
}
