/**
 * 日次バリュエーション指標を全銘柄分同期する。
 *
 * 環境変数:
 *   DATABASE_URL     Neon 接続文字列（必須）
 *   JQUANTS_API_KEY  J-Quants API キー（必須）
 *   SYNC_DATE        対象日 YYYY-MM-DD（省略時: 当日/JST）
 */

import { createDb } from '../src/db/client'
import { syncEquityValuationsByDate } from '../src/services/valuationSyncService'

const databaseUrl = process.env.DATABASE_URL
const apiKey = process.env.JQUANTS_API_KEY

if (!databaseUrl || !apiKey) {
  console.error('ERROR: DATABASE_URL and JQUANTS_API_KEY are required')
  process.exit(1)
}

function todayJst(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find(part => part.type === 'year')?.value
  const month = parts.find(part => part.type === 'month')?.value
  const day = parts.find(part => part.type === 'day')?.value
  if (!year || !month || !day) throw new Error('failed to resolve JST date')
  return `${year}-${month}-${day}`
}

const date = process.env.SYNC_DATE?.trim() || todayJst()
const parsedDate = new Date(`${date}T00:00:00Z`)
if (
  !/^\d{4}-\d{2}-\d{2}$/.test(date)
  || Number.isNaN(parsedDate.getTime())
  || parsedDate.toISOString().slice(0, 10) !== date
) {
  console.error(`ERROR: SYNC_DATE must be YYYY-MM-DD: ${date}`)
  process.exit(1)
}

console.log(`[valuation-sync] start date=${date}`)
const count = await syncEquityValuationsByDate(createDb(databaseUrl), apiKey, date)
console.log(`[valuation-sync] done date=${date} rows=${count}`)
