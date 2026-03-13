import { Hono, type Context } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import {
  DEFAULT_PRICE_SYNC_FROM,
  DEFAULT_PRICE_SYNC_TO,
  syncStockMaster,
  syncDailyPrices,
  syncFinancialSummary,
  syncFinsDetails,
  syncFinsDetailsFromEdinet,
} from '../services/syncService'
import {
  syncEdinetBridge,
  syncEdinetForecasts,
  syncEdinetQualityScores,
  syncEdinetTextScores,
  syncEdinetTimeline,
} from '../services/edinetSyncService'
import { parseCode4, toCode5 } from '../utils/stockCode'

type SyncBody =
  | { target: 'master' }
  | { target: 'prices';     code: string; from?: string; to?: string }
  | { target: 'financials'; code: string }
  | { target: 'fins_details'; code: string }
  | { target: 'edinet_timeline'; code: string; from?: string; to?: string }
  | { target: 'edinet_forecasts'; code: string }
  | { target: 'edinet_bridge'; code: string }
  | { target: 'edinet_quality_scores'; code: string }
  | { target: 'edinet_text_scores'; code: string }

function parseRequestCode(code: string | undefined): string | null {
  return parseCode4(code ?? '')
}

function codeError(c: Context<{ Bindings: Bindings }>) {
  return c.json({ error: 'code must be a 4-char alphanumeric' }, 400)
}

function getEdinetApiKey(c: Context<{ Bindings: Bindings }>): string | null {
  return c.env.EDINETDB_API_KEY || null
}

function getOfficialEdinetApiKey(c: Context<{ Bindings: Bindings }>): string | null {
  return c.env.EDINET_API_KEY || null
}

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
        const code = parseRequestCode(body.code)
        if (!code) return codeError(c)
        const from = body.from ?? DEFAULT_PRICE_SYNC_FROM
        const to   = body.to   ?? DEFAULT_PRICE_SYNC_TO
        const synced = await syncDailyPrices(db, apiKey, code, from, to)
        return c.json({ ok: true, target: 'prices', code, synced })
      }
      case 'financials': {
        const code = parseRequestCode(body.code)
        if (!code) return codeError(c)
        const synced = await syncFinancialSummary(db, apiKey, code)
        return c.json({ ok: true, target: 'financials', code, synced })
      }
      case 'fins_details': {
        const code = parseRequestCode(body.code)
        if (!code) return codeError(c)
        const code5 = toCode5(code)
        try {
          const synced = await syncFinsDetails(db, apiKey, code5)
          return c.json({ ok: true, target: 'fins_details', code, synced })
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e)
          if (message.includes('not available on your subscription')) {
            const edinetDbApiKey = getEdinetApiKey(c)
            const edinetApiKey = getOfficialEdinetApiKey(c)
            if (edinetDbApiKey && edinetApiKey) {
              const fallback = await syncFinsDetailsFromEdinet(db, edinetDbApiKey, edinetApiKey, code5)
              return c.json({
                ok: true,
                target: 'fins_details',
                code,
                synced: fallback.synced,
                fallback: true,
                details_source: fallback.detailsSource,
                tax_expense_filled_count: fallback.taxExpenseFilledCount,
                adjustments_filled_count: fallback.adjustmentsFilledCount,
              })
            }
            return c.json({
              ok: true,
              target: 'fins_details',
              code,
              synced: 0,
              skipped: true,
              reason: 'not_available_on_subscription',
            })
          }
          throw e
        }
      }
      case 'edinet_timeline': {
        const code = parseRequestCode(body.code)
        if (!code) return codeError(c)
        const edinetApiKey = getEdinetApiKey(c)
        if (!edinetApiKey) return c.json({ error: 'EDINETDB_API_KEY is not set' }, 400)
        const synced = await syncEdinetTimeline(db, edinetApiKey, toCode5(code), body.from, body.to)
        return c.json({ ok: true, target: 'edinet_timeline', code, synced })
      }
      case 'edinet_forecasts': {
        const code = parseRequestCode(body.code)
        if (!code) return codeError(c)
        const edinetApiKey = getEdinetApiKey(c)
        if (!edinetApiKey) return c.json({ error: 'EDINETDB_API_KEY is not set' }, 400)
        const synced = await syncEdinetForecasts(db, edinetApiKey, toCode5(code))
        return c.json({ ok: true, target: 'edinet_forecasts', code, synced })
      }
      case 'edinet_bridge': {
        const code = parseRequestCode(body.code)
        if (!code) return codeError(c)
        const edinetApiKey = getEdinetApiKey(c)
        if (!edinetApiKey) return c.json({ error: 'EDINETDB_API_KEY is not set' }, 400)
        const synced = await syncEdinetBridge(db, edinetApiKey, toCode5(code))
        return c.json({ ok: true, target: 'edinet_bridge', code, synced })
      }
      case 'edinet_quality_scores': {
        const code = parseRequestCode(body.code)
        if (!code) return codeError(c)
        const edinetApiKey = getEdinetApiKey(c)
        if (!edinetApiKey) return c.json({ error: 'EDINETDB_API_KEY is not set' }, 400)
        const synced = await syncEdinetQualityScores(db, edinetApiKey, toCode5(code))
        return c.json({ ok: true, target: 'edinet_quality_scores', code, synced })
      }
      case 'edinet_text_scores': {
        const code = parseRequestCode(body.code)
        if (!code) return codeError(c)
        const edinetApiKey = getEdinetApiKey(c)
        if (!edinetApiKey) return c.json({ error: 'EDINETDB_API_KEY is not set' }, 400)
        const synced = await syncEdinetTextScores(db, edinetApiKey, toCode5(code))
        return c.json({ ok: true, target: 'edinet_text_scores', code, synced })
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
