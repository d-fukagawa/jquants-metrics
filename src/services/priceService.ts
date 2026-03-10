import { desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { dailyPrices } from '../db/schema'

// 直近 limit 日分の日足株価を新しい順で返す
export async function getRecentPrices(db: Db, code5: string, limit = 60) {
  return db
    .select()
    .from(dailyPrices)
    .where(eq(dailyPrices.code, code5))
    .orderBy(desc(dailyPrices.date))
    .limit(limit)
}
