/**
 * Refresh the J-Quants v2 equity master without running price or financial syncs.
 *
 * Usage:
 *   DATABASE_URL=... JQUANTS_API_KEY=... npm run sync:jquants:master
 */

import { createDb } from '../src/db/client'
import { syncStockMaster } from '../src/services/syncService'

const databaseUrl = process.env.DATABASE_URL
const apiKey = process.env.JQUANTS_API_KEY
if (!databaseUrl || !apiKey) {
  console.error('ERROR: DATABASE_URL and JQUANTS_API_KEY are required')
  process.exit(1)
}

const db = createDb(databaseUrl)
const count = await syncStockMaster(db, apiKey)
console.log(`[jquants-master] done rows=${count}`)
