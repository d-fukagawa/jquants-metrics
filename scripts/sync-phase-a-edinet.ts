/**
 * Phase A0 EDINET DB bridge sync for an explicit, quota-bounded sample.
 *
 * Usage:
 *   DATABASE_URL=... EDINETDB_API_KEY=... TARGET_CODES=70650,62870 \
 *     npx tsx scripts/sync-phase-a-edinet.ts
 */

import { createDb } from '../src/db/client'
import { syncEdinetBridge } from '../src/services/edinetSyncService'

const databaseUrl = process.env.DATABASE_URL
const apiKey = process.env.EDINETDB_API_KEY
const targetCodes = (process.env.TARGET_CODES ?? '')
  .split(',')
  .map(code => code.trim().toUpperCase())
  .filter(Boolean)
const invalidCodes = targetCodes.filter(code => !/^[0-9A-Z]{5}$/.test(code))

if (!databaseUrl || !apiKey || targetCodes.length === 0) {
  console.error('ERROR: DATABASE_URL, EDINETDB_API_KEY, and TARGET_CODES are required')
  process.exit(1)
}
if (invalidCodes.length > 0) {
  console.error(`ERROR: TARGET_CODES must contain 5-character codes: ${invalidCodes.join(',')}`)
  process.exit(1)
}

const sleepMs = Math.max(0, Number(process.env.SLEEP_MS ?? '200') || 200)
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))
const db = createDb(databaseUrl)
let synced = 0
let failures = 0

for (const code of [...new Set(targetCodes)]) {
  try {
    const rows = await syncEdinetBridge(db, apiKey, code)
    synced += rows
    console.log(`[phase-a-edinet] code=${code} rows=${rows}`)
  } catch (error) {
    failures++
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[phase-a-edinet] code=${code} failed=${message}`)
  }
  await sleep(sleepMs)
}

console.log(`[phase-a-edinet] done codes=${targetCodes.length} rows=${synced} failures=${failures}`)
if (failures > 0) process.exitCode = 1
