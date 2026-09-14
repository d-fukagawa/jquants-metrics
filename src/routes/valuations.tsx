import { Hono } from 'hono'
import { createDb } from '../db/client'
import {
  listValuationRankings,
  VALUATION_LIMITS,
  VALUATION_MARKETS,
  VALUATION_PERIODS,
  VALUATION_RANKINGS,
  type ValuationLimit,
  type ValuationMarket,
  type ValuationPeriod,
  type ValuationRanking,
  type ValuationRankingRow,
} from '../services/valuationService'
import type { Bindings } from '../types'
import { serializeValuationRankingCsv } from '../services/valuationCsvService'

export const valuationsRoute = new Hono<{ Bindings: Bindings }>()

const periodLabels: Record<ValuationPeriod, string> = {
  previous: '前回観測',
  '1m': '1か月',
  '3m': '3か月',
}

const rankingLabels: Record<ValuationRanking, string> = {
  eps_up: 'EPS上昇',
  eps_down: 'EPS低下',
  eps_up_per_down: 'EPS上昇・PER低下',
  expectation_driven: '期待先行',
  historically_cheap: '最大5年PER低位',
  roe_improvement: 'ROE改善',
  forecast_growth: 'TTM→会社予想EPS成長',
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parseOneOf<T extends string>(value: string | undefined, values: readonly T[]): T | undefined {
  return values.find(candidate => candidate === value)
}

type ParsedFilters =
  | {
      ok: true
      date: string | undefined
      market: ValuationMarket | undefined
      period: ValuationPeriod
      ranking: ValuationRanking
      limit: ValuationLimit
    }
  | { ok: false; message: string }

function parseFilters(
  dateValue: string | undefined,
  marketValue: string | undefined,
  periodValue: string | undefined,
  rankingValue: string | undefined,
  limitValue: string | undefined,
): ParsedFilters {
  const date = dateValue?.trim() || undefined
  if (date && !isIsoDate(date)) return { ok: false, message: 'Invalid date' }

  const marketRaw = marketValue?.trim() || undefined
  const market = parseOneOf(marketRaw, VALUATION_MARKETS)
  if (marketRaw && !market) return { ok: false, message: 'Invalid market' }

  const periodRaw = periodValue?.trim() || 'previous'
  const period = parseOneOf(periodRaw, VALUATION_PERIODS)
  if (!period) return { ok: false, message: 'Invalid period' }

  const rankingRaw = rankingValue?.trim() || 'eps_up'
  const ranking = parseOneOf(rankingRaw, VALUATION_RANKINGS)
  if (!ranking) return { ok: false, message: 'Invalid ranking' }

  const limitNumber = Number(limitValue)
  const limit = VALUATION_LIMITS.find(candidate => candidate === limitNumber) ?? 50
  return { ok: true, date, market, period, ranking, limit }
}

function fmtNumber(value: number | null, digits = 2): string {
  return value == null
    ? '—'
    : value.toLocaleString('ja-JP', { maximumFractionDigits: digits })
}

function fmtPct(value: number | null): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

function fmtRoe(value: number | null): string {
  return value == null ? '—' : `${(value * 100).toFixed(2)}%`
}

function fmtPoint(value: number | null): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}pt`
}

function fmtMultiple(value: number | null): string {
  return value == null ? '—' : `${fmtNumber(value)}倍`
}

function fmtMarketCap(value: number | null): string {
  return value == null ? '—' : `${Math.round(value / 100).toLocaleString('ja-JP')} 億円`
}

function PerHistoryCell({
  percentile,
  median,
  count,
  startDate,
}: {
  percentile: number | null
  median: number | null
  count: number
  startDate?: string | null
}) {
  return (
    <span class="valuation-history-cell">
      <strong>{percentile == null ? '—' : `${percentile.toFixed(1)}%ile`}</strong>
      <small>中央値 {median == null ? '—' : `${median.toFixed(2)}倍`} · n={count}</small>
      {startDate && <small>開始 {startDate}</small>}
    </span>
  )
}

function changeClass(value: number | null): string {
  if (value == null || value === 0) return ''
  return value > 0 ? 'up' : 'down'
}

function judgmentClass(judgment: ValuationRankingRow['judgment']): string {
  if (judgment === 'EPS上昇・PER低下') return 'valuation-badge--strong'
  if (judgment === '業績優位') return 'valuation-badge--positive'
  if (judgment === '期待先行') return 'valuation-badge--warning'
  return 'valuation-badge--muted'
}

function valuationCsvUrl(
  date: string | null,
  filters: Extract<ParsedFilters, { ok: true }>,
): string {
  const params = new URLSearchParams({
    period: filters.period,
    ranking: filters.ranking,
    limit: String(filters.limit),
  })
  if (date) params.set('date', date)
  if (filters.market) params.set('market', filters.market)
  return `/valuations/csv?${params.toString()}`
}

valuationsRoute.get('/', async (c) => {
  const filters = parseFilters(
    c.req.query('date'),
    c.req.query('market'),
    c.req.query('period'),
    c.req.query('ranking'),
    c.req.query('limit'),
  )
  if (!filters.ok) return c.text(filters.message, 400)

  const { date, market, period, ranking, limit } = filters
  const result = await listValuationRankings(createDb(c.env.DATABASE_URL), {
    date,
    market,
    period,
    ranking,
    limit,
  })

  return c.render(
    <div class="valuation-wrap">
      <section class="search-block" style="margin-bottom:20px">
        <h1 class="search-label">業績・バリュエーション変化</h1>
        <p class="empty-state" style="text-align:left;padding:0">
          J-Quantsの日次TTM・会社予想指標から、EPS、予想PER、株価の変化を比較します。
          {result.date ? ` 基準日: ${result.date}` : ' バリュエーションデータは未同期です。'}
        </p>
      </section>

      <section class="card panel">
        <div class="panel-header">
          <span class="panel-title">表示条件</span>
          <span class="badge">{result.rows.length}件</span>
        </div>
        <div class="panel-body">
          <form method="get" action="/valuations" class="daily-ranking-filter valuation-filter">
            <label>
              <span class="fg-label">基準日</span>
              <input class="input-sm" type="date" name="date" value={filters.date ?? result.date ?? ''} />
            </label>
            <label>
              <span class="fg-label">比較期間</span>
              <select class="input-sm" name="period">
                {VALUATION_PERIODS.map(period => (
                  <option key={period} value={period} selected={filters.period === period}>
                    {periodLabels[period]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span class="fg-label">ランキング</span>
              <select class="input-sm" name="ranking">
                {VALUATION_RANKINGS.map(ranking => (
                  <option key={ranking} value={ranking} selected={filters.ranking === ranking}>
                    {rankingLabels[ranking]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span class="fg-label">市場</span>
              <select class="input-sm" name="market">
                <option value="">全市場</option>
                {VALUATION_MARKETS.map(market => (
                  <option key={market} value={market} selected={filters.market === market}>{market}</option>
                ))}
              </select>
            </label>
            <label>
              <span class="fg-label">表示件数</span>
              <select class="input-sm" name="limit">
                {VALUATION_LIMITS.map(limit => (
                  <option key={limit} value={limit} selected={filters.limit === limit}>{limit}件</option>
                ))}
              </select>
            </label>
            <button class="btn-sm" type="submit">適用</button>
            <a class="btn-sm" href="/valuations">最新日</a>
            <a class="btn-sm" href={valuationCsvUrl(result.date, filters)}>CSVダウンロード</a>
          </form>
          <p class="daily-ranking-note">
            Fwdはアナリスト予想ではなく会社予想です。EPS変化は修正候補であり、決算開示や株式分割等を確認してください。
            期待先行は株価変化率がEPS変化率を10ポイント以上上回る状態です。
          </p>
          <p class="daily-ranking-note">
            PER位置は正の会社予想PERだけを使用します。「最大5年」は保存済み期間内の最大5年で、開始日と観測数を併記します。
            最大5年PER低位ランキングは観測200件以上かつ20 percentile以下が対象です。
          </p>
        </div>
      </section>

      <section class="card panel daily-ranking-panel">
        <div class="panel-header">
          <span class="panel-title">{rankingLabels[filters.ranking]}</span>
          <span class="badge">比較: {periodLabels[filters.period]}</span>
        </div>
        <div class="daily-ranking-table-scroll">
          <table class="fav-table valuation-table">
            <thead>
              <tr>
                <th class="r">順位</th>
                <th>コード</th>
                <th>銘柄名</th>
                <th>市場</th>
                <th>比較日</th>
                <th class="r">会社予想EPS</th>
                <th class="r">比較EPS</th>
                <th class="r">EPS変化</th>
                <th class="r">EPS変化率</th>
                <th class="r">会社予想PER</th>
                <th class="r">PER変化率</th>
                <th class="r">調整後終値</th>
                <th class="r">株価変化率</th>
                <th class="r">EPS−株価</th>
                <th class="r">1か月 EPS−株価</th>
                <th class="r">3か月 EPS−株価</th>
                <th class="r">予想対TTM EPS</th>
                <th class="r">TTM ROE</th>
                <th class="r">会社予想ROE</th>
                <th class="r">ROE差</th>
                <th class="r">時価総額</th>
                <th class="r">1年PER位置</th>
                <th class="r">3年PER位置</th>
                <th class="r">最大5年PER位置</th>
                <th>判定・確認</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr>
                  <td colspan={25} class="empty-state">
                    {result.date ? '指定条件のバリュエーション変化がありません' : 'バリュエーションデータがありません'}
                  </td>
                </tr>
              ) : result.rows.map(row => (
                <tr key={row.code}>
                  <td class="r daily-ranking-rank">{row.rank}</td>
                  <td><a href={`/stock/${row.code4}`}>{row.code4}</a></td>
                  <td><a href={`/stock/${row.code4}`}>{row.coName}</a></td>
                  <td>{row.market}</td>
                  <td>{row.comparisonDate ?? '—'}</td>
                  <td class="r">{fmtNumber(row.epsCompanyForecast)}</td>
                  <td class="r">{fmtNumber(row.previousEpsCompanyForecast)}</td>
                  <td class={`r ${changeClass(row.epsChange)}`}>{fmtNumber(row.epsChange)}</td>
                  <td class={`r ${changeClass(row.epsChangePct)}`}>{fmtPct(row.epsChangePct)}</td>
                  <td class="r">{fmtMultiple(row.perCompanyForecast)}</td>
                  <td class={`r ${changeClass(row.perChangePct)}`}>{fmtPct(row.perChangePct)}</td>
                  <td class="r">{fmtNumber(row.close)}</td>
                  <td class={`r ${changeClass(row.priceChangePct)}`}>{fmtPct(row.priceChangePct)}</td>
                  <td class={`r ${changeClass(row.epsPriceGapPct)}`}>{fmtPct(row.epsPriceGapPct)}</td>
                  <td class={`r ${changeClass(row.epsPriceGap1mPct)}`}>{fmtPct(row.epsPriceGap1mPct)}</td>
                  <td class={`r ${changeClass(row.epsPriceGap3mPct)}`}>{fmtPct(row.epsPriceGap3mPct)}</td>
                  <td class={`r ${changeClass(row.forecastVsTtmEpsPct)}`}>{fmtPct(row.forecastVsTtmEpsPct)}</td>
                  <td class="r">{fmtRoe(row.roeTtm)}</td>
                  <td class="r">{fmtRoe(row.roeCompanyForecast)}</td>
                  <td class={`r ${changeClass(row.roeImprovementPoint)}`}>{fmtPoint(row.roeImprovementPoint)}</td>
                  <td class="r">{fmtMarketCap(row.marketCapMillion)}</td>
                  <td class="r">
                    <PerHistoryCell
                      percentile={row.perPercentile1y}
                      median={row.perMedian1y}
                      count={row.perObservationCount1y}
                    />
                  </td>
                  <td class="r">
                    <PerHistoryCell
                      percentile={row.perPercentile3y}
                      median={row.perMedian3y}
                      count={row.perObservationCount3y}
                    />
                  </td>
                  <td class="r">
                    <PerHistoryCell
                      percentile={row.perPercentile5y}
                      median={row.perMedian5y}
                      count={row.perObservationCount5y}
                      startDate={row.perHistoryStartDate}
                    />
                  </td>
                  <td>
                    <span class={`valuation-badge ${judgmentClass(row.judgment)}`}>{row.judgment}</span>
                    {row.hasFinancialDisclosure && <span class="valuation-flag">期間内決算開示あり</span>}
                    {row.corporateActionSuspected && <span class="valuation-flag valuation-flag--warning">株式分割等の可能性</span>}
                  </td>
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

valuationsRoute.get('/csv', async (c) => {
  const filters = parseFilters(
    c.req.query('date'),
    c.req.query('market'),
    c.req.query('period'),
    c.req.query('ranking'),
    c.req.query('limit'),
  )
  if (!filters.ok) return c.text(filters.message, 400)

  const { date, market, period, ranking, limit } = filters
  const result = await listValuationRankings(createDb(c.env.DATABASE_URL), {
    date,
    market,
    period,
    ranking,
    limit,
  })
  const filenameDate = result.date ?? date ?? 'no-data'
  const filenameMarket = market === 'プライム'
    ? 'prime'
    : market === 'スタンダード'
      ? 'standard'
      : market === 'グロース'
        ? 'growth'
        : 'all'

  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header(
    'Content-Disposition',
    `attachment; filename="valuation-ranking_${filenameDate}_${period}_${ranking}_${filenameMarket}_${limit}.csv"`,
  )
  return c.body(serializeValuationRankingCsv(result, period))
})
