import type { StockValuationPoint } from '../services/stockValuationService'

type Metric = 'close' | 'epsCompanyForecast' | 'perCompanyForecast'

interface IndexedPoint {
  date: string
  value: number
}

export interface IndexedValuationSeries {
  close: IndexedPoint[]
  epsCompanyForecast: IndexedPoint[]
  perCompanyForecast: IndexedPoint[]
}

const WIDTH = 760
const HEIGHT = 300
const PAD_LEFT = 48
const PAD_RIGHT = 16
const PAD_TOP = 24
const PAD_BOTTOM = 34

function lerp(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMin === inMax) return (outMin + outMax) / 2
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin)
}

function indexMetric(rows: StockValuationPoint[], metric: Metric): IndexedPoint[] {
  const values = rows
    .map(row => ({ date: row.date, value: row[metric] }))
    .filter((row): row is { date: string; value: number } => row.value != null && row.value > 0)
  const base = values[0]?.value
  if (base == null) return []
  return values.map(row => ({ date: row.date, value: (row.value / base) * 100 }))
}

export function buildIndexedValuationSeries(rows: StockValuationPoint[]): IndexedValuationSeries {
  const ordered = [...rows].sort((left, right) => left.date.localeCompare(right.date))
  return {
    close: indexMetric(ordered, 'close'),
    epsCompanyForecast: indexMetric(ordered, 'epsCompanyForecast'),
    perCompanyForecast: indexMetric(ordered, 'perCompanyForecast'),
  }
}

export function ValuationTrendChart({ rows }: { rows: StockValuationPoint[] }) {
  const ordered = [...rows].sort((left, right) => left.date.localeCompare(right.date))
  const indexed = buildIndexedValuationSeries(ordered)
  const series = [
    { key: 'close', label: '株価', className: 'valuation-line-close', points: indexed.close },
    { key: 'eps', label: '会社予想EPS', className: 'valuation-line-eps', points: indexed.epsCompanyForecast },
    { key: 'per', label: '会社予想PER', className: 'valuation-line-per', points: indexed.perCompanyForecast },
  ]
  const allValues = series.flatMap(item => item.points.map(point => point.value))

  if (ordered.length < 2 || allValues.length < 2) {
    return <p class="empty-state">指数化チャートには2日以上の正の値が必要です。</p>
  }

  const minValue = Math.min(...allValues)
  const maxValue = Math.max(...allValues)
  const rangePadding = Math.max((maxValue - minValue) * 0.1, 2)
  const chartMin = minValue - rangePadding
  const chartMax = maxValue + rangePadding
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM
  const dateIndex = new Map(ordered.map((row, index) => [row.date, index]))
  const lines = series.map(item => ({
    ...item,
    polyline: item.points.map(point => {
      const index = dateIndex.get(point.date) ?? 0
      const x = lerp(index, 0, ordered.length - 1, PAD_LEFT, PAD_LEFT + plotWidth)
      const y = lerp(point.value, chartMin, chartMax, PAD_TOP + plotHeight, PAD_TOP)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' '),
  }))
  const yLabels = [chartMax, (chartMax + chartMin) / 2, chartMin]
  const labelStep = Math.max(1, Math.floor((ordered.length - 1) / 4))
  const xIndexes = Array.from(new Set([
    0,
    ...ordered.map((_, index) => index).filter(index => index % labelStep === 0),
    ordered.length - 1,
  ]))

  return (
    <div class="valuation-trend-chart">
      <div class="valuation-chart-legend">
        {lines.map(line => (
          <span key={line.key}><i class={line.className}></i>{line.label}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} class="chart-svg" aria-label="株価・会社予想EPS・会社予想PERの指数化チャート">
        {yLabels.map(value => {
          const y = lerp(value, chartMin, chartMax, PAD_TOP + plotHeight, PAD_TOP)
          return (
            <g key={value}>
              <line class="chart-grid" x1={PAD_LEFT} y1={y} x2={WIDTH - PAD_RIGHT} y2={y} />
              <text class="chart-label" x={PAD_LEFT - 5} y={y + 4} text-anchor="end">{value.toFixed(0)}</text>
            </g>
          )
        })}
        {xIndexes.map(index => {
          const x = lerp(index, 0, ordered.length - 1, PAD_LEFT, PAD_LEFT + plotWidth)
          return (
            <text key={ordered[index].date} class="chart-label" x={x} y={HEIGHT - 10} text-anchor="middle">
              {ordered[index].date.slice(5)}
            </text>
          )
        })}
        {lines.map(line => line.polyline && (
          <polyline key={line.key} class={`valuation-trend-line ${line.className}`} points={line.polyline} />
        ))}
      </svg>
    </div>
  )
}
