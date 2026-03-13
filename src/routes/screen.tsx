import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import { screenStocks, PAGE_SIZE } from '../services/screenService'
import type { ScreenFilters } from '../services/screenService'
import { parseOptionalNumber } from '../utils/number'

export const screenRoute = new Hono<{ Bindings: Bindings }>()

const MKT_OPTIONS   = ['プライム', 'スタンダード', 'グロース']
const SECTOR17_OPTIONS = [
  '食品', 'エネルギー資源', '建設・資材', '素材・化学', '医薬品・医療',
  '自動車・輸送機', '鉄鋼・非鉄', '機械', '電機・精密', '情報通信・サービス',
  '電力・ガス', '運輸・物流', '商社・卸売', '小売', '銀行', '金融（除く銀行）', '不動産',
]
const SORT_OPTIONS = [
  { value: 'per_asc',        label: 'PER 昇順' },
  { value: 'pbr_asc',        label: 'PBR 昇順' },
  { value: 'roe_desc',       label: 'ROE 降順' },
  { value: 'div_yield_desc', label: '配当利回り 降順' },
  { value: 'mktcap_desc',    label: '時価総額 降順' },
  { value: 'ev_ebitda_asc',  label: 'EV/EBITDA 昇順' },
]

screenRoute.get('/', async (c) => {
  const q = (k: string) => c.req.query(k)
  const num = (k: string) => parseOptionalNumber(q(k))

  const filters: ScreenFilters = {
    perMin:          num('per_min'),
    perMax:          num('per_max'),
    pbrMin:          num('pbr_min'),
    pbrMax:          num('pbr_max'),
    roeMin:          num('roe_min'),
    roeMax:          num('roe_max'),
    divYieldMin:     num('div_yield_min'),
    divYieldMax:     num('div_yield_max'),
    eqArMin:         num('eq_ar_min'),
    eqArMax:         num('eq_ar_max'),
    psrMin:          num('psr_min'),
    psrMax:          num('psr_max'),
    evEbitdaMin:     num('ev_ebitda_min'),
    evEbitdaMax:     num('ev_ebitda_max'),
    evAdjustedEbitdaMin: num('ev_adj_ebitda_min'),
    evAdjustedEbitdaMax: num('ev_adj_ebitda_max'),
    netCashRatioMin: num('nc_ratio_min'),
    netCashRatioMax: num('nc_ratio_max'),
    profitOnly:  q('profit_only') === '1',
    cfoPositive: q('cfo_positive') === '1',
    mkt:         c.req.queries('mkt') ?? [],
    sector17:    q('sector17') || undefined,
    sort:        (q('sort') as ScreenFilters['sort']) || 'per_asc',
    page:        num('page') ?? 1,
  }

  const db               = createDb(c.env.DATABASE_URL)
  const { rows, total }  = await screenStocks(db, filters)
  const currentPage      = filters.page ?? 1
  const totalPages       = Math.ceil(total / PAGE_SIZE)

  // Build query string for pagination (preserves all filter params)
  function pageUrl(p: number) {
    const params = new URLSearchParams()
    const numericParams: Array<[string, number | undefined]> = [
      ['per_min', filters.perMin],
      ['per_max', filters.perMax],
      ['pbr_min', filters.pbrMin],
      ['pbr_max', filters.pbrMax],
      ['roe_min', filters.roeMin],
      ['roe_max', filters.roeMax],
      ['div_yield_min', filters.divYieldMin],
      ['div_yield_max', filters.divYieldMax],
      ['eq_ar_min', filters.eqArMin],
      ['eq_ar_max', filters.eqArMax],
      ['psr_min', filters.psrMin],
      ['psr_max', filters.psrMax],
      ['ev_ebitda_min', filters.evEbitdaMin],
      ['ev_ebitda_max', filters.evEbitdaMax],
      ['ev_adj_ebitda_min', filters.evAdjustedEbitdaMin],
      ['ev_adj_ebitda_max', filters.evAdjustedEbitdaMax],
      ['nc_ratio_min', filters.netCashRatioMin],
      ['nc_ratio_max', filters.netCashRatioMax],
    ]
    for (const [key, value] of numericParams) {
      if (value != null) params.set(key, String(value))
    }
    if (filters.profitOnly)          params.set('profit_only',   '1')
    if (filters.cfoPositive)         params.set('cfo_positive',  '1')
    for (const m of (filters.mkt ?? [])) params.append('mkt', m)
    if (filters.sector17)            params.set('sector17',  filters.sector17)
    if (filters.sort)                params.set('sort',      filters.sort)
    params.set('page', String(p))
    return `/screen?${params.toString()}`
  }

  function fmtClose(n: number | null) {
    return n != null ? n.toLocaleString('ja-JP') : '—'
  }
  function fmtMetric(n: number | null, suffix: string) {
    return n != null ? `${n}${suffix}` : '—'
  }
  function fmtEqAr(n: number | null) {
    return n != null ? `${(n * 100).toFixed(1)}%` : '—'
  }

  return c.render(
    <div class="screen-wrap">
      {/* ── Sidebar ── */}
      <aside class="screen-sidebar">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">スクリーニング条件</span>
            <a href="/screen" class="btn-sm">リセット</a>
          </div>
          <form method="get" action="/screen" class="panel-body">

            {/* 市場区分 */}
            <div>
              <div class="fg-label">市場区分</div>
              <div class="check-group">
                {MKT_OPTIONS.map(m => (
                  <label key={m} class="check-item">
                    <input
                      type="checkbox"
                      name="mkt"
                      value={m}
                      checked={(filters.mkt ?? []).includes(m)}
                    />
                    {m}市場
                  </label>
                ))}
              </div>
            </div>

            <hr class="divider" />

            {/* 17業種 */}
            <div>
              <div class="fg-label">17業種</div>
              <div class="select-wrap">
                <select class="select-sm" name="sector17">
                  <option value="">すべての業種</option>
                  {SECTOR17_OPTIONS.map(s => (
                    <option key={s} value={s} selected={filters.sector17 === s}>{s}</option>
                  ))}
                </select>
                <span class="select-arrow">▼</span>
              </div>
            </div>

            <hr class="divider" />

            {/* PER */}
            <div>
              <div class="fg-label">PER（倍）</div>
              <div class="range-row">
                <input class="input-sm" type="number" name="per_min" step="0.1" placeholder="下限" value={filters.perMin ?? ''} min="0" />
                <span class="range-sep">〜</span>
                <input class="input-sm" type="number" name="per_max" step="0.1" placeholder="上限" value={filters.perMax ?? ''} min="0" />
              </div>
            </div>

            {/* PBR */}
            <div>
              <div class="fg-label">PBR（倍）</div>
              <div class="range-row">
                <input class="input-sm" type="number" name="pbr_min" step="0.1" placeholder="下限" value={filters.pbrMin ?? ''} min="0" />
                <span class="range-sep">〜</span>
                <input class="input-sm" type="number" name="pbr_max" step="0.1" placeholder="上限" value={filters.pbrMax ?? ''} min="0" />
              </div>
            </div>

            {/* ROE */}
            <div>
              <div class="fg-label">ROE（%）</div>
              <div class="range-row">
                <input class="input-sm" type="number" name="roe_min" step="0.1" placeholder="下限" value={filters.roeMin ?? ''} />
                <span class="range-sep">〜</span>
                <input class="input-sm" type="number" name="roe_max" step="0.1" placeholder="上限" value={filters.roeMax ?? ''} />
              </div>
            </div>

            {/* 配当利回り */}
            <div>
              <div class="fg-label">配当利回り（%）</div>
              <div class="range-row">
                <input class="input-sm" type="number" name="div_yield_min" step="0.1" placeholder="下限" value={filters.divYieldMin ?? ''} min="0" />
                <span class="range-sep">〜</span>
                <input class="input-sm" type="number" name="div_yield_max" step="0.1" placeholder="上限" value={filters.divYieldMax ?? ''} min="0" />
              </div>
            </div>

            {/* 自己資本比率 */}
            <div>
              <div class="fg-label">自己資本比率（%）</div>
              <div class="range-row">
                <input class="input-sm" type="number" name="eq_ar_min" step="1" placeholder="下限" value={filters.eqArMin ?? ''} min="0" max="100" />
                <span class="range-sep">〜</span>
                <input class="input-sm" type="number" name="eq_ar_max" step="1" placeholder="上限" value={filters.eqArMax ?? ''} min="0" max="100" />
              </div>
            </div>

            {/* PSR */}
            <div>
              <div class="fg-label">PSR（倍）</div>
              <div class="range-row">
                <input class="input-sm" type="number" name="psr_min" step="0.1" placeholder="下限" value={filters.psrMin ?? ''} min="0" />
                <span class="range-sep">〜</span>
                <input class="input-sm" type="number" name="psr_max" step="0.1" placeholder="上限" value={filters.psrMax ?? ''} min="0" />
              </div>
            </div>

            <hr class="divider" />

            {/* EV/EBITDA */}
            <div>
              <div class="fg-label">EV/EBITDA（倍）</div>
              <div class="range-row">
                <input class="input-sm" type="number" name="ev_ebitda_min" step="0.1" placeholder="下限" value={filters.evEbitdaMin ?? ''} min="0" />
                <span class="range-sep">〜</span>
                <input class="input-sm" type="number" name="ev_ebitda_max" step="0.1" placeholder="上限" value={filters.evEbitdaMax ?? ''} min="0" />
              </div>
            </div>

            {/* EV/調整後EBITDA（model） */}
            <div>
              <div class="fg-label">EV/調整後EBITDA（model, 倍）</div>
              <div class="range-row">
                <input class="input-sm" type="number" name="ev_adj_ebitda_min" step="0.1" placeholder="下限" value={filters.evAdjustedEbitdaMin ?? ''} min="0" />
                <span class="range-sep">〜</span>
                <input class="input-sm" type="number" name="ev_adj_ebitda_max" step="0.1" placeholder="上限" value={filters.evAdjustedEbitdaMax ?? ''} min="0" />
              </div>
            </div>

            {/* ネットキャッシュ比率 */}
            <div>
              <div class="fg-label">NC比率（ネットキャッシュ/時価総額）</div>
              <div class="range-row">
                <input class="input-sm" type="number" name="nc_ratio_min" step="0.01" placeholder="下限" value={filters.netCashRatioMin ?? ''} />
                <span class="range-sep">〜</span>
                <input class="input-sm" type="number" name="nc_ratio_max" step="0.01" placeholder="上限" value={filters.netCashRatioMax ?? ''} />
              </div>
            </div>

            {/* クオリティ */}
            <div>
              <div class="fg-label">クオリティ</div>
              <div class="check-group">
                <label class="check-item">
                  <input type="checkbox" name="profit_only" value="1" checked={filters.profitOnly} />
                  黒字のみ（NP &gt; 0）
                </label>
                <label class="check-item">
                  <input type="checkbox" name="cfo_positive" value="1" checked={filters.cfoPositive} />
                  営業CFプラスのみ
                </label>
              </div>
            </div>

            <hr class="divider" />

            {/* 並び順 */}
            <div>
              <div class="fg-label">並び順</div>
              <div class="select-wrap">
                <select class="select-sm" name="sort">
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value} selected={filters.sort === o.value}>{o.label}</option>
                  ))}
                </select>
                <span class="select-arrow">▼</span>
              </div>
            </div>

            <hr class="divider" />

            <button class="btn btn-primary" type="submit" style="width:100%;height:36px;font-size:13px">
              スクリーニング実行
            </button>
          </form>
        </div>
      </aside>

      {/* ── Results ── */}
      <section class="screen-main">
        <div class="screen-results-header">
          <div>
            <span class="results-title">スクリーニング結果</span>
            <span class="badge" style="margin-left:8px">{total}件</span>
          </div>
          <span style="font-size:12px;color:var(--muted-fg)">
            {currentPage > 1 ? `${(currentPage - 1) * PAGE_SIZE + 1}〜${Math.min(currentPage * PAGE_SIZE, total)}件` : ''}
          </span>
        </div>
        <p class="empty-state" style="text-align:left;padding:0 0 8px 0">
          `EV/調整後EBITDA（model）` は会社開示の正式値ではなく、調整項目候補から算出した推定値です。
        </p>

        <div class="card">
          <div class="table-wrap">
            <table class="screen-table">
              <thead>
                <tr>
                  <th>コード</th>
                  <th>銘柄名</th>
                  <th>市場</th>
                  <th>業種（S17）</th>
                  <th class="r">株価</th>
                  <th class="r">PER</th>
                  <th class="r">PBR</th>
                  <th class="r">ROE</th>
                  <th class="r">配当利回</th>
                  <th class="r">自己資本比率</th>
                  <th class="r">PSR</th>
                  <th class="r">EV/EBITDA</th>
                  <th class="r">EV/調整後EBITDA<br />（model）</th>
                  <th class="r">NC比率</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colspan={14} style="text-align:center;color:var(--muted-fg);padding:40px">
                      条件に一致する銘柄がありません
                    </td>
                  </tr>
                ) : rows.map(r => {
                  const code4 = r.code.slice(0, 4)
                  return (
                    <tr key={r.code} onclick={`location.href='/stock/${code4}'`}>
                      <td><span class="code">{code4}</span></td>
                      <td>
                        <span class="name">{r.coName}</span>
                        {r.mrgnNm === '貸借' && (
                          <span class="tag credit" style="margin-left:4px">貸借</span>
                        )}
                      </td>
                      <td style="font-size:12px;color:var(--muted-fg)">{r.mktNm}</td>
                      <td style="font-size:12px;color:var(--muted-fg)">{r.sector17Nm}</td>
                      <td class="r" style="font-weight:600;font-variant-numeric:tabular-nums">
                        {fmtClose(r.close)}
                      </td>
                      <td class="r">{fmtMetric(r.per, 'x')}</td>
                      <td class="r">{fmtMetric(r.pbr, 'x')}</td>
                      <td class="r">{r.roe != null ? `${r.roe}%` : '—'}</td>
                      <td class="r">{r.divYield != null ? `${r.divYield}%` : '—'}</td>
                      <td class="r">{fmtEqAr(r.eqAr)}</td>
                      <td class="r">{fmtMetric(r.psr, 'x')}</td>
                      <td class="r">{fmtMetric(r.evEbitda, 'x')}</td>
                      <td class="r">{fmtMetric(r.evAdjustedEbitda, 'x')}</td>
                      <td class="r">{r.netCashRatio != null ? `${r.netCashRatio}x` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div class="pagination">
              <span style="font-size:12px;color:var(--muted-fg)">
                {total}件中 {(currentPage - 1) * PAGE_SIZE + 1}〜{Math.min(currentPage * PAGE_SIZE, total)}件
              </span>
              <div class="page-btns">
                {currentPage > 1 && (
                  <a href={pageUrl(currentPage - 1)} class="page-btn">‹</a>
                )}
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = i + 1
                  return (
                    <a key={p} href={pageUrl(p)} class={`page-btn${p === currentPage ? ' active' : ''}`}>{p}</a>
                  )
                })}
                {currentPage < totalPages && (
                  <a href={pageUrl(currentPage + 1)} class="page-btn">›</a>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>,
    { wide: true },
  )
})
