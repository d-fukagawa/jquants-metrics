import { and, asc, eq, gte, lte } from 'drizzle-orm'
import type { Db } from '../db/client'
import { dailyPrices } from '../db/schema'
import type { BuyTimingBar } from '../lib/buyTimingBacktest'

export type BuyTimingPriceQuery = {
  code5: string
  from: string
  to: string
}

export async function listBuyTimingBars(
  db: Db,
  query: BuyTimingPriceQuery,
): Promise<BuyTimingBar[]> {
  const rows = await db
    .select({
      date: dailyPrices.date,
      close: dailyPrices.close,
      adjClose: dailyPrices.adjClose,
    })
    .from(dailyPrices)
    .where(and(
      eq(dailyPrices.code, query.code5),
      gte(dailyPrices.date, query.from),
      lte(dailyPrices.date, query.to),
    ))
    .orderBy(asc(dailyPrices.date))

  return rows.flatMap((row) => {
    const closeRaw = row.adjClose ?? row.close
    const close = closeRaw == null ? null : Number(closeRaw)
    if (close == null || !Number.isFinite(close) || close <= 0) return []
    return [{
      date: String(row.date),
      close,
    }]
  })
}
