import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import { getSyncStatusSummary } from '../services/syncStatusService'

export const syncStatusRoute = new Hono<{ Bindings: Bindings }>()

function fmtNum(n: number): string {
  return n.toLocaleString('ja-JP')
}

syncStatusRoute.get('/', async (c) => {
  const db = createDb(c.env.DATABASE_URL)
  const s = await getSyncStatusSummary(db)

  return c.render(
    <div>
      <section class="search-block" style="margin-bottom:20px">
        <h1 class="search-label">同期ステータス</h1>
        <p class="empty-state" style="text-align:left;padding:0">
          GitHub Actions の <code>scripts/daily-sync.ts</code> 実行結果が DB に反映されているかを確認します。
        </p>
      </section>

      <section class="metrics-grid" style="margin-bottom:20px">
        <div class="metric-card">
          <div class="metric-label">銘柄マスタ件数</div>
          <div class="metric-value">{fmtNum(s.masterCount)}</div>
          <div class="metric-sub">最終更新: {s.masterUpdatedAt ?? '未同期'}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">株価 最新日</div>
          <div class="metric-value">{s.priceLatestDate ?? '未同期'}</div>
          <div class="metric-sub">当日件数: {fmtNum(s.priceLatestDateCount)} / {fmtNum(s.masterCount)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">財務カバレッジ</div>
          <div class="metric-value">
            {s.financialCoveragePct != null ? `${s.financialCoveragePct.toFixed(1)}%` : '未同期'}
          </div>
          <div class="metric-sub">財務銘柄数: {fmtNum(s.financialCodeCount)} / {fmtNum(s.masterCount)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">株価不足数（最新日）</div>
          <div class="metric-value">
            {s.missingPriceOnLatest != null ? fmtNum(s.missingPriceOnLatest) : '未同期'}
          </div>
          <div class="metric-sub">0 に近いほど同期完了</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">fins_details カバレッジ</div>
          <div class="metric-value">
            {s.finsDetailsCoveragePct != null ? `${s.finsDetailsCoveragePct.toFixed(1)}%` : '未同期'}
          </div>
          <div class="metric-sub">銘柄数: {fmtNum(s.finsDetailsCodeCount)} / {fmtNum(s.masterCount)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">EV/EBITDA 算出可能銘柄</div>
          <div class="metric-value">{fmtNum(s.evEbitdaReadyCount)}</div>
          <div class="metric-sub">fins_details と FY 財務が揃う銘柄</div>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <span class="card-title">同期データ詳細</span>
        </div>
        <table class="fav-table">
          <thead>
            <tr>
              <th>対象</th>
              <th>総件数</th>
              <th>最新日</th>
              <th>最新日件数</th>
              <th>補足</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>stock_master</td>
              <td>{fmtNum(s.masterCount)}</td>
              <td>{s.masterUpdatedAt ?? '未同期'}</td>
              <td>-</td>
              <td>銘柄マスタの行数</td>
            </tr>
            <tr>
              <td>daily_prices</td>
              <td>{fmtNum(s.priceTotalCount)}</td>
              <td>{s.priceLatestDate ?? '未同期'}</td>
              <td>{fmtNum(s.priceLatestDateCount)}</td>
              <td>日付数: {fmtNum(s.priceDateCount)}</td>
            </tr>
            <tr>
              <td>financial_summary</td>
              <td>{fmtNum(s.financialTotalCount)}</td>
              <td>{s.financialLatestDiscDate ?? '未同期'}</td>
              <td>{fmtNum(s.financialLatestDiscDateCount)}</td>
              <td>銘柄数: {fmtNum(s.financialCodeCount)}</td>
            </tr>
            <tr>
              <td>fins_details</td>
              <td>{fmtNum(s.finsDetailsTotalCount)}</td>
              <td>{s.finsDetailsLatestDiscDate ?? '未同期'}</td>
              <td>{fmtNum(s.finsDetailsLatestDiscDateCount)}</td>
              <td>銘柄数: {fmtNum(s.finsDetailsCodeCount)} / DNAあり: {fmtNum(s.finsDetailsDnaCount)}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>,
  )
})
