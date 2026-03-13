import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import {
  addStockMemo,
  listWatchedStocks,
  removeFromWatchlist,
  setWatchState,
  updateStockMemo,
  deleteStockMemo,
} from '../services/watchlistService'
import { parseCode4, toCode4, toCode5 } from '../utils/stockCode'

export const watchlistRoute = new Hono<{ Bindings: Bindings }>()

function memoPreview(text: string | null): string {
  if (!text) return '—'
  if (text.length <= 60) return text
  return `${text.slice(0, 60)}…`
}

function fmtDateTime(dt: Date | string | null): string {
  if (!dt) return '—'
  return new Date(dt).toISOString().replace('T', ' ').slice(0, 16)
}

watchlistRoute.get('/', async (c) => {
  const db = createDb(c.env.DATABASE_URL)
  const rows = await listWatchedStocks(db)

  return c.render(
    <div>
      <section class="search-block">
        <h1 class="search-label">ウォッチ銘柄</h1>
        <p class="empty-state" style="text-align:left;padding:0 0 10px 0">
          ウォッチ中の銘柄一覧です。メモの追加・編集は銘柄詳細ページで行います。
        </p>
      </section>

      <div class="card">
        <table class="fav-table">
          <thead>
            <tr>
              <th>コード</th>
              <th>銘柄名</th>
              <th>市場</th>
              <th>業種</th>
              <th class="r">メモ件数</th>
              <th>最新メモ</th>
              <th>最終更新</th>
              <th class="r">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colspan={8} class="empty-state">ウォッチ銘柄はまだありません</td></tr>
            ) : rows.map(r => {
              const code4 = toCode4(r.code)
              return (
                <tr key={r.code}>
                  <td><a class="code" href={`/stock/${code4}`}>{code4}</a></td>
                  <td><a href={`/stock/${code4}`}>{r.coName ?? '—'}</a></td>
                  <td>{r.mktNm ?? '—'}</td>
                  <td>{r.sector33Nm ?? '—'}</td>
                  <td class="r">{r.memoCount.toLocaleString('ja-JP')}</td>
                  <td title={r.latestMemoBody ?? ''}>{memoPreview(r.latestMemoBody)}</td>
                  <td>{fmtDateTime(r.latestMemoUpdatedAt)}</td>
                  <td class="r">
                    <form method="post" action="/watchlist/watch" style="display:inline-flex;gap:6px">
                      <input type="hidden" name="code" value={code4} />
                      <input type="hidden" name="is_watched" value="0" />
                      <input type="hidden" name="redirect_to" value="/watchlist" />
                      <button class="btn-sm" type="submit">ウォッチ解除</button>
                    </form>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>,
  )
})

watchlistRoute.post('/watch', async (c) => {
  const body = await c.req.parseBody()
  const code = parseCode4(String(body.code ?? ''))
  if (!code) return c.html('invalid code', 400)

  const isWatched = String(body.is_watched ?? '1') === '1'
  const db = createDb(c.env.DATABASE_URL)
  await setWatchState(db, toCode5(code), isWatched)
  const redirectTo = String(body.redirect_to ?? `/stock/${code}`)
  return c.redirect(redirectTo, 303)
})

watchlistRoute.post('/notes/add', async (c) => {
  const body = await c.req.parseBody()
  const code = parseCode4(String(body.code ?? ''))
  if (!code) return c.html('invalid code', 400)

  const memoBody = String(body.body ?? '')
  const db = createDb(c.env.DATABASE_URL)
  await addStockMemo(db, toCode5(code), memoBody)
  const redirectTo = String(body.redirect_to ?? `/stock/${code}`)
  return c.redirect(redirectTo, 303)
})

watchlistRoute.post('/notes/update', async (c) => {
  const body = await c.req.parseBody()
  const code = parseCode4(String(body.code ?? ''))
  const noteId = String(body.note_id ?? '').trim()
  if (!code || !noteId) return c.html('invalid payload', 400)

  const memoBody = String(body.body ?? '')
  const db = createDb(c.env.DATABASE_URL)
  await updateStockMemo(db, toCode5(code), noteId, memoBody)
  const redirectTo = String(body.redirect_to ?? `/stock/${code}`)
  return c.redirect(redirectTo, 303)
})

watchlistRoute.post('/notes/delete', async (c) => {
  const body = await c.req.parseBody()
  const code = parseCode4(String(body.code ?? ''))
  const noteId = String(body.note_id ?? '').trim()
  if (!code || !noteId) return c.html('invalid payload', 400)

  const db = createDb(c.env.DATABASE_URL)
  await deleteStockMemo(db, toCode5(code), noteId)
  const redirectTo = String(body.redirect_to ?? `/stock/${code}`)
  return c.redirect(redirectTo, 303)
})

// Backward-compatible endpoint aliases.
watchlistRoute.post('/add', async (c) => {
  const body = await c.req.parseBody()
  const code = parseCode4(String(body.code ?? ''))
  if (!code) return c.html('invalid code', 400)
  const db = createDb(c.env.DATABASE_URL)
  await setWatchState(db, toCode5(code), true)
  const memoBody = String(body.note ?? '')
  if (memoBody.trim()) {
    await addStockMemo(db, toCode5(code), memoBody)
  }
  const redirectTo = String(body.redirect_to ?? `/stock/${code}`)
  return c.redirect(redirectTo, 303)
})

watchlistRoute.post('/remove', async (c) => {
  const body = await c.req.parseBody()
  const code = parseCode4(String(body.code ?? ''))
  if (!code) return c.html('invalid code', 400)
  const db = createDb(c.env.DATABASE_URL)
  await removeFromWatchlist(db, toCode5(code))
  const redirectTo = String(body.redirect_to ?? '/watchlist')
  return c.redirect(redirectTo, 303)
})
