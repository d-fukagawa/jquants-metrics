# jquants-metrics 実装計画（現行版）

最終更新: 2026-03-13

## 1. 目的

JQuants API v2 と EDINET 系データを使い、以下を一体で扱う日本株分析アプリを維持・拡張する。

- 銘柄詳細分析（`/stock/:code`）
- 条件スクリーニング（`/screen`）
- ウォッチ + メモ（`/watchlist`）
- 開示タイムライン/サプライズ抽出（`/timeline`, `/alpha`）
- テーマ分析3画面（`/themes`）

## 2. 現在の実装状況

### 完了済み

- Phase 1: 銘柄検索・銘柄分析 MVP
- Phase 2: スクリーニング（PER/PBR/ROE/配当/PSR/EV系）
- Phase 3: 高度財務指標（EV/EBITDA, NC比率, ROIC）
- Phase 4: 調整後EBITDA（model）
- Phase 5: テーマ分析3画面
  - `GET /themes` 一覧
  - `GET /themes/new`, `POST /themes` 新規
  - `GET /themes/:id/edit`, `POST /themes/:id` 編集
  - `GET /themes/:id` 分析（日足/週足/月足 + from/to）
  - `POST /themes/:id/memo` メモ保存
  - `POST /themes/:id/delete` 完全削除

### 直近デプロイ

- 2026-03-13: `https://41f1486a.jquants-metrics.pages.dev`

## 3. 技術スタックと制約

- Web: Hono + JSX（Cloudflare Pages Functions）
- DB: Neon PostgreSQL
- ORM: Drizzle ORM
- 言語: TypeScript
- 同期: GitHub Actions + 手動 sync API

必須制約:

- Cloudflare Workers ランタイム前提（`process.env`/`fs` 禁止）
- ルートでは `c.env.*`、サービスは純粋関数（`Db + args`）
- JQuants は v2 + `x-api-key`
- Drizzle `numeric` は演算前に `Number()` 変換
- upsert は `onConflictDoUpdate`

## 4. 現在の主要ルート

- `/` 銘柄検索
- `/stock/:code` 銘柄詳細
- `/screen` スクリーニング
- `/watchlist` ウォッチ一覧/メモ操作
- `/timeline` 開示イベント
- `/alpha` サプライズ抽出
- `/sync-status` 同期状況
- `/themes` テーマ機能一式
- `/api/sync` 手動同期

## 5. 現在の主要テーブル（要点）

- 市場/価格/財務: `stock_master`, `daily_prices`, `financial_summary`, `fins_details`, `financial_adjustments`
- EDINET: `edinet_company_map`, `edinet_filings`, `edinet_forecasts`, `edinet_bridge_facts`, `edinet_quality_scores`, `edinet_text_scores`, `edinet_sync_runs`
- ウォッチ/メモ: `stock_memo_meta`, `stock_memos`
- テーマ: `themes`, `theme_stocks`

## 6. テーマ分析機能の仕様（現行）

- 1テーマあたり銘柄上限: 6
- 銘柄入力: 検索追加 + 選択済み一覧 + 並び替え + 削除
- 分析粒度: 日足/週足/月足
- 期間: `from`, `to`（デフォルトは直近6か月）
- 価格スケール: 実価格（円）
- 週足/月足: 日足から OHLCV 再集計
  - 始値: 期間最初
  - 高値: 期間内最大
  - 安値: 期間内最小
  - 終値: 期間最後
  - 出来高: 合計
- チャート: Apache ECharts（クライアント描画）

## 7. 運用コマンド

```bash
npm run dev
npm run test
npm run build
npm run preview
npm run db:generate
npm run db:migrate
```

### Cloudflare Pages デプロイ（Windows 推奨）

`npm run deploy` は PowerShell で `$npm_execpath` 解釈失敗する場合があるため、以下を標準手順とする。

```bash
npm run test
npm run build
npx wrangler pages deploy dist
```

## 8. 未完了タスク（次フェーズ）

1. EDINETDB 補完の強化
- `fins/details` 契約不足を補うため、`debt_current`, `debt_non_curr`, `dna`, `pretax_profit`, `tax_expense` 補完率を向上

2. 高度指標の表示率改善
- `EV/EBITDA`, `NC比率`, `EV/調整後EBITDA` の `—` 率を低下

3. テーマ分析の次候補
- 複数テーマ横断比較
- テーマ分析結果のエクスポート
- 必要に応じた分足対応（要データ取得方針の再定義）

## 9. 検証基準

- `npm run test` がグリーン
- `npm run build` が成功
- `/themes` 一覧・新規・編集・分析・メモ保存・削除が動作
- 既存 `/watchlist`, `/stock/:code`, `/screen` に回帰なし
