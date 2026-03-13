# 新規 JSX コンポーネント作成

このプロジェクトの既存コンポーネント構成に合わせて新しい JSX コンポーネントを作成してください。

## 参照すべきファイル

@src/components/MetricsCard.tsx
@src/components/PriceChart.tsx
@src/components/CLAUDE.md

## 作成手順

1. `src/components/` に新しいファイルを作成する
2. Hono JSX を使う（React ではない）
   - `class` を使う（`className` ではない）
   - `for` を使う（`htmlFor` ではない）
3. サーバーサイドで完結させる（`useState`, `useEffect` は使わない）
4. SVG チャートなどは座標計算も含めてサーバーサイドで処理する
5. Props の型を `interface` で定義する

## 入力情報

作成するコンポーネントの役割と受け取るデータ（Props）を教えてください：
