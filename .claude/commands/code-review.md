# コードレビュー

このプロジェクトの規約に照らしてコードをレビューしてください。

## レビュー観点

### 必須チェック（Cloudflare Workers 制約）
- [ ] `process.env` を使っていないか（`c.env.XXX` を使うべき）
- [ ] Node.js 専用 API（`fs`, `path`, `createRequire`）を使っていないか
- [ ] `await` を忘れた非同期処理がないか

### JQuants API
- [ ] v2 エンドポイント（`/v2/`）を使っているか
- [ ] `x-api-key` ヘッダーで認証しているか（v1 のトークン方式は使わない）

### Drizzle ORM
- [ ] upsert は `onConflictDoUpdate` で冪等になっているか
- [ ] `numeric` 型の値を `Number()` 変換せずに計算していないか

### Hono JSX
- [ ] `class`/`for` を使っているか（`className`/`htmlFor` ではない）
- [ ] クライアントサイド JS に依存していないか（MVP は SSR のみ）

### アーキテクチャ
- [ ] ビジネスロジックがルートハンドラに書かれていないか（サービス層に移動）
- [ ] サービス関数が `c.env` を直接参照していないか（純粋関数として実装）

### テスト
- [ ] 主要な関数にテストがあるか
- [ ] エッジケース（null / 0 除算 / 空配列）がカバーされているか

## 参照すべきファイル

@CLAUDE.md
@src/services/syncService.ts

## 入力情報

レビューするファイルを指定してください（ファイルパスまたは `@` 参照）：
