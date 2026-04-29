# 環境変数 / Secrets 契約

設定の境界は 3 層:

1. **共有設定** (repo に置く): `.dev.vars.example`, `wrangler.jsonc`, `biome.json`, `tsconfig.json`, `.nvmrc`, `doc/`, `.github/workflows/`
2. **個人設定** (repo に置かない): `.dev.vars` (gitignore 済), 個人 token
3. **本番 secrets** (repo に置かない): GitHub Actions Secrets, Cloudflare Pages Secret Bindings

[.dev.vars.example](../../.dev.vars.example) を `.env.example` に rename しないのは、Cloudflare Workers / Wrangler の慣習に揃えているため (Bindings は wrangler.jsonc + `.dev.vars` 経由で渡る)。

## Cloudflare Bindings (`src/types.ts`)

ランタイム経由で `c.env.*` で参照する。

| 名前 | 種別 | 用途 |
|---|---|---|
| `DATABASE_URL` | secret | Neon 接続文字列 |
| `JQUANTS_API_KEY` | secret | JQuants API v2 認証 |
| `EDINETDB_API_KEY` | secret | EDINETDB API |
| `EDINET_API_KEY` | secret | 公式 EDINET API |
| `SYNC_SECRET` | secret | `/api/sync` 認証ヘッダー検証 |

ローカル: [.dev.vars](../../.dev.vars) (gitignore)。本番: `wrangler pages secret put <NAME>`。
**コード内で `process.env.*` を読まない**。Cloudflare Workers では undefined。`c.env.*` を使う。

## GitHub Actions Secrets

ワークフローから参照される secrets。GitHub Web UI > Settings > Secrets and variables > Actions で設定。

| Secret 名 | 用途 | 利用 workflow |
|---|---|---|
| `DATABASE_URL` | Neon 接続 | 全 sync workflow |
| `JQUANTS_API_KEY` | JQuants API | daily / backfill-prices / financial-sync |
| `EDINETDB_API_KEY` | EDINET DB API | edinet-watch-sync / financial-sync |
| `EDINET_API_KEY` | 公式 EDINET API | financial-sync |
| `DISCORD_WEBHOOK_URL` | 失敗通知 | 全 sync workflow (`if: always()`) |

**Cloudflare 側の secret と GitHub Actions 側の secret は別管理**。両方に同じ値が必要。

## Scripts が読む env (process.env)

Workers ランタイムではなく Node.js (tsx) で動くため、`scripts/*.ts` は `process.env.*` を直読する。
詳細リスト: [cli.md](cli.md) 各スクリプト節。

主要 default:

| 変数 | default |
|---|---|
| `EDINET_SYNC_MODE` | `daily` |
| `MAX_CODES_DAILY` | 30 |
| `MAX_DEEP_DIVE_DAILY` | 8 |
| `MAX_CODES_WEEKLY` | 40 |
| `TIMELINE_LOOKBACK_DAYS` | 2 |
| `SLEEP_MS` | 700 (edinet) / 1000 (backfill-fin) |
| `RATE_LIMIT_PER_MIN` | 60 |
| `BACKFILL_DAYS` | 180 |

default は workflow の `workflow_dispatch.inputs` で上書きされる。

## .dev.vars.example (共有)

[.dev.vars.example](../../.dev.vars.example) はローカル開発に必要な最小キー一覧。
- ダミー値のみ。本番値を入れない。
- 新しい必須 binding を追加した時はここを更新する (これが個人セットアップの真実)。

## 典型的な事故

- `process.env.DATABASE_URL!` を Workers コードに書く → 本番で undefined
- `.dev.vars` を git add してしまう (`.gitignore` 確認)
- `.dev.vars.example` に本番値を貼る
- GitHub Actions 側でしか secret を設定せず、Cloudflare Bindings 側を忘れる (またはその逆)

## Breaking change の例

- secret キー名 rename (Bindings / GitHub Actions の両方が壊れる)
- 必須 env を増やす (既存 deploy / workflow run が失敗)
- default 値の変更 (`MAX_CODES_DAILY: 30 → 10` など、本番挙動が変わる)

## Additive change の例

- 新しい optional env を default 付きで追加
- `.dev.vars.example` に新しい必須 binding を **追加** + 文書化 (既存値はそのまま)
- 新しい workflow secret を追加
