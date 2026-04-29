import type { MetricId, MetricStats, VerdictResult } from '../../services/verdict/types'
import { METRIC_LABELS } from '../../services/verdict/types'
import { VerdictBadge } from './VerdictBadge'

interface Props {
  title: string
  metricIds: ReadonlyArray<MetricId>
  result: VerdictResult
}

function fmtValue(metricId: MetricId, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  switch (metricId) {
    case 'dividend_yield':
    case 'roe':
    case 'payout_ratio':
    case 'eps_cagr_3y':
    case 'net_cash_ratio':
      return `${value.toFixed(2)}%`
    case 'per_actual':
    case 'per_forecast':
    case 'pbr':
    case 'psr':
    case 'graham_ratio':
    case 'price_fcf':
    case 'per_pbr':
    case 'per_pbr_psr':
    case 'quad_dividend':
      return `${value.toFixed(2)}x`
    case 'de_ratio':
      return value.toFixed(2)
    default:
      return value.toFixed(2)
  }
}

function fmtPct(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—'
  return `${p.toFixed(1)}%`
}

function fmtScore(score: number, available: boolean): string {
  if (!available) return '—'
  return (score >= 0 ? '+' : '') + score.toFixed(2)
}

export function VerdictTable({ title, metricIds, result }: Props) {
  return (
    <div class="card verdict-table-card">
      <div class="card-header">
        <span class="card-title">{title}</span>
      </div>
      <div class="table-wrap">
        <table class="verdict-table">
          <thead>
            <tr>
              <th>指標</th>
              <th class="r">現在値</th>
              <th class="r">平均</th>
              <th class="r">中央値</th>
              <th class="r">Q1</th>
              <th class="r">Q3</th>
              <th class="r">%ile</th>
              <th>判定</th>
              <th class="r">スコア</th>
              <th class="r">重み</th>
            </tr>
          </thead>
          <tbody>
            {metricIds.map((id) => {
              const m: MetricStats | undefined = result.metrics[id]
              const label = METRIC_LABELS[id]
              if (!m) {
                return (
                  <tr key={id}>
                    <td>{label}</td>
                    <td class="r">—</td>
                    <td class="r">—</td>
                    <td class="r">—</td>
                    <td class="r">—</td>
                    <td class="r">—</td>
                    <td class="r">—</td>
                    <td>—</td>
                    <td class="r">—</td>
                    <td class="r">—</td>
                  </tr>
                )
              }
              return (
                <tr key={id} class={!m.available ? 'verdict-row-unavailable' : ''}>
                  <td>{label}</td>
                  <td class="r">{fmtValue(id, m.current)}</td>
                  <td class="r">{fmtValue(id, m.mean)}</td>
                  <td class="r">{fmtValue(id, m.median)}</td>
                  <td class="r">{fmtValue(id, m.q1)}</td>
                  <td class="r">{fmtValue(id, m.q3)}</td>
                  <td class="r">{fmtPct(m.percentile)}</td>
                  <td><VerdictBadge label={m.judgment.label} color={m.judgment.color} /></td>
                  <td class="r">{fmtScore(m.score, m.available)}</td>
                  <td class="r">{(m.weight * 100).toFixed(1)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
