/**
 * daily-sync.ts — GitHub Actions から実行する日次同期スクリプト
 *
 * 実行方法:
 *   DATABASE_URL=... JQUANTS_API_KEY=... npx tsx scripts/daily-sync.ts
 *
 * 環境変数:
 *   DATABASE_URL     Neon 接続文字列（GitHub Secrets に設定）
 *   JQUANTS_API_KEY  JQuants API キー（GitHub Secrets に設定）
 *   SYNC_FROM        株価取得開始日 YYYY-MM-DD（省略時: 当日/JST）
 *   SYNC_TO          株価取得終了日 YYYY-MM-DD（省略時: 当日/JST）
 */

import { createDb } from '../src/db/client'
import { syncAllStocks } from '../src/services/syncService'

const databaseUrl = process.env.DATABASE_URL
const apiKey      = process.env.JQUANTS_API_KEY

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

  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value

  if (!year || !month || !day) {
    throw new Error('failed to resolve JST date')
  }
  return `${year}-${month}-${day}`
}

const defaultDate = todayJst()
const from = process.env.SYNC_FROM ?? defaultDate
const to   = process.env.SYNC_TO   ?? defaultDate

console.log(`[sync] start  from=${from} to=${to}`)

const db = createDb(databaseUrl)
const result = await syncAllStocks(db, apiKey, from, to)

console.log(`[sync] done  master=${result.masterCount}  prices=${result.priceCount}  fins=${result.finCount}`)
