import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import { searchStocks } from '../services/stockService'
import { toCode4 } from '../utils/stockCode'

export const homeRoute = new Hono<{ Bindings: Bindings }>()

homeRoute.get('/', async (c) => {
  const q       = (c.req.query('q') ?? '').trim().slice(0, 100)
  const db      = createDb(c.env.DATABASE_URL)
  const results = q ? await searchStocks(db, q) : []

  return c.render(
    <div>
      {/* 検索フォーム */}
      <section class="search-block">
        <h1 class="search-label">銘柄を検索</h1>
        <form method="get" action="/" class="search-row">
          <input
            class="input"
            type="text"
            name="q"
            value={q}
            placeholder="銘柄コード（7203）または会社名"
            autocomplete="off"
          />
          <button class="btn btn-primary" type="submit">検索</button>
        </form>
      </section>

      {/* 検索結果 */}
      {q && results.length > 0 && (
        <section>
          <div class="section-header">
            <span class="section-title">検索結果 ({results.length}件)</span>
          </div>
          <div class="card">
            <table class="fav-table">
              <thead>
                <tr>
                  <th>コード</th>
                  <th>銘柄名</th>
                  <th>業種</th>
                  <th>市場</th>
                </tr>
              </thead>
              <tbody>
                {results.map((s) => {
                  const code4 = toCode4(s.code)
                  return (
                    <tr
                      key={s.code}
                      onclick={`location.href='/stock/${code4}'`}
                    >
                      <td><span class="code">{code4}</span></td>
                      <td><span class="name">{s.coName}</span></td>
                      <td style="color:var(--muted-fg);font-size:12px">{s.sector33Nm}</td>
                      <td><span class="badge">{s.mktNm}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {q && results.length === 0 && (
        <p class="empty-state">「{q}」に一致する銘柄が見つかりません</p>
      )}

      {!q && (
        <p class="empty-state" style="padding-top:0">
          銘柄コード（例: 7203）または会社名で検索してください
        </p>
      )}
    </div>,
  )
})
