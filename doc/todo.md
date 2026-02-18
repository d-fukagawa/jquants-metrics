# jquants-metrics — 進捗 & 次のアクション

最終更新: 2025-02-18

---

## 完了済み

### Step 0: ドキュメント整備
- [x] `doc/plan.md` 作成（技術スタック・DB スキーマ・実装ステップ・スクリーニング戦略）
- [x] `README.md` 更新（プロジェクト概要・セットアップ手順）

### Step 0.5: 事前検証 — UI モック
- [x] `doc/mock/index.html` — ホーム（銘柄検索 + 検索履歴 + お気に入り）
- [x] `doc/mock/stock.html` — 銘柄分析（株価チャート＋出来高 / 日次データテーブル / PL・BS・CF / 財務指標）
- [x] `doc/mock/screen.html` — スクリーニング（条件サイドバー + 結果テーブル）
- [x] `doc/mock/config/key.md` の API フィールドをモックに反映
- [x] スクリーニング戦略（割安 × クオリティ）を `doc/plan.md` に追記

---

## 次のアクション

### Step 0.5（後半）: JQuants API 無料プランの検証 ← **次にやること**

手元の API キーで下記エンドポイントを実際に叩き、取得可否・フィールド有無・データ範囲を確認する。

| 確認項目 | エンドポイント | 確認ポイント |
|----------|--------------|-------------|
| 銘柄マスタ | `GET /v2/equities/master` | `Mrgn`（信用区分）フィールドの有無 |
| 日足株価 | `GET /v2/equities/bars/daily` | 取得可能な過去日数（無料プランの制限） |
| 財務サマリー | `GET /v2/fins/summary` | `EPS`, `BPS`, `CashEq`, `CFO` の有無 |
| 財務詳細 | `GET /v2/fins/details` | 有利子負債・D&A フィールドの取得可否（Phase 2 前提） |

> 検証方法: curl または Postman で `x-api-key: <your-key>` ヘッダーを付けてリクエスト。
> 結果は `doc/mock/config/` 配下に `api-validation.md` としてメモする。

---

### Step 1: プロジェクトブートストラップ

```bash
# リポジトリルートで実行
npm create hono@latest . -- --template cloudflare-pages
npm install @neondatabase/serverless drizzle-orm
npm install -D drizzle-kit
```

### Step 2: 環境設定

- `.gitignore` に `.dev.vars`, `dist/`, `node_modules/` を追加
- `.dev.vars` を作成し `DATABASE_URL` と `JQUANTS_API_KEY` を設定
- `wrangler.toml` に `compatibility_flags = ["nodejs_compat"]` と cron トリガーを追加

### Step 3: Neon DB セットアップ

- [console.neon.tech](https://console.neon.tech) でプロジェクト作成
- 接続文字列を `.dev.vars` に追記

### Step 4: Drizzle スキーマ & マイグレーション

- `src/db/schema.ts` に 3 テーブルを定義（`stock_master` / `daily_prices` / `financial_summary`）
- `npm run db:generate && npm run db:migrate` で Neon に適用

### Step 5〜10

→ `doc/plan.md` の「フェーズ 1 実装ステップ」を参照

---

## 保留・検討中

| 項目 | 状態 | メモ |
|------|------|------|
| `fins_details` の取得コスト | 未検証 | 銘柄数 × API 呼び出し数が多い。バッチ戦略を要検討 |
| PSR のキャッシュ戦略 | 未定 | DB に保持（日次更新）か、クエリ時に計算か |
| 無料プランの日足データ取得可能期間 | **要確認（Step 0.5）** | 制限次第でチャート期間の上限が変わる |
| screen.html Phase 1 フィルター追加 | モック未反映 | PSR・黒字・CFO・自己資本比率フィルターを実装時に追加 |
