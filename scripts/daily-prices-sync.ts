/**
 * daily-prices-sync.ts — 日次株価（+銘柄マスタ）専用同期
 *
 * 実行方法:
 *   DATABASE_URL=... JQUANTS_API_KEY=... npx tsx scripts/daily-prices-sync.ts
 *
 * 環境変数:
 *   DATABASE_URL     Neon 接続文字列（必須）
 *   JQUANTS_API_KEY  JQuants API キー（必須）
 *   SYNC_FROM        株価取得開始日 YYYY-MM-DD（省略時: 当日/JST）
 *   SYNC_TO          株価取得終了日 YYYY-MM-DD（省略時: 当日/JST）
 */

import { createDb } from '../src/db/client'
import { syncStockMaster, syncDailyPricesAll } from '../src/services/syncService'

const databaseUrl = process.env.DATABASE_URL
const apiKey = process.env.JQUANTS_API_KEY

if (!databaseUrl || !apiKey) {
  console.error('ERROR: DATABASE_URL and JQUANTS_API_KEY are required')
  process.exit(1)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const envOrUndef = (name: string): string | undefined => {
  const v = process.env[name]
  if (v == null) return undefined
  const t = v.trim()
  return t === '' ? undefined : t
}

function todayJst(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (!year || !month || !day) throw new Error('failed to resolve JST date')
  return `${year}-${month}-${day}`
}

function datesBetween(from: string, to: string): string[] {
  const dates: string[] = []
  const end = new Date(`${to}T00:00:00Z`)
  for (let d = new Date(`${from}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

const defaultDate = todayJst()
const from = envOrUndef('SYNC_FROM') ?? defaultDate
const to = envOrUndef('SYNC_TO') ?? defaultDate

if (from > to) {
  console.error(`ERROR: SYNC_FROM (${from}) must be <= SYNC_TO (${to})`)
  process.exit(1)
}

console.log(`[price-sync] start from=${from} to=${to}`)

const db = createDb(databaseUrl)

console.log('[price-sync] master: start')
const masterCount = await syncStockMaster(db, apiKey)
console.log(`[price-sync] master: done count=${masterCount}`)
await sleep(1000)

const dates = datesBetween(from, to)
let priceCount = 0
let done = 0
for (const date of dates) {
  const n = await syncDailyPricesAll(db, apiKey, date)
  priceCount += n
  done++
  console.log(`[price-sync] ${done}/${dates.length} date=${date} rows=${n} total=${priceCount}`)
  await sleep(1000)
}

console.log(`[price-sync] done master=${masterCount} prices=${priceCount}`)

