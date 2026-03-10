# src/components/ — JSX コンポーネント

サーバーサイドで HTML をレンダリングする JSX コンポーネントのディレクトリ。
クライアントサイド JS は使わない（MVP では SSR のみ）。

## 現在のコンポーネント

| ファイル | 役割 |
|---------|------|
| `MetricsCard.tsx` | PER/PBR/ROE を表示するカード |
| `PriceChart.tsx` | 株価折れ線グラフ（SVG、サーバーサイド生成） |

## パターン

### 基本的な JSX コンポーネント

```tsx
// Hono の JSX（React ではない）
// className ではなく class を使う
interface Props {
  per: number | null
  pbr: number | null
  roe: number | null
}

export const MetricsCard = ({ per, pbr, roe }: Props) => (
  <div class="metrics-card">
    <dl>
      <dt>PER</dt>
      <dd>{per !== null ? `${per.toFixed(1)}x` : '—'}</dd>
    </dl>
  </div>
)
```

### SVG チャート（サーバーサイド生成）

```tsx
// DailyPrice[] を受け取り、SVG パスを計算して返す
// クライアントサイドの JS ライブラリは不要
export const PriceChart = ({ prices }: { prices: DailyPrice[] }) => {
  const width = 600
  const height = 200
  // 値の正規化 → SVG の座標変換
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width
    const y = height - normalizeY(Number(p.adjClose))
    return `${x},${y}`
  })
  return (
    <svg viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points.join(' ')} fill="none" stroke="currentColor" />
    </svg>
  )
}
```

## Hono JSX の注意点

| React | Hono JSX |
|-------|----------|
| `className` | `class` |
| `htmlFor` | `for` |
| `onClick={handler}` | MVP では使わない（SSR のみ） |
| `useState`, `useEffect` | 使わない（サーバーサイドのみ） |

## 禁止事項

- `useState`, `useEffect` などのクライアントサイドフックを使わない
- クライアントサイド JS ライブラリ（Chart.js, D3 等）を import しない（MVP）
- `document`, `window` などのブラウザ API を参照しない（SSR では undefined）
