/**
 * MetricsCard — PER / PBR / ROE / 配当利回り 指標カード
 */

type Metrics = {
  per:        number | null
  pbr:        number | null
  roe:        number | null
  divYield:   number | null
  eps:        number | null
  bps:        number | null
  divAnn:     number | null
  curPerType: string | null
  discDate:   string | null
}

type Props = { metrics: Metrics }

export function MetricsCard({ metrics }: Props) {
  return (
    <div class="card">
      <div class="card-header">
        <span class="card-title">財務指標</span>
        <span class="card-sub">
          {metrics.curPerType ?? '—'}{metrics.discDate ? ` ${metrics.discDate}` : ''}
        </span>
      </div>
      <div class="card-body">
        <div class="metrics-section">
          <div class="metrics-section-label">株式指標</div>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-label">PER</div>
              <div class="metric-value">{metrics.per !== null ? `${metrics.per}x` : '—'}</div>
              <div class="metric-sub">EPS {metrics.eps !== null ? `¥${metrics.eps}` : '—'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">PBR</div>
              <div class="metric-value">{metrics.pbr !== null ? `${metrics.pbr}x` : '—'}</div>
              <div class="metric-sub">BPS {metrics.bps !== null ? `¥${metrics.bps.toLocaleString()}` : '—'}</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">ROE</div>
              <div class="metric-value">{metrics.roe !== null ? `${metrics.roe}%` : '—'}</div>
              <div class="metric-sub">NP / 自己資本</div>
            </div>
            <div class="metric-card">
              <div class="metric-label">配当利回り</div>
              <div class="metric-value">{metrics.divYield !== null ? `${metrics.divYield}%` : '—'}</div>
              <div class="metric-sub">年間 {metrics.divAnn !== null ? `¥${metrics.divAnn}` : '—'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
