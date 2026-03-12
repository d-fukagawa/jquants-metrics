/**
 * backfill-prices.ts — 過去の日次株価データを遡って埋める専用スクリプト
 *
 * 実行方法:
 *   DATABASE_URL=... JQUANTS_API_KEY=... npx tsx scripts/backfill-prices.ts
 *
 * 環境変数:
 *   DATABASE_URL        Neon 接続文字列（必須）
 *   JQUANTS_API_KEY     JQuants API キー（必須）
 *   BACKFILL_FROM       取得開始日 YYYY-MM-DD（省略時: 180日前/JST）
 *   BACKFILL_TO         取得終了日 YYYY-MM-DD（省略時: 昨日/JST）
 *   BACKFILL_DAYS       FROM/TO 未指定時に遡る日数（省略時: 180）
 *   INCLUDE_WEEKENDS    true なら土日も取得対象（省略時: false）
 *   RETRY_PER_DATE      日付ごとのリトライ回数（省略時: 3）
 */

import { createDb } from '../src/db/client'
import { syncDailyPricesAll } from '../src/services/syncService'

const databaseUrl = process.env.DATABASE_URL
const apiKey = process.env.JQUANTS_API_KEY

if (!databaseUrl || !apiKey) {
  console.error('ERROR: DATABASE_URL and JQUANTS_API_KEY are required')
  process.exit(1)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function dateInJstParts(base = new Date()): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base)

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error('failed to resolve JST date')
  }
  return { year, month, day }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmtYmd(date: Date): string {
  const { year, month, day } = dateInJstParts(date)
  return `${year}-${month}-${day}`
}

function buildDates(from: string, to: string, includeWeekends: boolean): string[] {
  const out: string[] = []
  const end = new Date(`${to}T00:00:00Z`)
  for (let d = new Date(`${from}T00:00:00Z`); d <= end; d = addDays(d, 1)) {
    if (!includeWeekends) {
      const day = d.getUTCDay()
      if (day === 0 || day === 6) continue
    }
    out.push(fmtYmd(d))
  }
  return out
}

async function runWithRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (e) {
      attempt++
      if (attempt > retries) throw e
      const waitMs = 2000 * attempt
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[backfill] retry=${attempt}/${retries} wait=${waitMs}ms reason=${msg}`)
      await sleep(waitMs)
    }
  }
}

const includeWeekends = (process.env.INCLUDE_WEEKENDS ?? 'false').trim().toLowerCase() === 'true'
const retryPerDateRaw = (process.env.RETRY_PER_DATE ?? '').trim()
const retryPerDate = retryPerDateRaw === '' ? 3 : Number(retryPerDateRaw)
const backfillDaysRaw = (process.env.BACKFILL_DAYS ?? '').trim()
const backfillDays = backfillDaysRaw === ''
  ? 180
  : Math.max(1, Number(backfillDaysRaw) || 180)
const envOrUndef = (name: string): string | undefined => {
  const v = process.env[name]
  if (v == null) return undefined
  const t = v.trim()
  return t === '' ? undefined : t
}

const now = new Date()
const defaultTo = fmtYmd(addDays(now, -1))
const defaultFrom = fmtYmd(addDays(now, -backfillDays))
const from = envOrUndef('BACKFILL_FROM') ?? defaultFrom
const to = envOrUndef('BACKFILL_TO') ?? defaultTo

if (from > to) {
  console.error(`ERROR: BACKFILL_FROM (${from}) must be <= BACKFILL_TO (${to})`)
  process.exit(1)
}

const dates = buildDates(from, to, includeWeekends)
console.log(
  `[backfill] start from=${from} to=${to} dates=${dates.length} includeWeekends=${includeWeekends} retryPerDate=${retryPerDate}`,
)

const db = createDb(databaseUrl)
let totalRows = 0
let nonEmptyDates = 0
let done = 0
for (const date of dates) {
  const n = await runWithRetry(
    () => syncDailyPricesAll(db, apiKey, date),
    Number.isFinite(retryPerDate) && retryPerDate >= 0 ? retryPerDate : 3,
  )
  done++
  totalRows += n
  if (n > 0) nonEmptyDates++
  console.log(`[backfill] ${done}/${dates.length} date=${date} rows=${n} totalRows=${totalRows}`)
  await sleep(1000)
}

console.log(`[backfill] done dates=${dates.length} nonEmptyDates=${nonEmptyDates} totalRows=${totalRows}`)
