# src/services/ — サービス層

ビジネスロジックを純粋関数として実装するディレクトリ。
DB アクセスと計算ロジックを担当し、HTTP の知識を持たない。

## 現在のサービス

| ファイル | 役割 |
|---------|------|
| `stockService.ts` | 銘柄マスタ検索（名前/コード）|
| `priceService.ts` | 日足株価の取得（直近 N 日）|
| `financialService.ts` | PER/PBR/ROE の計算 |
| `syncService.ts` | JQuants API → Neon DB へのデータ同期 |
| `themeService.ts` | テーマCRUD・銘柄集計・日足/週足/月足変換 |

## パターン

### DB を使うサービス関数

```typescript
import type { Db } from '../db/client'

// Db インスタンスを引数で受け取る（DI パターン）
export async function findStockByCode(db: Db, code: string) {
  return db.select().from(stockMaster).where(eq(stockMaster.code, code)).limit(1)
}
```

### 計算ロジック（DB 不要）

```typescript
// 純粋関数として実装（テストしやすい）
export function calcPer(closePrice: number, eps: number | null): number | null {
  if (!eps || eps === 0) return null
  return closePrice / eps
}
```

### JQuants API → DB 同期（upsert パターン）

```typescript
import { sql } from 'drizzle-orm'

// 冪等な upsert: onConflictDoUpdate + sql`excluded.カラム名`
await db.insert(stockMaster)
  .values(rows)
  .onConflictDoUpdate({
    target: stockMaster.code,
    set: {
      coName:    sql`excluded.co_name`,
      updatedAt: sql`excluded.updated_at`,
    },
  })
```

### レート制限対策（Free プラン: 5 req/min）

```typescript
// 銘柄単位ではなく日付単位の一括取得を優先
// バッチ処理は BATCH_SIZE = 500 行単位で INSERT
const BATCH_SIZE = 500
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  await db.insert(table).values(rows.slice(i, i + BATCH_SIZE))...
}
```

## 数値フィールドの扱い

Drizzle の `numeric` 型は**文字列**で返る。計算前に変換する：

```typescript
// DB から取得した値は string | null
const eps = row.eps  // "123.45" | null

// 計算前に変換
const epsNum = eps ? Number(eps) : null
const per = epsNum && epsNum !== 0 ? closePrice / epsNum : null
```

## 禁止事項

- `c.env` / `c.req` などの HTTP Context にアクセスしない
- `process.env` を使わない（Cloudflare Workers 非対応）
- サービス関数内で直接 HTML をレンダリングしない
