/**
 * Phase A0 financial_summary backfill by disclosure date.
 *
 * Existing disclosure dates are loaded from the DB. Calendar dates from the
 * latest stored disclosure through today are also requested so recent rows are
 * not omitted. Writes use the same idempotent upsert as the per-company sync.
 */

import { sql } from 'drizzle-orm'
import { createDb } from '../src/db/client'
import { syncFinancialSummaryByDate } from '../src/services/syncService'

const databaseUrl = process.env.DATABASE_URL
const apiKey = process.env.JQUANTS_API_KEY
if (!databaseUrl || !apiKey) {
  console.error('ERROR: DATABASE_URL and JQUANTS_API_KEY are required')
  process.exit(1)
}

const requestedSleepMs = Math.max(0, Number(process.env.SLEEP_MS ?? '1000') || 1000)
const rateLimitPerMin = Math.max(1, Number(process.env.RATE_LIMIT_PER_MIN ?? '60') || 60)
const sleepMs = Math.max(requestedSleepMs, Math.ceil(60000 / rateLimitPerMin))
const retryPerDate = Math.max(0, Number(process.env.RETRY_PER_DATE ?? '2') || 2)
const shards = Math.max(1, Number(process.env.SHARDS ?? '1') || 1)
const shard = Math.min(shards - 1, Math.max(0, Number(process.env.SHARD ?? '0') || 0))
const fromDate = process.env.FROM_DATE?.trim() || null
const todayJst = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())
const toDate = process.env.TO_DATE?.trim() || todayJst
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function eachDate(from: string, to: string): string[] {
  const dates: string[] = []
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

async function withRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error) {
      attempt++
      const message = error instanceof Error ? error.message : String(error)
      const nonRetryableClientError = /API error 4\d\d/.test(message) && !message.includes('API error 429')
      if (attempt > retries || nonRetryableClientError) throw error
      const waitMs = attempt * 2000
      console.warn(`[phase-a-backfill] retry=${attempt}/${retries} wait=${waitMs}ms reason=${message}`)
      await sleep(waitMs)
    }
  }
}

const db = createDb(databaseUrl)
const storedResult = await db.execute(sql`
  SELECT DISTINCT disc_date
  FROM financial_summary
  WHERE disc_date IS NOT NULL
  ORDER BY disc_date
`)
const storedDates = (storedResult.rows as Array<{ disc_date: string }>)
  .map(row => row.disc_date)
  .filter(Boolean)
const latestStoredDate = storedDates.at(-1) ?? toDate
const eligibleDates = [...new Set([
  ...storedDates,
  ...eachDate(latestStoredDate, toDate),
])]
  .filter(date => (!fromDate || date >= fromDate) && date <= toDate)
  .sort()
const allDates = eligibleDates.filter((_, index) => index % shards === shard)

let syncedRows = 0
const failedDates: string[] = []
console.log(
  `[phase-a-backfill] start shard=${shard}/${shards} dates=${allDates.length}`
  + ` from=${allDates[0] ?? '-'} to=${allDates.at(-1) ?? '-'} sleepMs=${sleepMs}`,
)

for (let index = 0; index < allDates.length; index++) {
  const date = allDates[index]
  if (!date) continue
  try {
    syncedRows += await withRetry(() => syncFinancialSummaryByDate(db, apiKey, date), retryPerDate)
  } catch (error) {
    failedDates.push(date)
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[phase-a-backfill] date=${date} failed=${message}`)
  }
  await sleep(sleepMs)

  const done = index + 1
  if (done % 50 === 0 || done === allDates.length) {
    console.log(
      `[phase-a-backfill] progress=${done}/${allDates.length} date=${date}`
      + ` rows=${syncedRows} failed=${failedDates.length}`,
    )
  }
}

console.log(`[phase-a-backfill] done shard=${shard}/${shards} dates=${allDates.length} rows=${syncedRows} failed=${failedDates.length}`)
if (failedDates.length > 0) {
  console.error(`[phase-a-backfill] failed_dates=${failedDates.join(',')}`)
  process.exitCode = 1
}
