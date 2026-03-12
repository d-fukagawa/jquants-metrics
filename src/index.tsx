import { Hono } from 'hono'
import { renderer } from './renderer'
import type { Bindings } from './types'
import { homeRoute }   from './routes/home'
import { stockRoute }  from './routes/stock'
import { syncRoute }   from './routes/sync'
import { screenRoute } from './routes/screen'
import { syncStatusRoute } from './routes/syncStatus'
import { createDb }    from './db/client'
import { syncStockMaster, syncDailyPricesAll } from './services/syncService'

const app = new Hono<{ Bindings: Bindings }>()

app.use(renderer)

app.route('/',         homeRoute)
app.route('/stock',    stockRoute)
app.route('/api/sync', syncRoute)
app.route('/screen',   screenRoute)
app.route('/sync-status', syncStatusRoute)

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
    const dates: string[] = []
    for (const d = new Date(fromStr); d <= new Date(todayStr); d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10))
    }

    ctx.waitUntil((async () => {
      await syncStockMaster(db, env.JQUANTS_API_KEY)
      for (const date of dates) {
        await syncDailyPricesAll(db, env.JQUANTS_API_KEY, date)
      }
    })())
  },
}
