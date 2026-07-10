import { Hono } from 'hono'
import { createDb } from '../db/client'
import {
  DAILY_RANKING_LIMITS,
  DAILY_RANKING_MARKETS,
  listDailyTurnoverRankings,
  type DailyRankingLimit,
  type DailyRankingMarket,
} from '../services/dailyRankingService'
import { serializeDailyRankingCsv } from '../services/dailyRankingCsvService'
import type { Bindings } from '../types'

export const dailyRankingsRoute = new Hono<{ Bindings: Bindings }>()

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parseMarket(value: string | undefined): DailyRankingMarket | undefined {
  return DAILY_RANKING_MARKETS.find(market => market === value)
}

function parseLimit(value: string | undefined): DailyRankingLimit {
  const limit = Number(value)
  return DAILY_RANKING_LIMITS.find(candidate => candidate === limit) ?? 50
}

type ParsedRankingFilters =
  | { ok: true; date: string | undefined; market: DailyRankingMarket | undefined; limit: DailyRankingLimit }
  | { ok: false; message: string }

function parseRankingFilters(
  dateValue: string | undefined,
  marketValue: string | undefined,
  limitValue: string | undefined,
): ParsedRankingFilters {
  const date = dateValue?.trim() || undefined
  if (date && !isIsoDate(date)) {
    return { ok: false, message: 'Invalid date' }
  }

  const marketRaw = marketValue?.trim() || undefined
  const market = parseMarket(marketRaw)
  if (marketRaw && !market) {
    return { ok: false, message: 'Invalid market' }
  }

  return { ok: true, date, market, limit: parseLimit(limitValue) }
}

function fmtPrice(value: number | null): string {
  if (value == null) return '—'
  return value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
}

function fmtChange(value: number | null): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })}`
}

function fmtChangePct(value: number | null): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function fmtTurnover(value: number): string {
  return `${Math.round(value / 1_000_000).toLocaleString('ja-JP')} 百万円`
}

function fmtRatio(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(2)}倍`
}

function fmtMarketCap(value: number | null): string {
  if (value == null) return '—'
  return `${Math.round(value / 100_000_000).toLocaleString('ja-JP')} 億円`
}

function changeClass(value: number | null): string {
  if (value == null || value === 0) return ''
  return value > 0 ? 'up' : 'down'
}

function dailyRankingCsvUrl(
  date: string | null,
  market: DailyRankingMarket | undefined,
  limit: DailyRankingLimit,
): string {
  const params = new URLSearchParams({ limit: String(limit) })
  if (date) params.set('date', date)
  if (market) params.set('market', market)
  return `/rankings/daily/csv?${params.toString()}`
}

