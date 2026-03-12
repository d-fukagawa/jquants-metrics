/**
 * edinet-watch-sync.ts — ウォッチ銘柄向け EDINET 同期
 *
 * モード:
 *   daily  : timeline を先に実行し、変化あり銘柄のみ quality/text/bridge を実行
 *   weekly : ウォッチ銘柄全件に quality/text/bridge を実行
 *
 * 実行方法:
 *   DATABASE_URL=... EDINETDB_API_KEY=... npx tsx scripts/edinet-watch-sync.ts
 *
 * 環境変数:
 *   DATABASE_URL                 必須
 *   EDINETDB_API_KEY             必須
 *   EDINET_SYNC_MODE             daily | weekly（省略時 daily）
 *   WATCHLIST_BOOTSTRAP_CODES    カンマ区切り 4桁英数字コード（省略可）
 *   MAX_CODES_DAILY              daily で対象にする最大銘柄数（省略時 30）
 *   MAX_DEEP_DIVE_DAILY          daily の深掘り最大銘柄数（省略時 8）
 *   MAX_CODES_WEEKLY             weekly で対象にする最大銘柄数（省略時 40）
 *   TIMELINE_LOOKBACK_DAYS       daily timeline 取得の遡り日数（省略時 2）
 *   SLEEP_MS                     API 呼び出し間隔ms（省略時 700）
 */

import { createDb } from '../src/db/client'
import {
  syncEdinetBridge,
  syncEdinetQualityScores,
  syncEdinetTextScores,
  syncEdinetTimeline,
} from '../src/services/edinetSyncService'
import { sql } from 'drizzle-orm'

const databaseUrl = process.env.DATABASE_URL
const apiKey = process.env.EDINETDB_API_KEY
if (!databaseUrl || !apiKey) {
  console.error('ERROR: DATABASE_URL and EDINETDB_API_KEY are required')
  process.exit(1)
}

const mode = (process.env.EDINET_SYNC_MODE ?? 'daily').toLowerCase() === 'weekly' ? 'weekly' : 'daily'
const sleepMs = Math.max(0, Number(process.env.SLEEP_MS ?? '700') || 700)
const maxCodesDaily = Math.max(1, Number(process.env.MAX_CODES_DAILY ?? '30') || 30)
const maxDeepDaily = Math.max(1, Number(process.env.MAX_DEEP_DIVE_DAILY ?? '8') || 8)
const maxCodesWeekly = Math.max(1, Number(process.env.MAX_CODES_WEEKLY ?? '40') || 40)
const lookbackDays = Math.max(1, Number(process.env.TIMELINE_LOOKBACK_DAYS ?? '2') || 2)
const bootstrapCodes = (process.env.WATCHLIST_BOOTSTRAP_CODES ?? '')
  .split(',')
  .map(s => s.trim().toUpperCase())
  .filter(Boolean)
  .filter(s => /^[0-9A-Z]{4}$/.test(s))

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function isoDateJst(deltaDays = 0): string {
  const now = new Date()
  const jst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  jst.setDate(jst.getDate() + deltaDays)
  const y = jst.getFullYear()
  const m = String(jst.getMonth() + 1).padStart(2, '0')
  const d = String(jst.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function main() {
  const db = createDb(databaseUrl)

  for (const c4 of bootstrapCodes) {
    await db.execute(sql`
      INSERT INTO watchlist (code, note, created_at, updated_at)
      VALUES (${`${c4}0`}, 'bootstrap', NOW(), NOW())
      ON CONFLICT (code)
      DO UPDATE SET note = EXCLUDED.note, updated_at = EXCLUDED.updated_at
    `)
  }
  if (bootstrapCodes.length > 0) {
    console.log(`[edinet-watch-sync] bootstrap inserted=${bootstrapCodes.length}`)
  }

  const wl = await db.execute(sql`SELECT code FROM watchlist ORDER BY created_at DESC`)
  const uniqueCodes = [...new Set((wl.rows as Array<{ code: string }>).map(w => w.code))]
  if (uniqueCodes.length === 0) {
    console.log('[edinet-watch-sync] watchlist is empty; nothing to sync')
    return
  }

  console.log(`[edinet-watch-sync] mode=${mode} watchlist=${uniqueCodes.length}`)

  let timelineRows = 0
  let qualityRows = 0
  let textRows = 0
  let bridgeRows = 0

  if (mode === 'daily') {
    const targets = uniqueCodes.slice(0, maxCodesDaily)
    const toDate = isoDateJst(0)
    const fromDate = isoDateJst(-lookbackDays)
    const changed: string[] = []

    for (const code of targets) {
      try {
        const n = await syncEdinetTimeline(db, apiKey, code, fromDate, toDate)
        timelineRows += n
        if (n > 0) changed.push(code)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn(`[edinet-watch-sync] timeline failed code=${code} reason=${msg}`)
      }
      await sleep(sleepMs)
    }

    const deepTargets = changed.slice(0, maxDeepDaily)
    for (const code of deepTargets) {
      try {
        qualityRows += await syncEdinetQualityScores(db, apiKey, code)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn(`[edinet-watch-sync] quality failed code=${code} reason=${msg}`)
      }
      await sleep(sleepMs)
      try {
        textRows += await syncEdinetTextScores(db, apiKey, code)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn(`[edinet-watch-sync] text failed code=${code} reason=${msg}`)
      }
      await sleep(sleepMs)
      try {
        bridgeRows += await syncEdinetBridge(db, apiKey, code)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.warn(`[edinet-watch-sync] bridge failed code=${code} reason=${msg}`)
      }
      await sleep(sleepMs)
    }

    console.log(
      `[edinet-watch-sync] daily done targets=${targets.length} changed=${changed.length} deepTargets=${deepTargets.length} timeline=${timelineRows} quality=${qualityRows} text=${textRows} bridge=${bridgeRows}`,
    )
    return
  }

  const targets = uniqueCodes.slice(0, maxCodesWeekly)
  for (const code of targets) {
    try {
      qualityRows += await syncEdinetQualityScores(db, apiKey, code)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[edinet-watch-sync] quality failed code=${code} reason=${msg}`)
    }
    await sleep(sleepMs)
    try {
      textRows += await syncEdinetTextScores(db, apiKey, code)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[edinet-watch-sync] text failed code=${code} reason=${msg}`)
    }
    await sleep(sleepMs)
    try {
      bridgeRows += await syncEdinetBridge(db, apiKey, code)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.warn(`[edinet-watch-sync] bridge failed code=${code} reason=${msg}`)
    }
    await sleep(sleepMs)
  }

  console.log(
    `[edinet-watch-sync] weekly done targets=${targets.length} quality=${qualityRows} text=${textRows} bridge=${bridgeRows}`,
  )
}

await main()
