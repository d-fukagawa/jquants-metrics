# jquants-metrics 実装計画

## Context（背景・目的）

JQuants API を使い、日本株のスクリーニング・分析ができる Web ツールを構築する。
Phase 1 では銘柄を選択して株価推移と財務指標（PER/PBR/ROE）を表示する「簡易分析」から始め、
後続フェーズでスクリーニング機能や高度な指標（EV, ROIC, EBITDA）へ発展させる。

---

## 技術スタック

| 役割 | 採用技術 |
|------|----------|
| Web フレームワーク | Hono + JSX（フルスタック） |
| データベース | Neon（Serverless PostgreSQL） |
| ORM | Drizzle ORM |
| 言語 | TypeScript |
| デプロイ | Cloudflare Pages（まずローカル） |

**重要**: JQuants API は 2025 年 12 月に v2 へ移行済み（v1 は非推奨）。
v2 は `x-api-key` ヘッダーによる API キー認証に変更されており、トークンのリフレッシュ処理は不要。

---

## プロジェクト構成

```
jquants-metrics/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.toml
├── drizzle.config.ts
├── .dev.vars                   # ローカル用シークレット（gitignore）
├── .gitignore
├── doc/
│   ├── plan.md                 # このファイル
│   └── mock/                   # UIモック（静的HTML）
├── public/
│   └── style.css
└── src/
    ├── index.tsx               # Hono エントリポイント + Bindings 型 + cron handler
    ├── renderer.tsx            # jsxRenderer ベースレイアウト
    ├── db/
    │   ├── client.ts           # createDb(databaseUrl) 関数
    │   ├── schema.ts           # Drizzle テーブル定義（3テーブル）
    │   └── index.ts            # re-export
    ├── jquants/
    │   ├── client.ts           # JQuants API v2 HTTP クライアント
    │   └── types.ts            # API レスポンス型定義
    ├── routes/
    │   ├── index.tsx           # GET /  - 銘柄検索ページ
    │   ├── stock.tsx           # GET /stock/:code - 銘柄分析ページ
    │   └── sync.ts             # POST /api/sync - 手動データ同期
    ├── services/
    │   ├── stockService.ts     # 銘柄検索ロジック
    │   ├── priceService.ts     # 株価履歴取得
    │   ├── financialService.ts # PER/PBR/ROE 計算
    │   └── syncService.ts      # JQuants → DB 同期オーケストレーション
    └── components/
        ├── PriceChart.tsx      # 株価折れ線グラフ（SVG、サーバーサイド）
        └── MetricsCard.tsx     # PER/PBR/ROE 表示カード
```

---

## DB スキーマ（`src/db/schema.ts`）

### `stock_master` - 銘柄マスタ
- `code` PK, `co_name`, `co_name_en`, `sector17`, `sector17_nm`, `sector33`, `sector33_nm`, `scale_cat`, `mkt`, `mkt_nm`, `updated_at`
- ソース: `GET /v2/equities/master`

### `daily_prices` - 日足株価
- PK: `(code, date)`
- OHLC + 出来高 + 権利調整済み値（`adj_open`, `adj_high`, `adj_low`, `adj_close`, `adj_volume`）
- ソース: `GET /v2/equities/bars/daily`
- インデックス: `date`, `code`

### `financial_summary` - 財務情報
- PK: `(code, disc_no)`
- `disc_date`, `cur_per_type`（1Q/2Q/3Q/4Q/FY）, `sales`, `op`, `np`, `eps`, `bps`, `total_assets`, `equity`, `eq_ar`, `div_ann`, `payout_ratio`
- ソース: `GET /v2/fins/summary`

**注意**: PER/PBR/ROE は API から返ってこない。クエリ時に計算する。
- PER = 最新終値 / EPS（直近 FY 開示）
- PBR = 最新終値 / BPS（直近 FY 開示）
- ROE = NP / Equity × 100

---

## JQuants 認証フロー（v2）