dailyRankingsRoute.get('/', async (c) => {
  const filters = parseRankingFilters(
    c.req.query('date'),
    c.req.query('market'),
    c.req.query('limit'),
  )
  if (!filters.ok) return c.text(filters.message, 400)

  const { date: dateRaw, market, limit } = filters
  const db = createDb(c.env.DATABASE_URL)
  const result = await listDailyTurnoverRankings(db, {
    date: dateRaw,
    market,
    limit,
  })

  return c.render(
    <div class="daily-ranking-wrap">
      <section class="search-block" style="margin-bottom:20px">
        <h1 class="search-label">売買代金ランキング</h1>
        <p class="empty-state" style="text-align:left;padding:0">
          J-Quantsの日足データから、売買代金上位銘柄と前取引日比を表示します。
          {result.date ? ` 対象日: ${result.date}` : ' 日足データは未同期です。'}
        </p>
      </section>

      <section class="card panel">
        <div class="panel-header">
          <span class="panel-title">表示条件</span>
          <span class="badge">{result.rows.length}件</span>
        </div>
        <div class="panel-body">
          <form method="get" action="/rankings/daily" class="daily-ranking-filter">
            <label>
              <span class="fg-label">取引日</span>
              <input class="input-sm" type="date" name="date" value={dateRaw ?? result.date ?? ''} />
            </label>
            <label>
              <span class="fg-label">市場</span>
              <select class="input-sm" name="market">
                <option value="">全市場</option>
                {DAILY_RANKING_MARKETS.map(candidate => (
                  <option key={candidate} value={candidate} selected={market === candidate}>{candidate}</option>
                ))}
              </select>
            </label>
            <label>
              <span class="fg-label">表示件数</span>
              <select class="input-sm" name="limit">
                {DAILY_RANKING_LIMITS.map(candidate => (
                  <option key={candidate} value={candidate} selected={limit === candidate}>{candidate}件</option>
                ))}
              </select>
            </label>
            <button class="btn-sm" type="submit">適用</button>
            <a class="btn-sm" href="/rankings/daily">最新日</a>
            <a class="btn-sm" href={dailyRankingCsvUrl(result.date, market, limit)}>CSVダウンロード</a>
          </form>
          {result.previousDate && (
            <p class="daily-ranking-note">騰落率の比較対象: {result.previousDate}（調整後終値）</p>
          )}
          <p class="daily-ranking-note">
            20日平均比は対象日を除く直前20営業日の売買代金平均との比較です。
            時価総額は対象日までに公表された通期発行済株式数から算出します。
          </p>
        </div>
      </section>

      <section class="card panel daily-ranking-panel">
        <div class="panel-header">
          <span class="panel-title">ランキング</span>
          <span class="badge">売買代金順</span>
        </div>
        <div class="daily-ranking-table-scroll">
          <table class="fav-table daily-ranking-table">
            <thead>
              <tr>
                <th class="r">順位</th>
                <th>コード</th>
                <th>銘柄名</th>
                <th>市場</th>
                <th class="r">市場内順位</th>
                <th>業種17分類</th>
                <th>業種33分類</th>
                <th class="r">業種内順位</th>
                <th>規模区分</th>
                <th class="r">調整後終値</th>
                <th class="r">前日比</th>
                <th class="r">騰落率</th>
                <th class="r">売買代金</th>
                <th class="r">20日平均比</th>
                <th class="r">時価総額</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr>
                  <td colspan={15} class="empty-state">
                    {result.date ? '指定日のランキングデータがありません' : '日足データがありません'}
                  </td>
                </tr>
              ) : result.rows.map(row => (
                <tr key={row.code}>
                  <td class="r daily-ranking-rank">{row.rank}</td>
                  <td><a href={`/stock/${row.code4}`}>{row.code4}</a></td>
                  <td><a href={`/stock/${row.code4}`}>{row.coName}</a></td>
                  <td>{row.market}</td>
                  <td class="r">{row.marketRank}</td>
                  <td>{row.sector17Name || '—'}</td>
                  <td>{row.sector33Name || '—'}</td>
                  <td class="r">{row.sectorRank}</td>
                  <td>{row.scaleCategory || '—'}</td>
                  <td class="r">{fmtPrice(row.close)}</td>
                  <td class={`r ${changeClass(row.change)}`}>{fmtChange(row.change)}</td>
                  <td class={`r ${changeClass(row.changePct)}`}>{fmtChangePct(row.changePct)}</td>
                  <td class="r daily-ranking-turnover">{fmtTurnover(row.turnover)}</td>
                  <td class="r">{fmtRatio(row.turnover20dRatio)}</td>
                  <td class="r">{fmtMarketCap(row.marketCap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>,
    { wide: true },
  )
})

dailyRankingsRoute.get('/csv', async (c) => {
  const filters = parseRankingFilters(
    c.req.query('date'),
    c.req.query('market'),
    c.req.query('limit'),
  )
  if (!filters.ok) return c.text(filters.message, 400)

  const db = createDb(c.env.DATABASE_URL)
  const result = await listDailyTurnoverRankings(db, {
    date: filters.date,
    market: filters.market,
    limit: filters.limit,
  })
  const datePart = result.date ?? filters.date ?? 'no-data'
  const marketPart = filters.market === 'プライム'
    ? 'prime'
    : filters.market === 'スタンダード'
      ? 'standard'
      : filters.market === 'グロース'
        ? 'growth'
        : 'all'

  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header(
    'Content-Disposition',
    `attachment; filename="daily-turnover-ranking_${datePart}_${marketPart}_${filters.limit}.csv"`,
  )
  return c.body(serializeDailyRankingCsv(result))
})
