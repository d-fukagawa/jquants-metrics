import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import {
  ThemeInputError,
  type ThemeGranularity,
  createTheme,
  deleteTheme,
  getThemeDetail,
  listThemeCandidates,
  listThemeSeries,
  listThemes,
  updateTheme,
  updateThemeMemo,
} from '../services/themeService'

export const themesRoute = new Hono<{ Bindings: Bindings }>()

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime())
}

function defaultDateRange(): { from: string; to: string } {
  const toDate = new Date()
  toDate.setUTCHours(0, 0, 0, 0)
  const fromDate = new Date(toDate)
  fromDate.setUTCMonth(fromDate.getUTCMonth() - 6)
  return {
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
  }
}

function fmtDateTime(dt: Date): string {
  return new Date(dt).toISOString().replace('T', ' ').slice(0, 16)
}

function parseGranularity(raw: string | undefined): ThemeGranularity {
  if (raw === 'w' || raw === 'm') return raw
  return 'd'
}

function analysisUrl(themeId: string, g: ThemeGranularity, from: string, to: string): string {
  const params = new URLSearchParams({ g, from, to })
  return `/themes/${themeId}?${params.toString()}`
}

function editorPage(
  mode: 'new' | 'edit',
  {
    id,
    name,
    memo,
    stocks,
    error,
  }: {
    id?: string
    name: string
    memo: string
    stocks: Array<{ code: string; code4: string; coName: string | null }>
    error?: string
  },
) {
  const title = mode === 'new' ? 'テーマ新規作成' : 'テーマ編集'
  const action = mode === 'new' ? '/themes' : `/themes/${id}`
  const initial = encodeURIComponent(JSON.stringify(stocks))

  return (
    <div class="theme-form-wrap">
      <section class="search-block" style="margin-bottom:20px">
        <h1 class="search-label">{title}</h1>
        <p class="empty-state" style="text-align:left;padding:0">
          テーマ名・銘柄・メモを設定して保存します。
        </p>
      </section>

      {error && (
        <div class="theme-error-banner">{error}</div>
      )}

      <form method="post" action={action} class="theme-form-grid">
        <div class="card panel">
          <div class="panel-header">
            <span class="panel-title">基本情報</span>
          </div>
          <div class="panel-body">
            <div>
              <label class="fg-label" for="theme-name">テーマ名</label>
              <input id="theme-name" class="input" type="text" name="name" value={name} maxlength={100} required />
            </div>
            <div>
              <label class="fg-label" for="theme-memo">テーマメモ</label>
              <textarea id="theme-memo" class="theme-memo-textarea" name="memo" maxlength={10000}>{memo}</textarea>
            </div>
          </div>
        </div>

        <div class="card panel" id="theme-form-root" data-initial={initial}>
          <div class="panel-header">
            <span class="panel-title">テーマ銘柄（最大6銘柄）</span>
          </div>
          <div class="panel-body">
            <div class="theme-stock-search">
              <input id="theme-stock-search-input" class="input" type="text" placeholder="銘柄コード or 会社名で検索" />
              <button id="theme-stock-search-btn" class="btn btn-primary" type="button">検索</button>
            </div>
            <div id="theme-stock-search-results" class="theme-stock-search-results"></div>

            <div>
              <div class="fg-label">選択済み銘柄（並び順が分析画面の凡例順になります）</div>
              <div id="theme-stock-selected" class="theme-stock-selected"></div>
              <div id="theme-stock-hidden"></div>
            </div>
          </div>
        </div>

        <div class="theme-form-actions">
          <a class="btn-sm" href="/themes">一覧へ戻る</a>
          <button class="btn btn-primary" type="submit">保存</button>
        </div>
      </form>

      <script src="/static/theme-form.js"></script>
    </div>
  )
}

