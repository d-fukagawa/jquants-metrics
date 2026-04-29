# jquants-metrics

日本株スクリーニング・分析 Web ツール。JQuants API v2 + Hono + Cloudflare Pages。

プロジェクト計画: @doc/plan.md
技術スタック・スキーマ詳細: @doc/plan.md
互換契約 (壊してはいけない公開面): @doc/contracts/README.md

## 開発コマンド

```bash
bin/verify           # 最終検証 (biome + tsc + vitest + build)。PR 前に必ず通す。
bin/lint             # biome check + tsc --noEmit
bin/test             # vitest run
bin/setup            # npm ci

npm run dev          # Vite dev server（ローカル開発）
npm run build        # ビルド
npm run preview      # wrangler pages dev（本番相当）
npm run test         # Vitest 実行
npm run db:generate  # Drizzle マイグレーション生成
npm run db:migrate   # Neon に適用
npm run db:studio    # Drizzle Studio（テーブル確認）
```

## 環境変数（Cloudflare Bindings）

ローカル: `.dev.vars`（gitignore 済み）。本番: `wrangler pages secret put`。

```typescript
// src/types.ts の Bindings 型
DATABASE_URL      // Neon 接続文字列
JQUANTS_API_KEY   // JQuants API キー
SYNC_SECRET       // /api/sync 保護用シークレット
```

## 重要な制約（必ず守ること）

### Cloudflare Workers — Node.js API は使えない

```typescript
// ✅ 正しい
const db = createDb(c.env.DATABASE_URL)

// ❌ 禁止: Workers では undefined
const db = createDb(process.env.DATABASE_URL!)

// 🚫 禁止: Node.js 専用 API
import fs from 'fs'   // NG
import path from 'path'  // NG
```

### JQuants API — v2 のみ（v1 廃止済み）

```typescript
// ✅ v2: x-api-key ヘッダー認証
fetch('https://api.jquants.com/v2/...', {
  headers: { 'x-api-key': apiKey }
})
// ❌ v1（廃止）: トークンリフレッシュ方式は使わない
```

### Drizzle ORM — 必ず await、upsert は onConflictDoUpdate

```typescript
// ✅ 正しい
await db.insert(table).values(rows).onConflictDoUpdate({ ... })

// ❌ await 忘れ・2 ステップ処理は禁止
```

### Hono JSX — class / for（React の className / htmlFor ではない）

```tsx
// ✅ 正しい
<div class="card"><label for="name">名前</label></div>

// ❌ React 記法は使わない（useState, useEffect も不可）
```

## コーディング規約

- Drizzle の `numeric` 型は文字列で返る → 計算前に `Number()` 変換
- 銘柄コードは 5 桁文字列（例: `"72030"`）。4 桁ではない
- サービス層は純粋関数（`c.env` を受け取らず `db` と値だけ受け取る）
- PER / PBR / ROE は DB に持たずクエリ時に計算する

## 参考資料

- [Claude Code ベストプラクティス](https://code.claude.com/docs/en/best-practices)