```
JQuantsダッシュボード → Settings → API Key → コピー
                                               ↓
                                   .dev.vars に JQUANTS_API_KEY=xxx
                                               ↓
全リクエスト: GET https://api.jquants.com/v2/...
             Header: x-api-key: <key>
```

セキュリティ:
- `wrangler.toml` に API キーを書かない
- `.dev.vars` を `.gitignore` に追加
- Cloudflare では `wrangler pages secret put JQUANTS_API_KEY`
- `/api/sync` は `X-Sync-Secret` ヘッダーで保護

---

## フェーズ 1 実装ステップ

### Step 0: ドキュメント整備
- `doc/plan.md` としてこの計画書をプロジェクト内に保存
- `README.md` を更新（プロジェクト概要・技術スタック・ディレクトリ構成を記載）

### Step 0.5: 事前検証（開発着手前）

**HTML モックによる UI 検証**
- `doc/mock/` に静的 HTML でスクリーニング UI のモックを作成
- 銘柄検索フォーム・株価チャート・指標カードのレイアウトを確認してから実装へ進む

**JQuants API 無料プランのデータ検証**
- 無料プランで取得できるエンドポイント・データ範囲・フィールドを実際に叩いて確認
  - `/v2/equities/master`：銘柄マスタの取得可否
  - `/v2/equities/bars/daily`：日足データの取得可能期間（過去何日分か）
  - `/v2/fins/summary`：財務情報の取得可否・`EPS`/`BPS` フィールドの有無
- 無料プランで取得できないデータがある場合は代替手段またはスコープ縮小を検討

### Step 1: プロジェクトブートストラップ
```bash
npm create hono@latest . -- --template cloudflare-pages
npm install @neondatabase/serverless drizzle-orm
npm install -D drizzle-kit
```

### Step 2: 環境設定
- `.gitignore` に `.dev.vars`, `dist/`, `node_modules/` を追加
- `.dev.vars` 作成（`DATABASE_URL`, `JQUANTS_API_KEY`）
- `wrangler.toml` に `compatibility_flags = ["nodejs_compat"]`, cron トリガー追加

### Step 3: Neon DB セットアップ
- console.neon.tech でプロジェクト作成
- 接続文字列を `.dev.vars` に追加

### Step 4: Drizzle スキーマ & マイグレーション
```bash
npm run db:generate  # マイグレーションファイル生成
npm run db:migrate   # Neon に適用
npm run db:studio    # テーブル確認
```

### Step 5: JQuants クライアント実装
- `src/jquants/types.ts`：v2 レスポンス型（v2 フィールド名: `O`, `H`, `L`, `C`, `Vo` など）
- `src/jquants/client.ts`：`fetchEquitiesMaster`, `fetchDailyPrices`, `fetchFinancialSummary`

### Step 6: 同期サービス実装
- `src/services/syncService.ts`：JQuants → Neon の upsert ロジック
- **レート制限対策**: Free プランは 5 req/min → 銘柄単位でなく日付単位の一括取得を活用
- `src/routes/sync.ts`：`POST /api/sync`（シークレットヘッダーで保護）

### Step 7: 画面実装
- `src/renderer.tsx`：ベースレイアウト（HTML + ヘッダー）
- `src/routes/index.tsx`：銘柄コード/名前の検索フォーム
- `src/services/stockService.ts`：`stock_master` を `ilike` で検索

### Step 8: 銘柄分析ページ
- `src/services/priceService.ts`：直近 N 日の価格取得
- `src/services/financialService.ts`：PER/PBR/ROE 計算
- `src/routes/stock.tsx`：`GET /stock/:code` - チャート + 指標カードを表示

### Step 9: SVG チャート（サーバーサイド）
- `src/components/PriceChart.tsx`：`DailyPrice[]` を受け取り SVG パスを生成
- クライアントサイドの JS ライブラリ不要（MVP）