themesRoute.get('/', async (c) => {
  const db = createDb(c.env.DATABASE_URL)
  const rows = await listThemes(db)

  return c.render(
    <div>
      <section class="search-block" style="margin-bottom:20px">
        <h1 class="search-label">テーマ一覧</h1>
        <div class="theme-list-header">
          <p class="empty-state" style="text-align:left;padding:0">
            銘柄テーマごとに分析チャートと検討メモを管理します。
          </p>
          <a href="/themes/new" class="btn btn-primary">新規作成</a>
        </div>
      </section>

      <div class="card">
        <table class="fav-table">
          <thead>
            <tr>
              <th>テーマ名</th>
              <th class="r">銘柄数</th>
              <th>更新日時</th>
              <th class="r">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colspan={4} class="empty-state">テーマはまだありません</td></tr>
            ) : rows.map(row => (
              <tr key={row.id}>
                <td><a href={`/themes/${row.id}`}>{row.name}</a></td>
                <td class="r">{row.stockCount}</td>
                <td>{fmtDateTime(row.updatedAt)}</td>
                <td class="r">
                  <div class="theme-list-actions">
                    <a class="btn-sm" href={`/themes/${row.id}`}>分析</a>
                    <a class="btn-sm" href={`/themes/${row.id}/edit`}>編集</a>
                    <form method="post" action={`/themes/${row.id}/delete`} style="display:inline">
                      <button class="btn-sm" type="submit">削除</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>,
  )
})

themesRoute.get('/new', async (c) => {
  return c.render(editorPage('new', {
    name: '',
    memo: '',
    stocks: [],
  }))
})

themesRoute.get('/stock-search', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 100)
  if (!q) return c.json({ rows: [] })
  const db = createDb(c.env.DATABASE_URL)
  const rows = await listThemeCandidates(db, q)
  return c.json({ rows })
})

themesRoute.post('/', async (c) => {
  const db = createDb(c.env.DATABASE_URL)
  const form = await c.req.formData()
  const name = String(form.get('name') ?? '')
  const memo = String(form.get('memo') ?? '')
  const codes = form.getAll('codes[]').map(v => String(v))

  try {
    const themeId = await createTheme(db, { name, memo, codes })
    return c.redirect(`/themes/${themeId}`, 303)
  } catch (error) {
    if (error instanceof ThemeInputError) {
      c.status(400)
      return c.render(editorPage('new', {
        name,
        memo,
        stocks: [],
        error: error.message,
      }))
    }
    throw error
  }
})

themesRoute.get('/:id/edit', async (c) => {
  const id = c.req.param('id')
  const db = createDb(c.env.DATABASE_URL)
  const detail = await getThemeDetail(db, id)
  if (!detail) return c.notFound()

  return c.render(editorPage('edit', {
    id,
    name: detail.theme.name,
    memo: detail.theme.memo,
    stocks: detail.stocks.map(stock => ({
      code: stock.code,
      code4: stock.code4,
      coName: stock.coName,
    })),
  }))
})

themesRoute.post('/:id', async (c) => {
  const id = c.req.param('id')
  const db = createDb(c.env.DATABASE_URL)
  const form = await c.req.formData()
  const name = String(form.get('name') ?? '')
  const memo = String(form.get('memo') ?? '')
  const codes = form.getAll('codes[]').map(v => String(v))

  try {
    const ok = await updateTheme(db, id, { name, memo, codes })
    if (!ok) return c.notFound()
    return c.redirect(`/themes/${id}`, 303)
  } catch (error) {
    if (error instanceof ThemeInputError) {
      const detail = await getThemeDetail(db, id)
      if (!detail) return c.notFound()
      c.status(400)
      return c.render(editorPage('edit', {
        id,
        name,
        memo,
        stocks: detail.stocks.map(stock => ({
          code: stock.code,
          code4: stock.code4,
          coName: stock.coName,
        })),
        error: error.message,
      }))
    }
    throw error
  }
})

themesRoute.post('/:id/delete', async (c) => {
  const id = c.req.param('id')
  const db = createDb(c.env.DATABASE_URL)
  const ok = await deleteTheme(db, id)
  if (!ok) return c.notFound()
  return c.redirect('/themes', 303)
})

themesRoute.post('/:id/memo', async (c) => {
  const id = c.req.param('id')
  const form = await c.req.formData()
  const memo = String(form.get('memo') ?? '')
  const g = parseGranularity(String(form.get('g') ?? 'd'))
  const defaults = defaultDateRange()
  const fromRaw = String(form.get('from') ?? '')
  const toRaw = String(form.get('to') ?? '')
  const from = isDate(fromRaw) ? fromRaw : defaults.from
  const to = isDate(toRaw) ? toRaw : defaults.to

  const db = createDb(c.env.DATABASE_URL)
  const ok = await updateThemeMemo(db, id, memo)
  if (!ok) return c.notFound()
  return c.redirect(analysisUrl(id, g, from <= to ? from : defaults.from, from <= to ? to : defaults.to), 303)
})

themesRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const qFrom = c.req.query('from')
  const qTo = c.req.query('to')
  const g = parseGranularity(c.req.query('g'))
  const defaults = defaultDateRange()
  const from = qFrom ?? defaults.from
  const to = qTo ?? defaults.to

  if (!isDate(from) || !isDate(to)) {
    return c.html('invalid date', 400)
  }
  if (from > to) {
    return c.html('from must be <= to', 400)
  }

  const db = createDb(c.env.DATABASE_URL)
  const detail = await getThemeDetail(db, id)
  if (!detail) return c.notFound()
  const series = await listThemeSeries(db, detail.stocks, from, to, g)
  const encoded = encodeURIComponent(JSON.stringify({
    themeName: detail.theme.name,
    granularity: g,
    from,
    to,
    series,
  }))

  return c.render(
    <div class="theme-analysis-wrap">
      <section class="theme-analysis-header">
        <h1 class="theme-title">テーマ：{detail.theme.name}</h1>
        <div class="theme-header-actions">
          <a class="btn-sm" href="/themes">テーマ一覧</a>
          <a class="btn-sm" href={`/themes/${id}/edit`}>編集</a>
        </div>
      </section>

      <section class="card panel">
        <div class="panel-body">
          <form method="get" action={`/themes/${id}`} class="theme-analysis-controls">
            <div class="theme-granularity-tabs">
              <a class={`theme-granularity-tab${g === 'd' ? ' active' : ''}`} href={analysisUrl(id, 'd', from, to)}>日足</a>
              <a class={`theme-granularity-tab${g === 'w' ? ' active' : ''}`} href={analysisUrl(id, 'w', from, to)}>週足</a>
              <a class={`theme-granularity-tab${g === 'm' ? ' active' : ''}`} href={analysisUrl(id, 'm', from, to)}>月足</a>
            </div>
            <div class="theme-range-row">
              <input class="input" type="date" name="from" value={from} />
              <span class="range-sep">〜</span>
              <input class="input" type="date" name="to" value={to} />
              <input type="hidden" name="g" value={g} />
              <button class="btn btn-primary" type="submit">反映</button>
            </div>
          </form>
        </div>
      </section>

      <section class="theme-chart-grid">
        <div class="card panel">
          <div class="panel-header">
            <span class="panel-title">複数銘柄株価チャート</span>
            <div class="theme-price-axis-tools">
              <label class="theme-axis-toggle" for="theme-price-dual-axis">
                <input id="theme-price-dual-axis" type="checkbox" checked />
                <span>二軸表示</span>
              </label>
              <span id="theme-price-axis-mode" class="theme-axis-mode">単軸</span>
            </div>
          </div>
          <div class="panel-body">
            <div id="theme-candlestick-chart" class="theme-chart"></div>
          </div>
        </div>
        <div class="card panel">
          <div class="panel-header">
            <span class="panel-title">複数銘柄出来高グラフ</span>
          </div>
          <div class="panel-body">
            <div id="theme-volume-chart" class="theme-chart theme-chart-volume"></div>
          </div>
        </div>
      </section>

      <section class="card panel">
        <div class="panel-header">
          <span class="panel-title">検討メモ</span>
        </div>
        <div class="panel-body">
          <form method="post" action={`/themes/${id}/memo`} class="theme-memo-form">
            <input type="hidden" name="g" value={g} />
            <input type="hidden" name="from" value={from} />
            <input type="hidden" name="to" value={to} />
            <textarea
              class="theme-memo-textarea"
              name="memo"
              maxlength={10000}
              placeholder="テーマ全体の検討メモを入力"
            >{detail.theme.memo}</textarea>
            <div class="theme-form-actions">
              <button class="btn btn-primary" type="submit">保存</button>
            </div>
          </form>
        </div>
      </section>

      <div id="theme-analysis-data" data-payload={encoded}></div>
      <script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
      <script src="/static/theme-analysis.js"></script>
    </div>,
    { wide: true },
  )
})
