# jquants-metrics TODO

最終更新: 2026-03-12

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

### Step 12: 自動同期（GitHub Actions） ✅

> **前提**: JQuants API 有料プランが必要（Light プラン以上を推奨）。
> 無料プランのデータ範囲は 〜2025-11-29 で終了しており、2026-03-11 以降の最新データは有料プランでのみ取得可能。

- [x] **Cloudflare Pages は Cron 非対応** → GitHub Actions で代替
  - `wrangler.jsonc` コメントに手順を明記
- [x] `scripts/daily-sync.ts` 作成 — Node.js + tsx で直接実行するエントリポイント
  - `DATABASE_URL` / `JQUANTS_API_KEY` / `SYNC_FROM` / `SYNC_TO` 環境変数を受け取る
- [x] `.github/workflows/daily-sync.yml` 作成
  - `cron: '0 7 * * 1-5'`（平日 07:00 UTC = 16:00 JST、東証クローズ後）
  - `workflow_dispatch` で `from` / `to` を指定した手動実行も可能
  - タイムアウト: 180 分
- [x] `src/services/syncService.ts` — `syncAllStocks` 実装
  - 株価: **日付バルク取得**（`syncDailyPricesAll`）= 1日1リクエストで全銘柄分
  - 財務: 銘柄ごとに取得（~4400 リクエスト）
  - Light プラン（60 req/min）対応: `sleep(1000ms)` で ~50 req/min に制限
  - 各フェーズのログ出力（master / prices / financials 進捗）
- [x] `src/jquants/client.ts` — 429 レートリミット対策
  - `fetchDailyPricesAll(apiKey, date)` 追加（date のみ指定で全銘柄一括）
  - 429 時に 60 秒待機して最大 3 回リトライ
- [x] GitHub Secrets に `DATABASE_URL` / `JQUANTS_API_KEY` を設定
- [x] 手動実行（`workflow_dispatch`）で同期成功確認

### Step 12-B: 日次株価バックフィル運用（欠損補完） ✅

- [x] `scripts/backfill-prices.ts` を追加（**株価のみ**を日付単位で全銘柄バックフィル）
  - デフォルト: `BACKFILL_FROM/BACKFILL_TO` 未指定時は **180日前〜昨日（JST）**
  - 空入力（workflow_dispatch 未入力）を未指定扱いに修正済み
- [x] `.github/workflows/backfill-prices.yml` を追加（手動実行専用）
  - `from`, `to`, `include_weekends`, `retry_per_date` を指定可能
- [x] 実行確認
  - Run ID: `22993203818`
  - 状態: `success`

#### 手動実行コマンド（GitHub CLI）

```bash
# デフォルト実行（180日前〜昨日/JST）
gh workflow run backfill-prices.yml --ref main

# 任意期間（例: 2025年通年）
gh workflow run backfill-prices.yml --ref main -f from=2025-01-01 -f to=2025-12-31

# 月単位で遡る（例: 2025-08）
gh workflow run backfill-prices.yml --ref main -f from=2025-08-01 -f to=2025-08-31
```

#### 月次で遡る運用メモ

- まず不足が大きい期間から 1 ヶ月単位で実行する
- 各 run 完了後に `/sync-status` の `daily_prices` 最新日件数・不足数を確認する
- 目安: 半年分完了後は、必要に応じて四半期ごとに過去を追加バックフィルする

### Step 12-C: EV/EBITDA・NC比率 欠損補完計画（進行中）

目的:
- スクリーニング画面で `EV/EBITDA` と `NC比率` が `—` になる銘柄を減らす
- 高度指標の分析精度を担保する

背景:
- 高度指標の算出には `daily_prices` だけでなく `financial_summary` と `fins_details` の充足が必要
- 特に `fins_details.dna`（減価償却費）や負債項目欠損で `EV/EBITDA` が null になる

