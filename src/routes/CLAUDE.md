# src/routes/ — ルートハンドラ

Hono のルートハンドラを実装するディレクトリ。
ルートハンドラはリクエスト処理のみを担当し、ビジネスロジックは `src/services/` に委譲する。

## 現在のルート

| ファイル | パス | 内容 |
|---------|------|------|
| `home.tsx` | `GET /` | 銘柄検索ページ（SSR HTML） |
| `stock.tsx` | `GET /stock/:code` | 銘柄分析ページ（株価チャート + 指標カード） |
| `sync.ts` | `POST /api/sync` | JQuants → Neon データ同期（`X-Sync-Secret` 認証） |

## パターン

### HTML ページ（JSX レンダリング）

```typescript
import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import { someService } from '../services/someService'

export const someRoute = new Hono<{ Bindings: Bindings }>()

someRoute.get('/', async (c) => {
  const db = createDb(c.env.DATABASE_URL)
  const data = await someService(db, /* params */)
  return c.render(<SomePage data={data} />)
})
```

### JSON API エンドポイント

```typescript
someRoute.post('/api/something', async (c) => {
  // X-Secret-Header などで認証
  const secret = c.req.header('X-Sync-Secret')
  if (secret !== c.env.SYNC_SECRET) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const result = await doSomething(c.env)
  return c.json({ ok: true, ...result })
})
```

### エラーハンドリング

```typescript
someRoute.get('/stock/:code', async (c) => {
  const code = c.req.param('code')
  const db = createDb(c.env.DATABASE_URL)

  const stock = await stockService.findByCode(db, code)
  if (!stock) {
    return c.notFound()  // 404
  }
  return c.render(<StockPage stock={stock} />)
})
```

## 禁止事項

- ルートハンドラ内にビジネスロジックを書かない（サービス層に移動する）
- `process.env` を使わない（`c.env.XXX` を使う）
- クライアントサイド JS に依存する実装（MVP では SSR のみ）
