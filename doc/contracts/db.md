# DB Schema 契約

実装: [src/db/schema.ts](../../src/db/schema.ts)。マイグレーション履歴: [drizzle/](../../drizzle/)。

DB は Neon PostgreSQL。`drizzle-kit migrate` で適用される。**migration の追加・既存カラム変更は自動で進めない** ([doc/harness/02 §8](../harness/02_ハーネス全体仕様.md))。

## 外部接点カラム (壊してはいけない)

これらは sync API / CLI / GitHub Actions が書き込み、UI クエリと EDINET 補完ロジックが読む。
**rename / drop / 型変更は breaking。NOT NULL 化や型の縮小も breaking。**

| テーブル | 主キー | 必ず守るカラム |
|---|---|---|
| `stock_master` | `code` (varchar(5)) | `code`, `coName`, `mkt` |
| `daily_prices` | (`code`, `date`) | `code`, `date`, `adjClose` |
| `financial_summary` | (`code`, `discNo`) | `code`, `discNo`, `eps`, `bps`, `dividendPerShare` |
| `fins_details` | (`code`, `discNo`) | `code`, `discNo`, `discDate`, `pretaxProfit`, `taxExpense`, `dna` |
| `financial_adjustments` | (`code`, `discNo`, `itemKey`, `direction`) | `category`, `amount`, `source` |
| `edinet_company_map` | `code` | `code`, `edinetCode` |
| `edinet_filings` | (`edinetCode`, `docId`) | `filingDate`, `eventType`, `isAmendment` |
| `edinet_forecasts` | (`code`, `horizon`, `fiscalYear`) | `salesForecast`, `opForecast`, `npForecast` |
| `edinet_bridge_facts` | (`code`, `fiscalYear`, `periodType`) | `operatingProfit`, `pretaxProfit`, `cfo`, `adjustmentItemsJson` |
| `edinet_quality_scores` | (`code`, `asOfDate`) | `qualityScore`, `componentsJson` |
| `edinet_text_scores` | (`code`, `asOfDate`) | `anomalyScore`, `componentsJson` |

主キー組み合わせは upsert (`onConflictDoUpdate`) のキーになっており、変更すると重複行が生まれる。

## ユーザ設定テーブル (壊しにくい)

これらは UI 経由のみ。sync 経路はないので外部影響は小さい。

| テーブル | 主キー | 用途 |
|---|---|---|
| `stock_memo_meta` | `code` | ウォッチフラグ |
| `stock_memos` | `id` | 自由メモ |
| `themes` | `id` | テーマ定義 |
| `theme_stocks` | (`themeId`, `code`) | テーマ所属銘柄 |

## 内部ログ (自由)

`edinet_sync_runs` は同期ジョブのログ。schema 変更は内部影響のみ。

## 銘柄コードの形式

- DB 上は **5 桁文字列** (`"72030"`)。4 桁ではない (CLAUDE.md 既述)
- 4 桁 (例 `"7203"`) は外部入力 (URL, API request, env) のみ。`toCode5` で変換してから DB 操作。

## numeric 型の取り扱い

Drizzle の `numeric` カラムは TypeScript では `string` で返る。**計算前に `Number()` 変換**。
NULL は `null` として返る。`number()` 変換する前に null チェック必須。

## Breaking change の例

- 上記「外部接点カラム」の rename / drop / 型変更
- 既存テーブルの主キー組み合わせ変更
- 既存カラムの NOT NULL 化 (既存 NULL 行があると失敗)
- numeric → integer など型の縮小
- 既存テーブル名の rename

## Additive change の例

- 新規テーブル追加
- 新規カラム追加 (default 値あり、または NULL 可)
- 新規 index 追加
- 既存カラムの NOT NULL を緩めて NULLABLE に (互換)
