/**
 * backfill-financials.ts — financial_summary / fins_details バックフィル
 *
 * 実行方法:
 *   DATABASE_URL=... JQUANTS_API_KEY=... npx tsx scripts/backfill-financials.ts
 *
 * 環境変数:
 *   DATABASE_URL      Neon 接続文字列（必須）
 *   JQUANTS_API_KEY   JQuants API キー（必須）
 *   SHARD             現在のシャード番号（省略時: 0）
 *   SHARDS            総シャード数（省略時: 1）
 *   SLEEP_MS          銘柄ごとの待機ms（省略時: 1000）
 *   RETRY_PER_CODE    銘柄ごとのリトライ回数（省略時: 2）
 *   INCLUDE_DETAILS   true のとき fins_details も同期（省略時: true）
 *   RATE_LIMIT_PER_MIN 契約プランの上限 req/min（省略時: 60）
 */

import { createDb } from '../src/db/client'
import { stockMaster } from '../src/db/schema'
import { syncFinancialSummary, syncFinsDetails } from '../src/services/syncService'

const databaseUrl = process.env.DATABASE_URL
const apiKey = process.env.JQUANTS_API_KEY
if (!databaseUrl || !apiKey) {
  console.error('ERROR: DATABASE_URL and JQUANTS_API_KEY are required')
  process.exit(1)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const requestedSleepMs = Math.max(0, Number(process.env.SLEEP_MS ?? '1000') || 1000)
const rateLimitPerMin = Math.max(1, Number(process.env.RATE_LIMIT_PER_MIN ?? '60') || 60)
const minIntervalMs = Math.ceil(60000 / rateLimitPerMin)
const sleepMs = Math.max(requestedSleepMs, minIntervalMs)
const retryPerCode = Math.max(0, Number(process.env.RETRY_PER_CODE ?? '2') || 2)
const shards = Math.max(1, Number(process.env.SHARDS ?? '1') || 1)
const shard = Math.min(shards - 1, Math.max(0, Number(process.env.SHARD ?? '0') || 0))
let includeDetails = (process.env.INCLUDE_DETAILS ?? 'true').toLowerCase() === 'true'

function isSubscriptionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes('not available on your subscription')
}

async function withRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (e) {
      attempt++
      if (attempt > retries) throw e
      const waitMs = 2000 * attempt
      const message = e instanceof Error ? e.message : String(e)
      console.warn(`[fin-backfill] retry=${attempt}/${retries} wait=${waitMs}ms reason=${message}`)
      await sleep(waitMs)
    }
  }
}

const db = createDb(databaseUrl)
const stocks = await db.select({ code: stockMaster.code }).from(stockMaster)
const target = stocks.filter((_, i) => i % shards === shard)

console.log(
  `[fin-backfill] start shard=${shard}/${shards} target=${target.length} total=${stocks.length} sleepMs=${sleepMs} rateLimitPerMin=${rateLimitPerMin} retry=${retryPerCode} includeDetails=${includeDetails}`,
)

let finCount = 0
let detailsCount = 0
let done = 0
for (const { code } of target) {
  const nFin = await withRetry(() => syncFinancialSummary(db, apiKey, code), retryPerCode)
  finCount += nFin
  await sleep(sleepMs)

  if (includeDetails) {
    try {
      const nDetails = await withRetry(() => syncFinsDetails(db, apiKey, code), retryPerCode)
      detailsCount += nDetails
    } catch (e) {
      if (isSubscriptionError(e)) {
        includeDetails = false
        const message = e instanceof Error ? e.message : String(e)
        console.warn(`[fin-backfill] details disabled: ${message}`)
      } else {
        throw e
      }
    }
    await sleep(sleepMs)
  }
  done++

  if (done % 50 === 0 || done === target.length) {
    console.log(`[fin-backfill] progress ${done}/${target.length} code=${code} fins=${finCount} details=${detailsCount}`)
  }
}

console.log(`[fin-backfill] done shard=${shard}/${shards} processed=${done} finRows=${finCount} detailRows=${detailsCount} includeDetails=${includeDetails}`)
