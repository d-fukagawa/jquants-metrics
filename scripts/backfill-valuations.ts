/**
 * 日次バリュエーション指標を日付単位でバックフィルする。
 *
 * 環境変数:
 *   DATABASE_URL       Neon 接続文字列（必須）
 *   JQUANTS_API_KEY    J-Quants API キー（必須）
 *   BACKFILL_FROM      開始日 YYYY-MM-DD（省略時: 90日前/JST）
 *   BACKFILL_TO        終了日 YYYY-MM-DD（省略時: 昨日/JST）
 *   BACKFILL_DAYS      FROM/TO 未指定時に遡る日数（省略時: 90）
 *   RETRY_PER_DATE     日付ごとのリトライ回数（省略時: 3）
 */

import { createDb } from '../src/db/client'
import { syncEquityValuationsByDate } from '../src/services/valuationSyncService'

const databaseUrl = process.env.DATABASE_URL
const apiKey = process.env.JQUANTS_API_KEY

if (!databaseUrl || !apiKey) {
  console.error('ERROR: DATABASE_URL and JQUANTS_API_KEY are required')
  process.exit(1)
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function ymdInJst(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  if (!year || !month || !day) throw new Error('failed to resolve JST date')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function weekdaysBetween(from: string, to: string): string[] {
  const dates: string[] = []
  const end = new Date(`${to}T00:00:00Z`)
  for (let date = new Date(`${from}T00:00:00Z`); date <= end; date = addDays(date, 1)) {
    const day = date.getUTCDay()
    if (day !== 0 && day !== 6) dates.push(date.toISOString().slice(0, 10))
  }
  return dates
}

async function runWithRetry<T>(operation: () => Promise<T>, retries: number): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await operation()
    } catch (error) {
      attempt++
      if (attempt > retries) throw error
      const waitMs = attempt * 2_000
      const reason = error instanceof Error ? error.message : String(error)
      console.warn(`[valuation-backfill] retry=${attempt}/${retries} wait=${waitMs}ms reason=${reason}`)
      await sleep(waitMs)
    }
  }
}

const rawDays = Number(process.env.BACKFILL_DAYS?.trim() || '90')
const backfillDays = Number.isFinite(rawDays) && rawDays > 0 ? Math.floor(rawDays) : 90
const rawRetries = Number(process.env.RETRY_PER_DATE?.trim() || '3')
const retries = Number.isFinite(rawRetries) && rawRetries >= 0 ? Math.floor(rawRetries) : 3
const now = new Date()
const defaultTo = ymdInJst(addDays(now, -1))
const defaultFrom = ymdInJst(addDays(now, -backfillDays))
const from = process.env.BACKFILL_FROM?.trim() || defaultFrom
const to = process.env.BACKFILL_TO?.trim() || defaultTo

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

if (!isIsoDate(from) || !isIsoDate(to)) {
  console.error('ERROR: BACKFILL_FROM and BACKFILL_TO must be YYYY-MM-DD')
  process.exit(1)
}
if (from > to) {
  console.error(`ERROR: BACKFILL_FROM (${from}) must be <= BACKFILL_TO (${to})`)
  process.exit(1)
}

const dates = weekdaysBetween(from, to)
const db = createDb(databaseUrl)
let totalRows = 0
let nonEmptyDates = 0

console.log(`[valuation-backfill] start from=${from} to=${to} dates=${dates.length} retries=${retries}`)
for (const [index, date] of dates.entries()) {
  const count = await runWithRetry(
    () => syncEquityValuationsByDate(db, apiKey, date),
    retries,
  )
  totalRows += count
  if (count > 0) nonEmptyDates++
  console.log(`[valuation-backfill] ${index + 1}/${dates.length} date=${date} rows=${count} total=${totalRows}`)
  await sleep(1_100)
}
console.log(`[valuation-backfill] done dates=${dates.length} nonEmptyDates=${nonEmptyDates} rows=${totalRows}`)
