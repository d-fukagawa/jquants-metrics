import { Hono } from 'hono'
import { renderer } from './renderer'
import type { Bindings } from './types'
import { homeRoute }   from './routes/home'
import { stockRoute }  from './routes/stock'
import { stockVerdictRoute } from './routes/stock-verdict'
import { syncRoute }   from './routes/sync'
import { screenRoute } from './routes/screen'
import { syncStatusRoute } from './routes/syncStatus'
import { timelineRoute } from './routes/timeline'
import { alphaRoute } from './routes/alpha'
import { watchlistRoute } from './routes/watchlist'
import { themesRoute } from './routes/themes'
import { createDb }    from './db/client'
import { syncStockMaster, syncDailyPricesAll } from './services/syncService'
import { enumerateDates } from './utils/date'

const app = new Hono<{ Bindings: Bindings }>()

app.use(renderer)

app.route('/',         homeRoute)
app.route('/stock',    stockRoute)
app.route('/stock',    stockVerdictRoute)
app.route('/api/sync', syncRoute)
app.route('/screen',   screenRoute)
app.route('/sync-status', syncStatusRoute)
app.route('/timeline', timelineRoute)
app.route('/alpha', alphaRoute)
app.route('/watchlist', watchlistRoute)
app.route('/themes', themesRoute)

export default {
  fetch: app.fetch.bind(app),

  // Cron ハンドラー — 毎日 01:00 UTC
  // Cloudflare Pages では wrangler.jsonc では設定不可。
  // ダッシュボード: Pages > Settings > Functions > Cron Triggers で "0 1 * * *" を設定する。
  async scheduled(_controller: ScheduledController, env: Bindings, ctx: ExecutionContext) {
    const db = createDb(env.DATABASE_URL)

    const today = new Date()
    const todayStr = today.toISOString().slice(0, 10)
    const weekAgo = new Date(today)
    weekAgo.setDate(weekAgo.getDate() - 7)
    const fromStr = weekAgo.toISOString().slice(0, 10)
    const dates = enumerateDates(fromStr, todayStr)

    ctx.waitUntil((async () => {
      await syncStockMaster(db, env.JQUANTS_API_KEY)
      for (const date of dates) {
        await syncDailyPricesAll(db, env.JQUANTS_API_KEY, date)
      }
    })())
  },
}
