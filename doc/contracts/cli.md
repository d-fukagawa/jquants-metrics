# CLI 契約

`scripts/*.ts` および `scripts/*.mjs` は GitHub Actions ワークフローから呼ばれるため、CLI 入出力は契約面である。
実装は [scripts/](../../scripts/)。

## 共通契約

- **実行方法**: `npx tsx scripts/<name>.ts` (Cron は [.github/workflows/*.yml](../../.github/workflows/) からこの形で起動)
- **必須 env が無いとき**: `process.exit(1)` (CI の判定基準)
- **stdout 形式**: 各スクリプトは固定プレフィックス (`[price-sync]`, `[edinet-watch-sync]`, `[fin-backfill]`, `[backfill]`) で行を出す。grep / log scraping (`429` 検出など) が依存している。
- **exit code**: `0` = 成功、非 0 = 失敗。GitHub Actions の `PIPESTATUS` キャプチャがこれに依存。

## scripts/daily-prices-sync.ts

| | |
|---|---|
| 必須 env | `DATABASE_URL`, `JQUANTS_API_KEY` |
| 任意 env | `SYNC_FROM` (YYYY-MM-DD, default 当日 JST), `SYNC_TO` (default 当日 JST) |
| 引数 | なし |
| stdout プレフィックス | `[price-sync]` |
| 呼び出し元 workflow | [daily-sync.yml](../../.github/workflows/daily-sync.yml) (平日 09:00 UTC) |

## scripts/edinet-watch-sync.ts

| | |
|---|---|
| 必須 env | `DATABASE_URL`, `EDINETDB_API_KEY` |
| 任意 env | `EDINET_SYNC_MODE` (`daily` \| `weekly`, default `daily`), `WATCHLIST_BOOTSTRAP_CODES` (CSV 4桁), `MAX_CODES_DAILY` (30), `MAX_DEEP_DIVE_DAILY` (8), `MAX_CODES_WEEKLY` (40), `TIMELINE_LOOKBACK_DAYS` (2), `SLEEP_MS` (700) |
| テスト用 | `VITEST` 環境では env 検査をスキップ |
| 引数 | なし |
| stdout プレフィックス | `[edinet-watch-sync]` |
| 呼び出し元 workflow | [edinet-watch-sync.yml](../../.github/workflows/edinet-watch-sync.yml) (平日 10:15 UTC daily / 日曜 12:00 UTC weekly) |

## scripts/backfill-financials.ts

| | |
|---|---|
| 必須 env | `DATABASE_URL`, `JQUANTS_API_KEY` |
| `INCLUDE_DETAILS=true` で必須 | `EDINETDB_API_KEY`, `EDINET_API_KEY` |
| 任意 env | `SHARD` (0), `SHARDS` (1), `SLEEP_MS` (1000), `RETRY_PER_CODE` (2), `INCLUDE_DETAILS` (`true`), `EDINET_FALLBACK_ON_403` (`true`), `RATE_LIMIT_PER_MIN` (60) |
| 引数 | なし |
| stdout プレフィックス | `[fin-backfill]` |
| 呼び出し元 workflow | [financial-sync.yml](../../.github/workflows/financial-sync.yml), [backfill-financials.yml](../../.github/workflows/backfill-financials.yml) |

## scripts/backfill-prices.ts

| | |
|---|---|
| 必須 env | `DATABASE_URL`, `JQUANTS_API_KEY` |
| 任意 env | `BACKFILL_FROM` (180日前), `BACKFILL_TO` (昨日), `BACKFILL_DAYS` (180), `INCLUDE_WEEKENDS` (`false`), `RETRY_PER_DATE` (3) |
| 引数 | なし |
| stdout プレフィックス | `[backfill]` |
| 呼び出し元 workflow | [backfill-prices.yml](../../.github/workflows/backfill-prices.yml) (土曜 11:00 UTC) |

## scripts/notify-discord.mjs

| | |
|---|---|
| 必須 env | なし (`DISCORD_WEBHOOK_URL` 未設定なら exit 0) |
| 任意 env | `DISCORD_WEBHOOK_URL`, `JOB_STATUS`, `RATE_LIMITED`, `DISCORD_USERNAME` (`jquants-metrics`), `GITHUB_*` (Actions コンテキスト) |
| 引数 | なし |
| 出力 | Discord webhook へ JSON POST |
| 呼び出し元 workflow | 全 sync workflow が `if: always()` で呼ぶ |

## bin/* (harness 入口)

| | |
|---|---|
| `bin/setup` | `npm ci`。DB マイグレは含めない (Neon は共有インフラ)。 |
| `bin/lint` | `biome check .` → `tsc --noEmit` |
| `bin/test` | `vitest run` |
| `bin/verify` | `bin/lint` → `bin/test` → `npm run build` (PR 前最終検証) |

各スクリプトは `set -euo pipefail`。exit code 伝播。

## Breaking change の例

- スクリプト名 rename / 削除 (workflow が直参照)
- 必須 env キー名 rename
- 既存 stdout プレフィックスの変更 (`[price-sync]` → `[prices]` など)
- exit code の意味変更
- bin/* の入口名・責務の変更

## Additive change の例

- 新しい任意 env の追加 (default あり)
- stdout への新しい行を追加 (既存プレフィックスは保持)
- bin/* に新規エントリ追加 (`bin/verify-changed` 等)
