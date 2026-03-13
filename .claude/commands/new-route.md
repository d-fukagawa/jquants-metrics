# 新規ルートハンドラ作成

Hono の公式ドキュメントを参照しながら、このプロジェクトの既存ルート構成（`src/routes/`）に合わせて新しいルートハンドラを作成してください。

## 参照すべきファイル

@src/routes/home.tsx
@src/routes/stock.tsx
@src/routes/CLAUDE.md

## 作成手順

1. `src/routes/` に新しいファイルを作成する
2. `Hono<{ Bindings: Bindings }>()` を使ってルートを定義する
3. ビジネスロジックは `src/services/` に実装し、ルートから呼び出す形にする
4. `src/index.tsx` に `app.route(...)` を追加して登録する

## 入力情報

作成するルートのパスと目的を教えてください：
