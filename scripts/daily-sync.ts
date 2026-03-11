/**
 * daily-sync.ts — GitHub Actions から実行する日次同期スクリプト
 *
 * 実行方法:
 *   DATABASE_URL=... JQUANTS_API_KEY=... npx tsx scripts/daily-sync.ts
 *
 * 環境変数:
 *   DATABASE_URL     Neon 接続文字列（GitHub Secrets に設定）
 *   JQUANTS_API_KEY  JQuants API キー（GitHub Secrets に設定）
 *   SYNC_FROM        株価取得開始日 YYYY-MM-DD（省略時: 前日）
 *   SYNC_TO          株価取得終了日 YYYY-MM-DD（省略時: 前日）
 */

import { createDb } from '../src/db/client'
import { syncAllStocks } from '../src/services/syncService'

const databaseUrl = process.env.DATABASE_URL
const apiKey      = process.env.JQUANTS_API_KEY

if (!databaseUrl || !apiKey) {
  console.error('ERROR: DATABASE_URL and JQUANTS_API_KEY are required')
  process.exit(1)
}

function yesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

const from = process.env.SYNC_FROM ?? yesterday()
const to   = process.env.SYNC_TO   ?? yesterday()

console.log(`[sync] start  from=${from} to=${to}`)

const db = createDb(databaseUrl)
const result = await syncAllStocks(db, apiKey, from, to)

console.log(`[sync] done  master=${result.masterCount}  prices=${result.priceCount}  fins=${result.finCount}`)
