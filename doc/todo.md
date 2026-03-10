# jquants-metrics TODO

最終更新: 2026-02-21

---

## Phase 1 — 銘柄分析 MVP（完了）

### Step 0: ドキュメント整備 ✅
- [x] `doc/plan.md` 作成
- [x] `README.md` 更新

### Step 0.5: 事前検証 ✅
- [x] `doc/mock/index.html` — ホーム UI モック
- [x] `doc/mock/stock.html` — 銘柄分析 UI モック
- [x] `doc/mock/screen.html` — スクリーニング UI モック
- [x] JQuants API 無料プラン検証（master / bars / fins/summary）
- [x] `doc/mock/config/api-validation.md` に検証結果

### Step 1: プロジェクトブートストラップ ✅
- [x] cloudflare-pages テンプレート展開
- [x] `npm install`（hono + neon + drizzle + vitest）
- [x] `npm run dev` 起動確認

### Step 2–3: 環境設定 / Neon DB セットアップ ✅

### Step 4: Drizzle スキーマ & マイグレーション ✅
- [x] `src/db/schema.ts`（stock_master / daily_prices / financial_summary）
- [x] `src/db/client.ts` — `createDb(databaseUrl)`
- [x] `npm run db:generate` & `db:migrate`

### Step 5: JQuants クライアント ✅
- [x] `src/jquants/client.ts` + `types.ts`（11 tests）

### Step 6: 同期サービス ✅
- [x] `src/services/syncService.ts`（BATCH_SIZE=500）
- [x] `src/routes/sync.ts`（POST /api/sync・X-Sync-Secret 保護）
- [x] 23 tests

### Step 7: ホーム画面 ✅
- [x] `src/renderer.tsx`, `src/services/stockService.ts`, `src/routes/home.tsx`
- [x] `public/static/style.css` — デザイントークン・全 CSS
- [x] 20 tests

### Step 8: 銘柄分析ページ ✅
- [x] `src/services/priceService.ts`, `financialService.ts`, `src/routes/stock.tsx`
- [x] 44 tests

### Step 9: SVG チャート ✅
- [x] `src/components/PriceChart.tsx` — サーバーサイド SVG（価格ライン＋出来高バー）
- [x] `src/components/MetricsCard.tsx` — PER/PBR/ROE/配当利回りカード
- [x] `public/static/style.css` — チャート CSS 変数・クラス追記

### Step 10: フリープランデータ保存 & 動作検証 ✅（デプロイ除く）

- [x] `wrangler.jsonc` JSONC 構文エラー（カンマ欠落）修正
- [x] `.dev.vars` の `SYNC_SECRET=local-dev` を設定
- [x] **JQuants API v2 フィールド名の不一致を修正**（→ 下記「発見した不具合」参照）
- [x] 銘柄マスタ 4,425 件を Neon に投入
- [x] トヨタ（7203）株価 489 件・財務 8 件を Neon に投入
- [x] ブラウザ画面検証（`/`・`/stock/7203`）完了
- [x] `npm run build`（285.83 kB）確認
- [x] `npm run preview`（wrangler pages dev）での本番相当確認
- [x] Cloudflare Pages デプロイ — https://973155cb.jquants-metrics.pages.dev

#### 発見した不具合（Step 10 実績データ投入時に判明）

| 症状 | 原因 | 修正ファイル |
|------|------|------------|
| `master` sync で `Cannot read properties of undefined (reading 'map')` | API レスポンスのトップキーが `"equities_master"` ではなく **`"data"`** | `src/jquants/types.ts`, `client.ts`, `client.test.ts` |
| `financials` sync で `null value in column "disc_no"` | API フィールド名が `DisclosureNumber`→**`DiscNo`**、`DisclosureDate`→**`DiscDate`**、`TotalAssets`→**`TA`** | `src/jquants/types.ts`, `syncService.ts`, `client.test.ts`, `syncService.test.ts` |

**修正後: 8 test files / 98 tests / build 285.83 kB**

---

## Step 10-E: Cloudflare Pages デプロイ（保留・検討中）

デプロイ前に決定・確認が必要な事項:

