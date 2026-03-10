# src/db/ — DB 層（Drizzle ORM + Neon）

Drizzle ORM を使った DB クライアントとスキーマ定義のディレクトリ。

## ファイル構成

| ファイル | 役割 |
|---------|------|
| `schema.ts` | テーブル定義（3 テーブル） |
| `client.ts` | `createDb(databaseUrl)` 関数 |
| `index.ts` | re-export |

## テーブル定義（schema.ts）

### `stock_master` — 銘柄マスタ
- PK: `code`（varchar 5桁、例: `"72030"`）
- JQuants: `GET /v2/equities/master`

### `daily_prices` — 日足株価
- PK: `(code, date)`
- 権利調整済み値: `adj_open`, `adj_high`, `adj_low`, `adj_close`, `adj_volume`
- JQuants フィールド: `O`, `H`, `L`, `C`, `Vo`, `Va`, `AdjFactor`, `AdjO`, `AdjH`, `AdjL`, `AdjC`, `AdjVo`
- JQuants: `GET /v2/equities/bars/daily`

### `financial_summary` — 財務情報
- PK: `(code, disc_no)`
- `cur_per_type`: `1Q` / `2Q` / `3Q` / `4Q` / `FY`
- Drizzle の `numeric` 型は文字列で返る（`"123.45"` | `null`）
- JQuants: `GET /v2/fins/summary`

## パターン

### DB クライアント生成

```typescript
import { createDb } from '../db/client'

// Cloudflare Bindings から接続文字列を取得
const db = createDb(c.env.DATABASE_URL)
```

### スキーマ変更手順

```bash
# 1. src/db/schema.ts を編集
# 2. マイグレーションファイルを生成
npm run db:generate

# 3. Neon に適用
npm run db:migrate

# 4. テーブルを確認
npm run db:studio
```

### upsert（冪等な挿入・更新）

```typescript
import { sql } from 'drizzle-orm'
import { stockMaster } from './schema'

// onConflictDoUpdate で冪等な upsert
await db.insert(stockMaster)
  .values(rows)
  .onConflictDoUpdate({
    target: stockMaster.code,          // 単一 PK
    set: {
      coName:    sql`excluded.co_name`,
      updatedAt: sql`excluded.updated_at`,
    },
  })

// 複合 PK の場合
.onConflictDoUpdate({
  target: [dailyPrices.code, dailyPrices.date],
  set: { close: sql`excluded.close`, ... },
})
```

### クエリ例

```typescript
import { eq, ilike, desc } from 'drizzle-orm'

// 銘柄コードで検索
const stock = await db.select().from(stockMaster).where(eq(stockMaster.code, code)).limit(1)

// 銘柄名で部分一致検索（大文字小文字無視）
const results = await db.select().from(stockMaster).where(ilike(stockMaster.coName, `%${query}%`))

// 最新 N 件の日足株価
const prices = await db.select().from(dailyPrices)
  .where(eq(dailyPrices.code, code))
  .orderBy(desc(dailyPrices.date))
  .limit(90)
```

## 禁止事項

- `process.env.DATABASE_URL` を使わない（`createDb(c.env.DATABASE_URL)` を使う）
- マイグレーションファイル（`drizzle/` ディレクトリ）を手動編集しない
- `numeric` 型の値を変換せずに計算しない（必ず `Number()` で変換）
