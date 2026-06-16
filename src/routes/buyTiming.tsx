import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import {
  backtestBuyTiming,
  type BuyTimingBacktestResult,
  type BuyTimingParams,
} from '../lib/buyTimingBacktest'
import { listBuyTimingBars } from '../services/buyTimingService'
import { parseCode4, toCode5 } from '../utils/stockCode'

export const buyTimingRoute = new Hono<{ Bindings: Bindings }>()
export const buyTimingApiRoute = new Hono<{ Bindings: Bindings }>()

const DEFAULT_CODE = '0000'
const DEFAULT_THRESHOLD = 0.03
const DEFAULT_REF_WINDOW = 20
const DEFAULT_COOLDOWN = 15
const MIN_BARS_FOR_ANNUALIZED = 20

type BuyTimingQuery = BuyTimingParams & {
  code4: string
  code5: string
  from: string
  to: string
}

type BuyTimingViewModel = {
  query: BuyTimingQuery
  result: BuyTimingBacktestResult
  barsCount: number
  error: string | null
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function defaultDateRange(): { from: string; to: string } {
  const toDate = new Date()
  toDate.setUTCHours(0, 0, 0, 0)
  const fromDate = new Date(toDate)
  fromDate.setUTCFullYear(fromDate.getUTCFullYear() - 2)
  return {
    from: fromDate.toISOString().slice(0, 10),
    to: toDate.toISOString().slice(0, 10),
  }
}

function parseBuyTimingQuery(get: (key: string) => string | undefined): { query: BuyTimingQuery; error: string | null } {
  const defaults = defaultDateRange()
  const code4 = parseCode4(get('code') ?? DEFAULT_CODE)
  const from = get('from') ?? defaults.from
  const to = get('to') ?? defaults.to
  const thresholdRaw = get('threshold')
  const refWindowRaw = get('refWindow')
  const cooldownRaw = get('cooldown')
  const threshold = thresholdRaw == null || thresholdRaw.trim() === '' ? DEFAULT_THRESHOLD : Number(thresholdRaw)
  const refWindow = refWindowRaw == null || refWindowRaw.trim() === '' ? DEFAULT_REF_WINDOW : Number(refWindowRaw)
  const cooldown = cooldownRaw == null || cooldownRaw.trim() === '' ? DEFAULT_COOLDOWN : Number(cooldownRaw)

  let error: string | null = null
  if (!code4) {
    error = 'code must be a 4-char alphanumeric'
  } else if (!Number.isFinite(threshold) || threshold <= 0) {
    error = 'threshold must be > 0'
  } else if (!Number.isInteger(refWindow) || refWindow < 1) {
    error = 'refWindow must be an integer >= 1'
  } else if (!Number.isInteger(cooldown) || cooldown < 0) {
    error = 'cooldown must be an integer >= 0'
  } else if (!isDate(from) || !isDate(to)) {
    error = 'from/to must be YYYY-MM-DD'
  } else if (from > to) {
    error = 'from must be <= to'
  }

  const safeCode4 = code4 ?? DEFAULT_CODE
  return {
    query: {
      code4: safeCode4,
      code5: toCode5(safeCode4),
      threshold,
      refWindow,
      cooldown,
      from: isDate(from) ? from : defaults.from,
      to: isDate(to) ? to : defaults.to,
    },
    error,
  }
}

async function runBacktest(db: ReturnType<typeof createDb>, query: BuyTimingQuery) {
  const bars = await listBuyTimingBars(db, {
    code5: query.code5,
    from: query.from,
    to: query.to,
  })
  return {
    barsCount: bars.length,
    result: backtestBuyTiming(bars, {
      threshold: query.threshold,
      refWindow: query.refWindow,
      cooldown: query.cooldown,
    }),
  }
}

function emptyResult(): BuyTimingBacktestResult {
  return {
    triggers: [],
    count: 0,
    years: 0,
    perYear: null,
  }
}

function fmtPrice(value: number): string {
  return value.toLocaleString('ja-JP', { maximumFractionDigits: 2 })
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function fmtSigned(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}

function canShowPerYear(model: BuyTimingViewModel): boolean {
  return model.barsCount >= MIN_BARS_FOR_ANNUALIZED && model.result.perYear !== null
}

function metricValue(id: string, value: string, className = 'metric-value') {
  return <div id={id} class={className}>{value}</div>
}

function renderTriggerRows(result: BuyTimingBacktestResult) {
  if (result.triggers.length === 0) {
    return (
      <tr id="buy-timing-empty-row">
        <td colspan={4} class="empty-state">発動履歴はありません</td>
      </tr>
    )
  }

  return result.triggers
    .slice()
    .reverse()
    .map(trigger => (
      <tr key={trigger.date}>
        <td>{trigger.date}</td>
        <td class="r">{fmtPrice(trigger.price)}</td>
        <td class="r">{fmtPrice(trigger.ref)}</td>
        <td class="r down">{fmtPct(trigger.drawdown)}</td>
      </tr>
    ))
}

function page(model: BuyTimingViewModel) {
  const showPerYear = canShowPerYear(model)
  const perYear = showPerYear && model.result.perYear !== null ? model.result.perYear : null
  const targetDiff = perYear === null ? null : perYear - 6
  const thresholdPct = (model.query.threshold * 100).toFixed(1)
  const sourceNote = model.barsCount === 0
    ? '指定期間の日次終値がありません。code/from/to を確認してください。'
    : model.barsCount < MIN_BARS_FOR_ANNUALIZED
      ? `データ本数が少なすぎます（${model.barsCount}本）。年換算は表示しません。`
      : `検証データ ${model.barsCount.toLocaleString('ja-JP')}本。調整後終値を優先して計算します。`

  return (
    <div class="screen-wrap buy-timing-wrap">
      <aside class="screen-sidebar">
        <div class="panel">
          <div class="panel-header">
            <span class="panel-title">6回/年に逆算（推奨初期値）</span>
            <a href="/buy-timing" class="btn-sm">リセット</a>
          </div>
          <form id="buy-timing-form" method="get" action="/buy-timing" class="panel-body">
            <div>
              <label class="fg-label" for="buy-code">コード</label>
              <input id="buy-code" class="input-sm" type="text" name="code" value={model.query.code4} maxlength={5} />
            </div>

            <div>
              <div class="buy-timing-label-row">
                <label class="fg-label" for="buy-threshold">threshold</label>
                <span id="buy-threshold-label" class="badge">-{thresholdPct}%</span>
              </div>
              <input
                id="buy-threshold"
                class="input-sm"
                type="number"
                name="threshold"
                min="0.01"
                max="0.10"
                step="0.005"
                value={model.query.threshold}
              />
              <input
                id="buy-threshold-range"
                class="buy-timing-range"
                type="range"
                min="0.01"
                max="0.10"
                step="0.005"
                value={model.query.threshold}
                aria-label="threshold slider"
              />
            </div>

            <div>
              <label class="fg-label" for="buy-ref-window">refWindow（日）</label>
              <input
                id="buy-ref-window"
                class="input-sm"
                type="number"
                name="refWindow"
                min="5"
                max="120"
                step="5"
                value={model.query.refWindow}
              />
            </div>

            <div>
              <label class="fg-label" for="buy-cooldown">cooldown（営業日）</label>
              <input
                id="buy-cooldown"
                class="input-sm"
                type="number"
                name="cooldown"
                min="0"
                max="60"
                step="1"
                value={model.query.cooldown}
              />
            </div>

            <hr class="divider" />

            <div>
              <label class="fg-label" for="buy-from">FROM</label>
              <input id="buy-from" class="input-sm" type="date" name="from" value={model.query.from} />
            </div>
            <div>
              <label class="fg-label" for="buy-to">TO</label>
              <input id="buy-to" class="input-sm" type="date" name="to" value={model.query.to} />
            </div>

            <button id="buy-timing-submit" class="btn btn-primary" type="submit" style="width:100%;height:36px;font-size:13px">
              検証する
            </button>
          </form>
        </div>
      </aside>

      <section class="screen-main">
        <section class="search-block buy-timing-header">
          <h1 class="search-label">日経平均の押し目買いタイミング</h1>
          <p class="empty-state" style="text-align:left;padding:0">
            直近N営業日の参照高値からの下落率とクールダウンを調整し、年6回前後の発動条件を探索します。
          </p>
        </section>

        {model.error && (
          <div id="buy-timing-error" class="theme-error-banner">{model.error}</div>
        )}
        {!model.error && (
          <div id="buy-timing-error" class="theme-error-banner buy-timing-hidden"></div>
        )}

        <div class="metrics-grid buy-timing-metrics">
          <div class="metric-card">
            <div class="metric-label">発動回数</div>
            {metricValue('buy-count', model.result.count.toLocaleString('ja-JP'))}
            <div id="buy-count-sub" class="metric-sub">{model.query.from} 〜 {model.query.to}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">年あたり発動回数</div>
            {metricValue('buy-per-year', perYear === null ? '—' : perYear.toFixed(1))}
            <div id="buy-per-year-sub" class="metric-sub">{showPerYear ? '245営業日で年換算' : 'データ不足'}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">検証期間</div>
            {metricValue('buy-years', showPerYear ? model.result.years.toFixed(1) : '—')}
            <div id="buy-years-sub" class="metric-sub">{model.barsCount.toLocaleString('ja-JP')}本</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">目標6との差</div>
            {metricValue(
              'buy-target-diff',
              targetDiff === null ? '—' : fmtSigned(targetDiff),
              `metric-value ${targetDiff == null || Math.abs(targetDiff) <= 1 ? '' : targetDiff > 0 ? 'down' : 'up'}`,
            )}
            <div id="buy-target-sub" class="metric-sub">0に近いほど目標に近い</div>
          </div>
        </div>

        <p id="buy-timing-note" class="empty-state buy-timing-note">
          {sourceNote}
        </p>

        <section class="card panel">
          <div class="panel-header">
            <span class="panel-title">発動履歴</span>
            <span id="buy-history-badge" class="badge">日付降順</span>
          </div>
          <div class="table-wrap">
            <table class="screen-table buy-timing-table">
              <thead>
                <tr>
                  <th>日付</th>
                  <th class="r">約定価格</th>
                  <th class="r">参照高値</th>
                  <th class="r">ドローダウン</th>
                </tr>
              </thead>
              <tbody id="buy-timing-history">
                {renderTriggerRows(model.result)}
              </tbody>
            </table>
          </div>
        </section>

        <section class="card panel buy-timing-chart-placeholder">
          <div class="panel-header">
            <span class="panel-title">チャート</span>
            <span class="badge">後続対応</span>
          </div>
          <div class="panel-body">
            <p class="empty-state" style="padding:0;text-align:left">
              終値折れ線と発動点マーカーは後続で追加します。今回は履歴テーブルを正として確認します。
            </p>
          </div>
        </section>
      </section>

      <script src="/static/buy-timing.js"></script>
    </div>
  )
}

buyTimingRoute.get('/', async (c) => {
  const parsed = parseBuyTimingQuery(key => c.req.query(key))
  const db = createDb(c.env.DATABASE_URL)
  const data = parsed.error
    ? { barsCount: 0, result: emptyResult() }
    : await runBacktest(db, parsed.query)

  return c.render(page({
    query: parsed.query,
    result: data.result,
    barsCount: data.barsCount,
    error: parsed.error,
  }), { wide: true })
})

buyTimingApiRoute.get('/backtest', async (c) => {
  const parsed = parseBuyTimingQuery(key => c.req.query(key))
  if (parsed.error) {
    return c.json({ error: parsed.error }, 400)
  }

  const db = createDb(c.env.DATABASE_URL)
  const data = await runBacktest(db, parsed.query)
  return c.json({
    ...data.result,
    barsCount: data.barsCount,
    params: {
      code: parsed.query.code4,
      threshold: parsed.query.threshold,
      refWindow: parsed.query.refWindow,
      cooldown: parsed.query.cooldown,
      from: parsed.query.from,
      to: parsed.query.to,
    },
  })
})
