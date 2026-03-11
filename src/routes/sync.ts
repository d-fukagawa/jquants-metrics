import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import { syncStockMaster, syncDailyPrices, syncFinancialSummary } from '../services/syncService'

type SyncBody =
  | { target: 'master' }
  | { target: 'prices';     code: string; from?: string; to?: string }
  | { target: 'financials'; code: string }

const CODE_RE = /^\d{4}$/

export const syncRoute = new Hono<{ Bindings: Bindings }>()

syncRoute.post('/', async (c) => {
  // シークレット認証
  const secret = c.req.header('X-Sync-Secret')
  if (!c.env.SYNC_SECRET || secret !== c.env.SYNC_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  let body: SyncBody
  try {
    body = await c.req.json<SyncBody>()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const db     = createDb(c.env.DATABASE_URL)
  const apiKey = c.env.JQUANTS_API_KEY

  try {
    switch (body.target) {
      case 'master': {
        const synced = await syncStockMaster(db, apiKey)
        return c.json({ ok: true, target: 'master', synced })
      }
      case 'prices': {
        if (!CODE_RE.test(body.code ?? '')) return c.json({ error: 'code must be a 4-digit number' }, 400)
        const from = body.from ?? '2023-11-29'
        const to   = body.to   ?? '2025-11-29'
        const synced = await syncDailyPrices(db, apiKey, body.code, from, to)
        return c.json({ ok: true, target: 'prices', code: body.code, synced })
      }
      case 'financials': {
        if (!CODE_RE.test(body.code ?? '')) return c.json({ error: 'code must be a 4-digit number' }, 400)
        const synced = await syncFinancialSummary(db, apiKey, body.code)
        return c.json({ ok: true, target: 'financials', code: body.code, synced })
      }
      default:
        return c.json({ error: 'invalid target' }, 400)
    }
  } catch (err) {
    const raw     = err instanceof Error ? err.message : String(err)
    const message = raw.includes('postgresql://') ? 'Database error' : raw
    return c.json({ ok: false, error: message }, 500)
  }
})
