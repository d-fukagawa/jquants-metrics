import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import { getStockByCode } from '../services/stockService'
import { getRecentPrices } from '../services/priceService'
import {
  getLatestFinancials,
  calcMetrics,
  fmtJpy,
  getFinsDetailsLatest,
  getFinancialAdjustmentsLatest,
  calcAdvancedMetrics,
  calcAdjustedEbitda,
} from '../services/financialService'
import {
  getDisclosureTimeline,
  getLatestBridgeFact,
  getLatestForecasts,
  getLatestQualityScore,
  getLatestTextScore,
} from '../services/stockEdinetService'
import { getStockMemoPanel } from '../services/watchlistService'
import { PriceChart } from '../components/PriceChart'
import { MetricsCard } from '../components/MetricsCard'
import { parseCode4, toCode4, toCode5 } from '../utils/stockCode'

export const stockRoute = new Hono<{ Bindings: Bindings }>()

stockRoute.get('/:code', async (c) => {
  const code4 = parseCode4(c.req.param('code'))
  if (!code4) {
    return c.html('<p>不正なコードです。4桁の英数字を指定してください。</p>', 400)
  }
  const code5 = toCode5(code4)
  const db    = createDb(c.env.DATABASE_URL)

  const [stock, prices, financials, finsDetail, adjustments] = await Promise.all([
    getStockByCode(db, code5),
    getRecentPrices(db, code5, 60),
    getLatestFinancials(db, code5),
    getFinsDetailsLatest(db, code5),
    getFinancialAdjustmentsLatest(db, code5),
  ])
  const [timeline, forecasts, bridge, qualityScore, textScore, memoPanel] = await Promise.all([
    getDisclosureTimeline(db, code5, 12),
    getLatestForecasts(db, code5),
    getLatestBridgeFact(db, code5),
    getLatestQualityScore(db, code5),
    getLatestTextScore(db, code5),
    getStockMemoPanel(db, code5),
  ])

  if (!stock) {
    return c.html('<p>銘柄が見つかりません。先に /api/sync で master データを同期してください。</p>', 404)
  }

  const code4display = toCode4(stock.code)

  // 最新終値・前日比
  const p0 = prices[0] ?? null
  const p1 = prices[1] ?? null
  const latestClose = p0?.adjClose ? parseFloat(p0.adjClose) : null
  const prevClose   = p1?.adjClose ? parseFloat(p1.adjClose) : null
  const priceChange = latestClose !== null && prevClose !== null ? latestClose - prevClose : null
  const pricePct    = priceChange !== null && prevClose ? (priceChange / prevClose) * 100 : null
  const isUp        = priceChange !== null && priceChange >= 0

  const metrics    = calcMetrics(latestClose, financials)
  const fy         = financials.find(f => f.curPerType === 'FY') ?? financials[0] ?? null
  const advMetrics = calcAdvancedMetrics(latestClose, fy, finsDetail)
  const adjMetrics = calcAdjustedEbitda(fy, finsDetail, adjustments)
  const recentPrices = prices.slice(0, 10)
  const showAdvanced = fy !== null && (
    advMetrics.evEbitda !== null ||
    advMetrics.roic !== null ||
    advMetrics.netCash !== null ||
    adjMetrics.reason !== 'op_missing'
  )

  const adjustedStatus = {
    ok: '算出済み（model）',
    op_missing: '営業利益データ不足',
    dna_missing: 'D&A データ不足',
    adjustment_missing: '調整項目データ不足',
  }[adjMetrics.reason]

  function scoreTooltip(formula: string, components: unknown): string {
    const compText = typeof components === 'object' && components !== null
      ? Object.entries(components as Record<string, unknown>).map(([k, v]) => `${k}: ${String(v)}`).join(' | ')
      : 'components: n/a'
    return `${formula} | ${compText}`
  }

  function fmtDateTime(dt: Date): string {
    return new Date(dt).toISOString().replace('T', ' ').slice(0, 16)
  }

  return c.render(
    <div class="stock-detail-layout">
      <section class="stock-detail-main">
      {/* Breadcrumb */}
      <nav class="breadcrumb">
        <a href="/">ホーム</a>
        <span>/</span>
        <span>{code4display} {stock.coName}</span>
      </nav>

      {/* Hero */}
      <div class="stock-hero">
        <div>
          <div class="stock-code">{code4display} · {stock.coNameEn}</div>
          <h1 class="stock-name">{stock.coName}</h1>
          <div style="margin-bottom:8px"><a class="btn-sm" href="/watchlist">ウォッチ一覧を見る</a></div>
          <div class="tags">
            <span class="tag">{stock.mktNm}市場</span>
            <span class="tag">{stock.sector17Nm}（S17）</span>
            <span class="tag">{stock.sector33Nm}（S33）</span>
            {stock.scaleCat && <span class="tag">{stock.scaleCat}</span>}
            {stock.mrgnNm   && <span class={`tag${stock.mrgn !== '0' ? ' credit' : ''}`}>{stock.mrgnNm}銘柄</span>}
          </div>
        </div>
        {latestClose !== null && (
          <div class="stock-price-block">
            <div class="stock-price">¥{latestClose.toLocaleString()}</div>
            {priceChange !== null && pricePct !== null && (
              <div class={`stock-change ${isUp ? 'up' : 'down'}`}>
                {isUp ? '▲' : '▼'} {Math.abs(priceChange).toFixed(0)} ({isUp ? '+' : ''}{pricePct.toFixed(2)}%)
              </div>
            )}
            {p0?.date && <div class="stock-vol">{p0.date} 終値（調整後）</div>}
          </div>
        )}
      </div>

      {/* Grid: Chart placeholder + Metrics */}
      <div class="grid-main">
        {/* SVG 株価チャート */}
        <div class="card">
          <div class="card-header">
            <span class="card-title">株価推移（調整後終値 AdjC）</span>
            <span class="card-sub">直近 {prices.length} 営業日</span>
          </div>
          <PriceChart prices={prices} />
        </div>

        {/* 財務指標カード */}
        <MetricsCard metrics={metrics} />
      </div>

      {/* 日次株価テーブル */}
      <div class="section-title">日次株価データ（直近10日）</div>
      <div class="card" style="margin-bottom:20px">
        {recentPrices.length > 0 ? (
          <div style="overflow-x:auto">
            <table>
              <thead>
                <tr>
                  <th>取引日</th>
                  <th class="r">始値(Adj)</th>
                  <th class="r">高値(Adj)</th>
                  <th class="r">安値(Adj)</th>
                  <th class="r">終値(Adj)</th>
                  <th class="r">前日比</th>
                  <th class="r">出来高(千株)</th>
                  <th class="r">売買代金(百万円)</th>
                </tr>
              </thead>
              <tbody>
                {recentPrices.map((p, i) => {
                  const c_  = p.adjClose ? parseFloat(p.adjClose) : null
                  const prev = recentPrices[i + 1]?.adjClose ? parseFloat(recentPrices[i + 1].adjClose) : null
                  const chg  = c_ !== null && prev !== null ? c_ - prev : null
                  const pct  = chg !== null && prev ? (chg / prev) * 100 : null
                  const up   = chg !== null && chg >= 0
                  return (
                    <tr key={p.date}>
                      <td style="font-family:ui-monospace,monospace;font-size:12px">{p.date}</td>
                      <td class="r">{p.adjOpen  ? parseFloat(p.adjOpen).toLocaleString()  : '—'}</td>
                      <td class="r">{p.adjHigh  ? parseFloat(p.adjHigh).toLocaleString()  : '—'}</td>
                      <td class="r">{p.adjLow   ? parseFloat(p.adjLow).toLocaleString()   : '—'}</td>
                      <td class="r" style="font-weight:600">{c_ ? c_.toLocaleString() : '—'}</td>
                      <td class="r">
                        {chg !== null && pct !== null
                          ? <span class={up ? 'up' : 'down'}>{up ? '+' : ''}{chg.toFixed(0)} ({up ? '+' : ''}{pct.toFixed(2)}%)</span>
                          : <span>—</span>}
                      </td>
                      <td class="r">{p.volume ? Math.round(parseFloat(p.volume) / 1000).toLocaleString() : '—'}</td>
                      <td class="r">{p.turnover ? Math.round(parseFloat(p.turnover) / 1_000_000).toLocaleString() : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p class="empty-state">価格データがありません。/api/sync で prices を同期してください。</p>
        )}
        <div style="padding:10px 14px;border-top:1px solid var(--border);font-size:11px;color:var(--muted-fg)">
          ソース: /v2/equities/bars/daily · 調整後価格（権利落ち・株式分割考慮）
        </div>
      </div>

      {/* 高度財務指標（Phase 3）*/}
      {showAdvanced && (
        <>
          <div class="section-title">高度財務指標（EV/EBITDA・ROIC・ネットキャッシュ）</div>
          <div class="fin-grid">
            <div class="card card-body">
              <div class="fin-block-title">企業価値（EV）</div>
              <div class="fin-row"><span class="fin-key">時価総額</span><span class="fin-val">{advMetrics.mktCap !== null ? fmtJpy(String(advMetrics.mktCap)) : '—'}</span></div>
              <div class="fin-row">
                <span class="fin-key">ネットキャッシュ</span>
                <span class={`fin-val ${(advMetrics.netCash ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                  {advMetrics.netCash !== null ? fmtJpy(String(advMetrics.netCash)) : '—'}
                </span>
              </div>
              <div class="fin-row"><span class="fin-key">NC比率（NC/時価総額）</span><span class="fin-val">{advMetrics.netCashRatio !== null ? `${advMetrics.netCashRatio}x` : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">EV</span><span class="fin-val">{advMetrics.ev !== null ? fmtJpy(String(advMetrics.ev)) : '—'}</span></div>
            </div>
            <div class="card card-body">
              <div class="fin-block-title">EV/EBITDA・ROIC</div>
              <div class="fin-row"><span class="fin-key">EBITDA</span><span class="fin-val">{advMetrics.ebitda !== null ? fmtJpy(String(advMetrics.ebitda)) : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">調整後EBITDA（model）</span><span class="fin-val">{adjMetrics.adjustedEbitda !== null ? fmtJpy(String(adjMetrics.adjustedEbitda)) : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">調整項目（加算）</span><span class="fin-val">{adjMetrics.addbackTotal > 0 ? fmtJpy(String(adjMetrics.addbackTotal)) : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">調整項目（控除）</span><span class="fin-val">{adjMetrics.deductionTotal > 0 ? fmtJpy(String(adjMetrics.deductionTotal)) : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">EV/EBITDA</span><span class="fin-val">{advMetrics.evEbitda !== null ? `${advMetrics.evEbitda}x` : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">NOPAT</span><span class="fin-val">{advMetrics.nopat !== null ? fmtJpy(String(advMetrics.nopat)) : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">投下資本</span><span class="fin-val">{advMetrics.investedCap !== null ? fmtJpy(String(advMetrics.investedCap)) : '—'}</span></div>
              <div class="fin-row">
                <span class="fin-key">ROIC</span>
                <span class={`fin-val ${(advMetrics.roic ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                  {advMetrics.roic !== null ? `${advMetrics.roic}%` : '—'}
                </span>
              </div>
              <div class="fin-row"><span class="fin-key">調整後EBITDA 算出状態</span><span class="fin-val">{adjustedStatus}</span></div>
            </div>
          </div>
          <p class="empty-state" style="text-align:left;padding:0 0 14px 0">
            調整後EBITDA は会社開示の正式値ではなく、`fins/details` の調整項目候補から算出した model 推定値です。
          </p>
        </>
      )}

      {/* 財務サマリー */}
      {fy && (
        <>
          <div class="section-title">最新期 財務サマリー（{fy.curPerType} {fy.discDate}）</div>
          <div class="fin-grid">
            {/* PL */}
            <div class="card card-body">
              <div class="fin-block-title">損益計算書（PL）</div>
              <div class="fin-row"><span class="fin-key">売上高</span><span class="fin-val">{fmtJpy(fy.sales)}</span></div>
              <div class="fin-row"><span class="fin-key">営業利益 (OP)</span><span class={`fin-val ${parseFloat(fy.op ?? '0') >= 0 ? 'positive' : 'negative'}`}>{fmtJpy(fy.op)}</span></div>
              <div class="fin-row"><span class="fin-key">当期純利益 (NP)</span><span class={`fin-val ${parseFloat(fy.np ?? '0') >= 0 ? 'positive' : 'negative'}`}>{fmtJpy(fy.np)}</span></div>
              <div class="fin-row"><span class="fin-key">EPS</span><span class="fin-val">{fy.eps ? `¥${parseFloat(fy.eps).toFixed(2)}` : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">BPS（自己資本/株）</span><span class="fin-val">{metrics.bps !== null ? `¥${metrics.bps.toLocaleString()}` : '—'}</span></div>
            </div>
            {/* BS */}
            <div class="card card-body">
              <div class="fin-block-title">貸借対照表（BS）</div>
              <div class="fin-row"><span class="fin-key">総資産 (TA)</span><span class="fin-val">{fmtJpy(fy.totalAssets)}</span></div>
              <div class="fin-row"><span class="fin-key">自己資本 (Eq)</span><span class="fin-val">{fmtJpy(fy.equity)}</span></div>
              <div class="fin-row"><span class="fin-key">自己資本比率 (EqAR)</span><span class="fin-val">{fy.eqAr ? `${(parseFloat(fy.eqAr) * 100).toFixed(1)}%` : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">現金・同等物</span><span class="fin-val">{fmtJpy(fy.cashEq)}</span></div>
              <div class="fin-row"><span class="fin-key">発行済株式数</span><span class="fin-val">{fy.shOutFy ? `${(parseFloat(fy.shOutFy) / 1e6).toFixed(0)}百万株` : '—'}</span></div>
            </div>
            {/* CF */}
            <div class="card card-body">
              <div class="fin-block-title">キャッシュフロー（CF）</div>
              <div class="fin-row"><span class="fin-key">営業CF (CFO)</span><span class={`fin-val ${parseFloat(fy.cfo ?? '0') >= 0 ? 'positive' : 'negative'}`}>{fmtJpy(fy.cfo)}</span></div>
              <div class="fin-row"><span class="fin-key">配当金 (DivAnn)</span><span class="fin-val">{fy.divAnn ? `¥${parseFloat(fy.divAnn).toLocaleString()}` : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">配当金予想</span><span class="fin-val">{fy.fDivAnn ? `¥${parseFloat(fy.fDivAnn).toLocaleString()}` : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">予想売上高</span><span class="fin-val">{fmtJpy(fy.fSales)}</span></div>
              <div class="fin-row"><span class="fin-key">予想純利益</span><span class="fin-val">{fmtJpy(fy.fNp)}</span></div>
            </div>
          </div>
        </>
      )}

      {/* 決算履歴 */}
      {financials.length > 0 && (
        <>
          <div class="section-title">決算履歴</div>
          <div class="card" style="margin-bottom:20px">
            <table>
              <thead>
                <tr>
                  <th>開示日</th>
                  <th>種別</th>
                  <th class="r">売上高</th>
                  <th class="r">営業利益</th>
                  <th class="r">純利益</th>
                  <th class="r">EPS</th>
                  <th class="r">CFO</th>
                  <th class="r">配当</th>
                </tr>
              </thead>
              <tbody>
                {financials.map(f => (
                  <tr key={f.discNo} class={f.curPerType === 'FY' ? 'fy' : ''}>
                    <td style="font-family:ui-monospace,monospace;font-size:12px">{f.discDate ?? '—'}</td>
                    <td><span class="per-type">{f.curPerType ?? '—'}</span></td>
                    <td class="r">{fmtJpy(f.sales)}</td>
                    <td class="r">{fmtJpy(f.op)}</td>
                    <td class="r">{fmtJpy(f.np)}</td>
                    <td class="r">{f.eps ? `¥${parseFloat(f.eps).toFixed(1)}` : '—'}</td>
                    <td class="r">{fmtJpy(f.cfo)}</td>
                    <td class="r">{f.divAnn ? `¥${parseFloat(f.divAnn)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {financials.length === 0 && (
        <p class="empty-state">財務データがありません。/api/sync で financials を同期してください。</p>
      )}

      {/* EDINET: 開示タイムライン */}
      <div class="section-title">EDINET 開示タイムライン</div>
      <div class="card" style="margin-bottom:20px">
        {timeline.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>開示日</th>
                <th>種別</th>
                <th>タイトル</th>
                <th>修正</th>
              </tr>
            </thead>
            <tbody>
              {timeline.map((t) => (
                <tr key={`${t.edinetCode}-${t.docId}`}>
                  <td style="font-family:ui-monospace,monospace;font-size:12px">{t.filingDate}</td>
                  <td>{t.eventType}</td>
                  <td>{t.title}</td>
                  <td>{t.isAmendment ? 'あり' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p class="empty-state">EDINETタイムラインが未同期です（target: edinet_timeline）。</p>
        )}
      </div>

      {/* EDINET: 会社予想（来期 / 再来期） */}
      <div class="section-title">EDINET 会社予想スナップショット（来期 / 再来期）</div>
      <div class="fin-grid" style="margin-bottom:20px">
        {[{ key: 'next', label: '来期', row: forecasts.next }, { key: 'next2', label: '再来期', row: forecasts.next2 }].map(item => (
          <div key={item.key} class="card card-body">
            <div class="fin-block-title">{item.label}</div>
            <div class="fin-row"><span class="fin-key">対象年度</span><span class="fin-val">{item.row?.fiscalYear ?? '—'}</span></div>
            <div class="fin-row"><span class="fin-key">売上予想</span><span class="fin-val">{fmtJpy(item.row?.salesForecast ?? null)}</span></div>
            <div class="fin-row"><span class="fin-key">営業利益予想</span><span class="fin-val">{fmtJpy(item.row?.opForecast ?? null)}</span></div>
            <div class="fin-row"><span class="fin-key">純利益予想</span><span class="fin-val">{fmtJpy(item.row?.npForecast ?? null)}</span></div>
            <div class="fin-row"><span class="fin-key">EPS予想</span><span class="fin-val">{item.row?.epsForecast ? `¥${Number(item.row.epsForecast).toFixed(2)}` : '—'}</span></div>
            <div class="fin-row"><span class="fin-key">開示日</span><span class="fin-val">{item.row?.disclosedAt ?? '—'}</span></div>
          </div>
        ))}
      </div>

      {/* EDINET: 会計調整ブリッジ */}
      <div class="section-title">EDINET 会計調整ブリッジ（OP → Pretax → NP → CFO）</div>
      <div class="card" style="margin-bottom:20px">
        {bridge ? (
          <table>
            <thead>
              <tr>
                <th>要素</th>
                <th class="r">値</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>営業利益 (OP)</td><td class="r">{fmtJpy(bridge.operatingProfit)}</td></tr>
              <tr><td>税前利益 (Pretax)</td><td class="r">{fmtJpy(bridge.pretaxProfit)}</td></tr>
              <tr><td>当期純利益 (NP)</td><td class="r">{fmtJpy(bridge.netProfit)}</td></tr>
              <tr><td>営業CF (CFO)</td><td class="r">{fmtJpy(bridge.cfo)}</td></tr>
              <tr><td>減価償却費</td><td class="r">{fmtJpy(bridge.depreciation)}</td></tr>
              <tr><td>対象年度</td><td class="r">{bridge.fiscalYear}</td></tr>
            </tbody>
          </table>
        ) : (
          <p class="empty-state">EDINETブリッジデータが未同期です（target: edinet_bridge）。</p>
        )}
      </div>

      {/* EDINET: 会計品質 / テキスト異常 */}
      <div class="section-title">EDINET スコア（会計品質 / テキスト異常）</div>
      <div class="metrics-grid" style="margin-bottom:20px">
        <div class="metric-card">
          <div class="metric-label">
            会計品質スコア
            <span class="tip" title={qualityScore ? scoreTooltip(qualityScore.formulaText, qualityScore.componentsJson) : '未同期'}>
              ⓘ
            </span>
          </div>
          <div class="metric-value">{qualityScore?.qualityScore ?? '—'}</div>
          <div class="metric-sub">{qualityScore ? `as of ${qualityScore.asOfDate}` : 'target: edinet_quality_scores'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">
            テキスト異常スコア
            <span class="tip" title={textScore ? scoreTooltip(textScore.formulaText, textScore.componentsJson) : '未同期'}>
              ⓘ
            </span>
          </div>
          <div class="metric-value">{textScore?.anomalyScore ?? '—'}</div>
          <div class="metric-sub">{textScore ? `as of ${textScore.asOfDate}` : 'target: edinet_text_scores'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">品質-異常差分</div>
          <div class="metric-value">
            {(qualityScore && textScore)
              ? (qualityScore.qualityScore - textScore.anomalyScore)
              : '—'}
          </div>
          <div class="metric-sub">quality - anomaly</div>
        </div>
      </div>
      </section>

      <aside class="stock-detail-side">
        <div class="panel stock-memo-panel">
          <div class="panel-header">
            <span class="panel-title">検討メモ</span>
            <span class="badge">{memoPanel.notes.length}件</span>
          </div>
          <div class="panel-body">
            <form method="post" action="/watchlist/watch" class="stock-watch-form">
              <input type="hidden" name="code" value={code4display} />
              <input type="hidden" name="is_watched" value={memoPanel.isWatched ? '0' : '1'} />
              <input type="hidden" name="redirect_to" value={`/stock/${code4display}`} />
              <button class="btn btn-primary" type="submit" style="width:100%;height:34px">
                {memoPanel.isWatched ? 'ウォッチ解除' : 'ウォッチ追加'}
              </button>
            </form>

            <a class="btn-sm" href="/watchlist">ウォッチ一覧を見る</a>

            <div>
              <div class="fg-label">新規メモ</div>
              <form method="post" action="/watchlist/notes/add" class="stock-memo-edit-form">
                <input type="hidden" name="code" value={code4display} />
                <input type="hidden" name="redirect_to" value={`/stock/${code4display}`} />
                <textarea
                  class="stock-memo-textarea"
                  name="body"
                  placeholder="この銘柄の検討メモを入力（最大1000文字）"
                ></textarea>
                <div class="stock-memo-actions">
                  <button class="btn-sm" type="submit">メモ追加</button>
                </div>
              </form>
            </div>

            <div>
              <div class="fg-label">メモ一覧</div>
              {memoPanel.notes.length === 0 ? (
                <p class="empty-state stock-memo-empty">メモはまだありません</p>
              ) : (
                <div class="stock-memo-list">
                  {memoPanel.notes.map((note) => (
                    <div key={note.id} class="stock-memo-item">
                      <form method="post" action="/watchlist/notes/update" class="stock-memo-edit-form">
                        <input type="hidden" name="code" value={code4display} />
                        <input type="hidden" name="note_id" value={note.id} />
                        <input type="hidden" name="redirect_to" value={`/stock/${code4display}`} />
                        <textarea class="stock-memo-textarea" name="body">{note.body}</textarea>
                        <div class="stock-memo-meta">更新: {fmtDateTime(note.updatedAt)}</div>
                        <div class="stock-memo-actions">
                          <button class="btn-sm" type="submit">更新</button>
                        </div>
                      </form>
                      <form method="post" action="/watchlist/notes/delete" class="stock-memo-delete-form">
                        <input type="hidden" name="code" value={code4display} />
                        <input type="hidden" name="note_id" value={note.id} />
                        <input type="hidden" name="redirect_to" value={`/stock/${code4display}`} />
                        <button class="btn-sm" type="submit">削除</button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>,
  )
})