計画:
- [x] `sync-status` に高度指標向けのカバレッジ指標を追加
  - `fins_details` 総件数 / 銘柄カバレッジ
  - `dna IS NOT NULL` 件数
  - `EV/EBITDA` 算出可能銘柄数
- [x] GitHub Actions を「日次株価」と「財務系」に分離
  - `daily-sync.yml` は価格中心（平日18:00 JST）
  - `financial sync` は別 workflow（週次または手動）
- [x] `financial_summary + fins_details` のバックフィル workflow を追加
  - `workflow_dispatch` で手動実行
  - `shard/shards` を入力可能にして分割実行
- [x] `fins_details` 取得ロジックの補強
  - `dna` の取得キー候補を追加し、取得率改善
  - `latest_details` 抽出を「最新1件」から「必要項目が非NULLの最新優先」へ改善
- [ ] 実行と検証
  - 財務バックフィル実行後に `/sync-status` と `/screen` を確認
  - `EV/EBITDA`・`NC比率` 表示率の改善を確認

完了条件:
- [ ] `fins_details` 銘柄カバレッジ 80% 以上
- [ ] `EV/EBITDA` が表示される銘柄数が有意に増加（実行前後で比較）
- [ ] スクリーニングで `EV/EBITDA` / `NC比率` フィルターが実用可能

---

## Phase 3 — 高度財務指標（fins_details）

### Step 13: fins_details 同期 ✅

- [x] `src/db/schema.ts` に `fins_details` テーブル追加
  - 有利子負債（流動/非流動）・減価償却費・D&A
- [x] `src/jquants/client.ts` — `fetchFinsDetails` 追加
- [x] `src/services/syncService.ts` — `syncFinsDetails` 追加

### Step 14: 高度指標計算 & 表示 ✅

- [x] ネットキャッシュ、EV、EBITDA、EV/EBITDA、ROIC の計算ロジック追加
- [x] スクリーニング条件に EV/EBITDA・ネットキャッシュ比率を追加
- [x] 銘柄分析ページに高度指標セクションを追加

---

## メモ

### JQuants API v2 実フィールド名（実測値）

| エンドポイント | レスポンスルートキー | 主な注意フィールド |
|---|---|---|
| `/v2/equities/master` | `"data"` | — |
| `/v2/equities/bars/daily` | `"data"` | — |
| `/v2/fins/summary` | `"data"` | `DiscNo`（旧 DisclosureNumber）、`DiscDate`（旧 DisclosureDate）、`TA`（旧 TotalAssets） |

### JQuants API レートリミット（2026-03 実測）

| プラン | 上限 | 必要な sleep | 4400 銘柄財務の所要時間 |
|--------|------|------------|----------------------|
| Free | 5 req/min | 12000ms | — |
| Light | 60 req/min | 1000ms | ~88 分 |
| Standard | 120 req/min | 500ms | ~44 分 |
| Premium | 500 req/min | 120ms | ~11 分 |

- 大幅超過で 5 分間アクセス遮断あり → 429 時は 60 秒待機してリトライ
- `/v2/equities/bars/daily?date=YYYY-MM-DD`（code なし）で**全銘柄の日足を 1 リクエスト**で取得可能（Light プラン以上で確認済み）

### その他

- **JQuants 無料プラン**: 日足データ取得範囲 = 2023-11-29 〜 2025-11-29
- **5桁↔4桁コード変換**: URL は 4 桁（"7203"）、DB・API は 5 桁（"72030"）→ `code4 + '0'`
- **BPS フォールバック**: IFRS 中間決算は BPS が空 → `Eq / (ShOutFY - TrShFY)` で代替
- **Drizzle upsert**: `onConflictDoUpdate` + `sql\`excluded.col\`` パターン
- **`npm run dev`** = Vite + `@hono/vite-dev-server`（Miniflare ベース、`.dev.vars` を読む）
- **`npm run preview`** = `wrangler pages dev`（ビルド後、より忠実な CF Workers 環境）
- **`wrangler.jsonc`**: JSONC でもオブジェクトプロパティ間のカンマは必須
