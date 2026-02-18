# jquants-metrics

JQuants API を使った日本株スクリーニング Web ツール。

## 概要

- 銘柄を選択して株価推移・財務指標（PER/PBR/ROE）を確認する簡易分析から開始
- 後続フェーズで条件指定フィルタリングや高度な指標（EV, ROIC, EBITDA）へ拡張予定

## 技術スタック

| 役割 | 採用技術 |
|------|----------|
| Web フレームワーク | [Hono](https://hono.dev/) + JSX（フルスタック） |
| データベース | [Neon](https://neon.tech/)（Serverless PostgreSQL） |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) |
| 言語 | TypeScript |
| デプロイ | [Cloudflare Pages](https://pages.cloudflare.com/) |
| データソース | [JQuants API v2](https://jpx-jquants.com/) |

## プロジェクト構成

```
jquants-metrics/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.toml
├── drizzle.config.ts
├── .dev.vars                   # ローカル用シークレット（gitignore）
├── doc/
│   ├── plan.md                 # 実装計画
│   └── mock/                   # UIモック（静的HTML）
├── public/
│   └── style.css
└── src/
    ├── index.tsx               # Hono エントリポイント
    ├── renderer.tsx            # ベースレイアウト
    ├── db/
    │   ├── client.ts           # DB接続
    │   └── schema.ts           # Drizzle スキーマ
    ├── jquants/
    │   ├── client.ts           # JQuants API クライアント
    │   └── types.ts            # API レスポンス型
    ├── routes/
    │   ├── index.tsx           # GET / - 銘柄検索
    │   ├── stock.tsx           # GET /stock/:code - 銘柄分析
    │   └── sync.ts             # POST /api/sync - データ同期
    ├── services/               # ビジネスロジック
    └── components/             # JSX コンポーネント
```

## セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定（.dev.vars を作成）
cp .dev.vars.example .dev.vars
# DATABASE_URL と JQUANTS_API_KEY を設定

# DB マイグレーション
npm run db:generate
npm run db:migrate

# ローカル開発サーバー起動
npm run dev
```

## 主要コマンド

```bash
npm run dev          # 開発サーバー起動（Vite）
npm run build        # ビルド
npm run preview      # ビルド後のローカルプレビュー（Wrangler）
npm run db:generate  # Drizzle マイグレーションファイル生成
npm run db:migrate   # DB マイグレーション実行
npm run db:studio    # Drizzle Studio（DB GUI）
npm run deploy       # Cloudflare Pages へデプロイ
```

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `DATABASE_URL` | Neon PostgreSQL 接続文字列 |
| `JQUANTS_API_KEY` | JQuants API キー（ダッシュボードで取得） |
| `SYNC_SECRET` | データ同期エンドポイントの保護用シークレット |

## ドキュメント

- [実装計画](doc/plan.md)

---

## プロンプトメモ

- vitest でユニットテストをして
- playwright でe2eテストを書いて
- vitest coverage でとってできる限りでカバレッジを改善して
- vitest bench でベンチマークを取って
- セキュリティ視点でレビューして
- パフォーマンス視点でレビューして
- SRE視点でレビューして
- 似たようなことをやってる他のOSSをcloneして、コード調べて
- この実装方法の最近のアカデミックのトレンドを調べて
- このインフラ構成でリリースした場合の、ActiveUser100人ごとの経費を試算して
- main ブランチをベースラインにパフォチュして
