import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import { listTimelineEvents } from '../services/stockEdinetService'
import { parseOptionalNumber } from '../utils/number'
import { parseCode4 } from '../utils/stockCode'

export const timelineRoute = new Hono<{ Bindings: Bindings }>()

function filingSourceUrl(sourceUrl: string | null, docId: string): string | null {
  for (const candidate of [sourceUrl, docId]) {
    if (!candidate) continue
    try {
      if (new URL(candidate).protocol === 'https:') return candidate
    } catch {}
  }
  return null
}

timelineRoute.get('/', async (c) => {
  const q = (k: string) => c.req.query(k)
  const eventTypes = c.req.queries('event_type') ?? []
  const page = parseOptionalNumber(q('page')) ?? 1
  const code = parseCode4(q('code')) ?? undefined
  const db = createDb(c.env.DATABASE_URL)
  const rows = await listTimelineEvents(db, {
    dateFrom: q('date_from') || undefined,
    dateTo: q('date_to') || undefined,
    eventType: eventTypes.length > 0 ? eventTypes : undefined,
    code,
    page,
  })

  return c.render(
    <div>
      <section class="search-block">
        <h1 class="search-label">開示イベント日別ビュー</h1>
        <form method="get" action="/timeline" class="search-row" style="display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:8px">
          <input class="input" type="date" name="date_from" value={q('date_from') ?? ''} />
          <input class="input" type="date" name="date_to" value={q('date_to') ?? ''} />
          <input class="input" type="text" name="code" value={q('code') ?? ''} placeholder="銘柄コード(4桁)" />
          <input class="input" type="text" name="event_type" value={q('event_type') ?? ''} placeholder="開示種別（任意）" />
          <button class="btn btn-primary" type="submit">検索</button>
        </form>
      </section>

      <div class="card timeline-table-scroll">
        <table class="fav-table timeline-table">
          <thead>
            <tr>
              <th>開示日</th>
              <th>銘柄</th>
              <th>種別</th>
              <th>開示内容</th>
              <th>修正</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colspan={5} class="empty-state">イベントがありません</td></tr>
            ) : rows.map((r) => {
              const code4 = r.code?.slice(0, 4) ?? null
              const sourceUrl = filingSourceUrl(r.sourceUrl, r.docId)
              return (
                <tr key={`${r.edinetCode}-${r.docId}`}>
                  <td>{r.filingDate}</td>
                  <td>
                    {code4 ? (
                      <a href={`/stock/${code4}`} class="timeline-stock-link">
                        <span class="code">{code4}</span>
                        <span class="timeline-stock-name">{r.coName ?? '銘柄名未同期'}</span>
                      </a>
                    ) : '—'}
                  </td>
                  <td>{r.eventType}</td>
                  <td>
                    {sourceUrl ? (
                      <a
                        href={sourceUrl}
                        class="timeline-source-link"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span>{r.title}</span>
                        <span class="timeline-source-label">原文 ↗</span>
                      </a>
                    ) : (
                      <div>
                        <div>{r.title}</div>
                        <span class="timeline-source-missing">原文リンク未取得</span>
                      </div>
                    )}
                  </td>
                  <td>{r.isAmendment ? 'あり' : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>,
  )
})