### Step 10: ローカルテスト & デプロイ
```bash
npm run dev          # Vite dev server
# /api/sync で DB をシード
npm run build && wrangler pages dev dist  # 本番環境相当のテスト
```

---

## スクリーニング戦略（設計方針）

「**割安 × クオリティ**」の組み合わせによってダウンサイドリスクを限定する。

### 割安基準

| 指標 | 条件 | 計算式 | 対応フェーズ |
|------|------|--------|-------------|
| PSR（株価売上高倍率） | < 1x | 時価総額 ÷ `Sales` | Phase 1 |
| ネットキャッシュ比率 | ネットキャッシュ > 時価総額 | `CashEq` − 有利子負債（`fins_details`）÷ 時価総額 | Phase 2 |
| 成長ポテンシャル代用 | EV/EBITDA ≤ 閾値 | EV ÷ EBITDA（`fins_details` から算出） | Phase 2 |

> ネットキャッシュ = `CashEq` − `有利子負債_流動` − `有利子負債_非流動`（`fins_details` の `first_match` キーで取得）
> 時価総額 = 最新 `AdjC` × `ShOutFY`

### クオリティ基準

| 指標 | 条件 | 計算式 | 対応フェーズ |
|------|------|--------|-------------|
| 黒字経営 | NP > 0 | `fins_summary.NP` | Phase 1 |
| 営業CF | CFO > 0 | `fins_summary.CFO` | Phase 1 |
| 自己資本比率 | EqAR ≥ 50%（理想 ≥ 70%） | `fins_summary.EqAR` | Phase 1 |

### screen.html フィルターに追加する項目（Phase 1）

```
現状のフィルター（PER / PBR / ROE / 配当利回り）に加えて追加:

【割安】
  PSR（倍）: 下限〜上限  ← 時価総額 / Sales をサーバー側で計算してDBに持つ

【クオリティ】
  ☐ 黒字のみ表示（NP > 0）
  ☐ 営業CFプラスのみ（CFO > 0）
  自己資本比率（%）: 下限〜上限  ← EqAR をそのまま利用
```

### 派生指標の計算フロー（Phase 2）

```
PSR           = 時価総額（株価 × ShOutFY）÷ Sales
ネットキャッシュ = CashEq − (有利子負債_流動 + 有利子負債_非流動)
EV            = 時価総額 + ネットキャッシュの逆数（負債超過分のみ加算）
EBITDA        = OP + 減価償却費・償却費（fins_details.D&A）
EV/EBITDA     = EV ÷ EBITDA
ROIC          = NOPAT ÷ 投下資本
                NOPAT = OP × (1 - 法人税率)   法人税率 = IncomeTax / PretaxProfit
                投下資本 = Eq + 有利子負債 - CashEq
```

---

## 後続フェーズ（Phase 2 以降）

- **Phase 2**: スクリーニング条件の拡充
  - PSR フィルター（`fins_summary.Sales` + 株価から計算）
  - 黒字フラグ（NP > 0）・CFO プラスフラグ・自己資本比率フィルター
  - 結果テーブルへの PSR / 自己資本比率 列追加
- **Phase 3**: `fins_details` 取得 → ネットキャッシュ・EV・EBITDA・ROIC 算出
  - ネットキャッシュ > 時価総額（"タダ銘柄"）フィルター
  - EV/EBITDA フィルター（成長ポテンシャル代用）
- **Phase 4**: EV/EBITDA・ROIC の銘柄一覧表示・詳細ページへの遷移

---

## 検証方法

1. `npm run dev` 起動後、`POST /api/sync` で一部銘柄データを DB に挿入
2. `GET /` で銘柄コード（例: `7203`）を検索して一致確認
3. `GET /stock/7203` で株価チャートと PER/PBR/ROE が表示されることを確認
4. `npm run build && wrangler pages dev dist` でビルド後の動作確認
5. `npm run db:studio` で Neon のデータ内容を目視確認
