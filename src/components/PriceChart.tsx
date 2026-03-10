/**
 * PriceChart — サーバーサイド SVG 株価チャート
 *
 * props.prices は getRecentPrices が返す配列（新しい順＝降順）を想定。
 * 内部で oldest-first に reverse してからプロット。
 */

type PriceRow = {
  date:      string
  adjClose?: string | null
  adjOpen?:  string | null
  adjHigh?:  string | null
  adjLow?:   string | null
  volume?:   string | null
}

type Props = { prices: PriceRow[] }

// SVG 内レイアウト定数
const W       = 700
const H       = 272
const PAD_L   = 52   // Y軸ラベル幅
const PAD_R   = 8
const PAD_TOP = 12
const DIVIDER = 186  // 価格エリアと出来高エリアの境界 Y
const VOL_TOP = 193  // 出来高バー上端
const VOL_BOT = 255  // 出来高バー下端
const LABEL_Y = 267  // X軸ラベル Y座標

const CHART_W = W - PAD_L - PAD_R
const PRICE_H = DIVIDER - PAD_TOP  // 価格プロット高さ

function lerp(v: number, inMin: number, inMax: number, outMin: number, outMax: number) {
  if (inMax === inMin) return (outMin + outMax) / 2
  return outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin)
}

export function PriceChart({ prices }: Props) {
  // 有効な close を持つ行のみ、oldest-first で並べる
  const rows = prices
    .filter(p => p.adjClose && parseFloat(p.adjClose) > 0)
    .reverse()

  if (rows.length < 2) {
    return (
      <div style="padding:60px 20px;text-align:center;color:var(--muted-fg);font-size:13px">
        価格データが不足しています（2件以上必要）
      </div>
    )
  }

  const n = rows.length
  const closes  = rows.map(r => parseFloat(r.adjClose!))
  const volumes = rows.map(r => r.volume ? parseFloat(r.volume) : 0)

  const closeMin = Math.min(...closes)
  const closeMax = Math.max(...closes)
  const volMax   = Math.max(...volumes, 1)

  // ── 価格ポイント ──
  const pts: Array<{ x: number; y: number; row: PriceRow; close: number }> = rows.map((row, i) => ({
    x:     PAD_L + lerp(i, 0, n - 1, 0, CHART_W),
    y:     lerp(closes[i], closeMin, closeMax, DIVIDER - 4, PAD_TOP + 4),
    row,
    close: closes[i],
  }))

  // ── 価格ライン polyline ──
  const polylinePoints = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // ── 価格エリア（グラデーション塗り）path ──
  const areaD = [
    `M ${pts[0].x.toFixed(1)},${DIVIDER}`,
    ...pts.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `L ${pts[n - 1].x.toFixed(1)},${DIVIDER}`,
    'Z',
  ].join(' ')

  // ── 出来高バー ──
  const barW = Math.max(1, CHART_W / n - 1)
  const volBars = rows.map((row, i) => {
    const barH = lerp(volumes[i], 0, volMax, 0, VOL_BOT - VOL_TOP)
    const bx   = PAD_L + lerp(i, 0, n - 1, 0, CHART_W) - barW / 2
    const by   = VOL_BOT - barH
    // 前日比で色分け
    const prev = i > 0 ? closes[i - 1] : closes[i]
    const cls  = closes[i] >= prev ? 'vol-bar-up' : 'vol-bar-down'
    return { bx: bx.toFixed(1), by: by.toFixed(1), barH: barH.toFixed(1), cls }
  })

  // ── Y軸ラベル（価格）: 3本 ──
  const yLabels = [closeMax, (closeMax + closeMin) / 2, closeMin].map((v, i) => {
    const y = [PAD_TOP + 4, (PAD_TOP + DIVIDER) / 2, DIVIDER - 4][i]
    return { label: v.toLocaleString(undefined, { maximumFractionDigits: 0 }), y }
  })

  // ── X軸ラベル（日付）: 最大5本 ──
  const labelStep = Math.max(1, Math.floor(n / 5))
  const xLabels: Array<{ label: string; x: number }> = []
  for (let i = 0; i < n; i += labelStep) {
    xLabels.push({
      label: rows[i].date.slice(5),   // "MM-DD"
      x:     PAD_L + lerp(i, 0, n - 1, 0, CHART_W),
    })
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      class="chart-svg"
      aria-label="株価チャート"
    >
      {/* 横グリッド線 3本 */}
      {yLabels.map(({ y }) => (
        <line
          class="chart-grid"
          x1={PAD_L} y1={y.toFixed(1)}
          x2={W - PAD_R} y2={y.toFixed(1)}
        />
      ))}
      {/* 出来高区切り線 */}
      <line
        class="chart-grid"
        x1={PAD_L} y1={DIVIDER}
        x2={W - PAD_R} y2={DIVIDER}
      />

      {/* Y軸ラベル */}
      {yLabels.map(({ label, y }) => (
        <text class="chart-label" x={(PAD_L - 4).toFixed(0)} y={(y + 3).toFixed(1)} text-anchor="end">
          {label}
        </text>
      ))}

      {/* X軸ラベル */}
      {xLabels.map(({ label, x }) => (
        <text class="chart-label" x={x.toFixed(1)} y={LABEL_Y} text-anchor="middle">
          {label}
        </text>
      ))}

      {/* 価格エリア */}
      <path class="price-area" d={areaD} />

      {/* 価格ライン */}
      <polyline class="price-line" points={polylinePoints} />

      {/* 出来高バー */}
      {volBars.map((b, i) => (
        <rect
          class={b.cls}
          x={b.bx} y={b.by}
          width={barW.toFixed(1)} height={b.barH}
          key={i}
        />
      ))}
    </svg>
  )
}