- [ ] 本番用 `SYNC_SECRET` の値を決める（強いランダム文字列）
- [ ] `npm run deploy` 実行（初回は Cloudflare アカウントとの紐付けが必要）
- [ ] Cloudflare Pages ダッシュボードで環境変数を設定:
  - `DATABASE_URL`（Neon 接続文字列）
  - `JQUANTS_API_KEY`
  - `SYNC_SECRET`（本番用）
- [ ] 本番 URL で `/`・`/stock/7203` の動作確認
- [ ] 本番 URL から `POST /api/sync` でデータ投入（本番シークレット使用）

---

## Phase 2 — スクリーニング機能

### Step 11: スクリーニングページ ✅

- [x] `src/services/screenService.ts` — 動的フィルタークエリ
  - 対象: PER / PBR / ROE / 配当利回り / 自己資本比率 / PSR / 黒字フラグ / CFO フラグ
  - 時価総額 = 最新終値 × shOutFy
  - PSR = 時価総額 ÷ Sales
  - `daily_prices` LATERAL JOIN で各銘柄の最新終値を取得
- [x] `src/routes/screen.tsx` — `GET /screen`（GET パラメータでフィルター）
  - サイドバー: 各指標 min/max 入力 + チェックボックス
  - 結果テーブル: コード・名称・株価・PER・PBR・ROE・EqAR・PSR・配当利回り
- [x] `src/index.tsx` — `/screen` ルートをマウント
- [x] `src/services/screenService.test.ts` + `src/routes/screen.test.tsx`

### Step 12: 自動同期 Cron ハンドラー ✅

> **前提**: JQuants API 有料プランが必要。
> 無料プランのデータ範囲は 〜2025-11-29 で終了しており、2026-03-11 以降の最新データは有料プランでのみ取得可能。

- [x] `src/services/syncService.ts` に `syncAllStocks(db, apiKey, from, to)` 追加
  - 銘柄マスタ更新 → 全銘柄の株価・財務をループ同期
  - レート制限（5 req/min）対応: 各 API 呼び出し後に `await sleep(200)`
- [x] `src/index.tsx` に `scheduled` ハンドラー追加（直近7日間を同期）
  - エクスポート形式を `export default { fetch, scheduled }` に変更
- [x] Cloudflare Pages の Cron は `wrangler.jsonc` 非対応 → コメントで手順を明記
  - ダッシュボード: Pages > Settings > Functions > Cron Triggers > `0 1 * * *`

---

## Phase 3 — 高度財務指標（fins_details）

### Step 13: fins_details 同期

- [ ] `src/db/schema.ts` に `fins_details` テーブル追加
  - 有利子負債（流動/非流動）・減価償却費・D&A
- [ ] `src/jquants/client.ts` — `fetchFinsDetails` 追加
- [ ] `src/services/syncService.ts` — `syncFinsDetails` 追加

### Step 14: 高度指標計算 & 表示

- [ ] ネットキャッシュ、EV、EBITDA、EV/EBITDA、ROIC の計算ロジック追加
- [ ] スクリーニング条件に EV/EBITDA・ネットキャッシュ比率を追加
- [ ] 銘柄分析ページに高度指標セクションを追加

---

## メモ

### JQuants API v2 実フィールド名（実測値）

| エンドポイント | レスポンスルートキー | 主な注意フィールド |
|---|---|---|
| `/v2/equities/master` | `"data"` | — |
| `/v2/equities/bars/daily` | `"data"` | — |
| `/v2/fins/summary` | `"data"` | `DiscNo`（旧 DisclosureNumber）、`DiscDate`（旧 DisclosureDate）、`TA`（旧 TotalAssets） |

### その他

- **JQuants 無料プラン**: 日足データ取得範囲 = 2023-11-29 〜 2025-11-29
- **5桁↔4桁コード変換**: URL は 4 桁（"7203"）、DB・API は 5 桁（"72030"）→ `code4 + '0'`
- **BPS フォールバック**: IFRS 中間決算は BPS が空 → `Eq / (ShOutFY - TrShFY)` で代替
- **Drizzle upsert**: `onConflictDoUpdate` + `sql\`excluded.col\`` パターン
- **`npm run dev`** = Vite + `@hono/vite-dev-server`（Miniflare ベース、`.dev.vars` を読む）
- **`npm run preview`** = `wrangler pages dev`（ビルド後、より忠実な CF Workers 環境）
- **`wrangler.jsonc`**: JSONC でもオブジェクトプロパティ間のカンマは必須
