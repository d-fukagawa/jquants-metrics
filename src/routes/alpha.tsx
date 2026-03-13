import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import { listAlphaSurprises } from '../services/stockEdinetService'
import { parseOptionalNumber } from '../utils/number'

export const alphaRoute = new Hono<{ Bindings: Bindings }>()

alphaRoute.get('/', async (c) => {
  const q = (k: string) => c.req.query(k)
  const metric = (q('metric') as 'sales' | 'op' | 'np' | undefined) ?? 'op'
  const page = parseOptionalNumber(q('page')) ?? 1
  const minSurprisePct = parseOptionalNumber(q('min_surprise_pct'))
  const db = createDb(c.env.DATABASE_URL)
  const { rows, total } = await listAlphaSurprises(db, {
    asOf: q('as_of') || undefined,
    metric,
    minSurprisePct,
    page,
    limit: 50,
  })

  return c.render(
    <div>
      <section class="search-block">
        <h1 class="search-label">サプライズ抽出（/alpha）</h1>
        <form method="get" action="/alpha" class="search-row" style="display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:8px">
          <input class="input" type="date" name="as_of" value={q('as_of') ?? ''} />
          <select class="input" name="metric">
            <option value="op" selected={metric === 'op'}>営業利益</option>
            <option value="np" selected={metric === 'np'}>純利益</option>
            <option value="sales" selected={metric === 'sales'}>売上高</option>
          </select>
          <input class="input" type="number" step="0.1" name="min_surprise_pct" value={q('min_surprise_pct') ?? ''} placeholder="最小サプライズ%" />
          <div class="input" style="display:flex;align-items:center;color:var(--muted-fg)">ヒット: {total}</div>
          <button class="btn btn-primary" type="submit">抽出</button>
        </form>
      </section>

      <div class="card">
        <table class="fav-table">
          <thead>
            <tr>
              <th>コード</th>
              <th>指標</th>
              <th class="r">予想</th>
              <th class="r">実績</th>
              <th class="r">サプライズ</th>
              <th>開示日</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colspan={6} class="empty-state">該当データがありません</td></tr>
            ) : rows.map((r) => (
              <tr key={`${r.code}-${r.disclosedAt}-${r.horizon}`}>
                <td><a href={`/stock/${r.code.slice(0, 4)}`} class="code">{r.code.slice(0, 4)}</a></td>
                <td>{metric.toUpperCase()}</td>
                <td class="r">{r.forecast != null ? Math.round(r.forecast).toLocaleString() : '—'}</td>
                <td class="r">{r.actual != null ? Math.round(r.actual).toLocaleString() : '—'}</td>
                <td class={`r ${(r.surprisePct ?? 0) >= 0 ? 'up' : 'down'}`}>{r.surprisePct != null ? `${r.surprisePct}%` : '—'}</td>
                <td>{r.disclosedAt ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>,
  )
})
