import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import { getStockByCode } from '../services/stockService'
import { getRecentPrices } from '../services/priceService'
import { getLatestFinancials, calcMetrics, fmtJpy, fmtVolume, getFinsDetailsLatest, calcAdvancedMetrics } from '../services/financialService'
import { PriceChart } from '../components/PriceChart'
import { MetricsCard } from '../components/MetricsCard'

export const stockRoute = new Hono<{ Bindings: Bindings }>()

stockRoute.get('/:code', async (c) => {
  const code4 = c.req.param('code')
  if (!/^\d{4}$/.test(code4)) {
    return c.html('<p>不正なコードです。4桁の数字を指定してください。</p>', 400)
  }
  const code5 = code4 + '0'
  const db    = createDb(c.env.DATABASE_URL)

  const [stock, prices, financials, finsDetail] = await Promise.all([
    getStockByCode(db, code5),
    getRecentPrices(db, code5, 60),
    getLatestFinancials(db, code5),
    getFinsDetailsLatest(db, code5),
  ])

  if (!stock) {
    return c.html('<p>銘柄が見つかりません。先に /api/sync で master データを同期してください。</p>', 404)
  }

  const code4display = stock.code.slice(0, 4)

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
  const recentPrices = prices.slice(0, 10)

  return c.render(
    <div>
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
      {(advMetrics.evEbitda !== null || advMetrics.roic !== null || advMetrics.netCash !== null) && (
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
              <div class="fin-row"><span class="fin-key">EV/EBITDA</span><span class="fin-val">{advMetrics.evEbitda !== null ? `${advMetrics.evEbitda}x` : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">NOPAT</span><span class="fin-val">{advMetrics.nopat !== null ? fmtJpy(String(advMetrics.nopat)) : '—'}</span></div>
              <div class="fin-row"><span class="fin-key">投下資本</span><span class="fin-val">{advMetrics.investedCap !== null ? fmtJpy(String(advMetrics.investedCap)) : '—'}</span></div>
              <div class="fin-row">
                <span class="fin-key">ROIC</span>
                <span class={`fin-val ${(advMetrics.roic ?? 0) >= 0 ? 'positive' : 'negative'}`}>
                  {advMetrics.roic !== null ? `${advMetrics.roic}%` : '—'}
                </span>
              </div>
            </div>
          </div>
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
    </div>,
  )
})
