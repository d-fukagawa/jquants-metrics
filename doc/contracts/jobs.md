# Jobs / Cron / GitHub Actions 契約

定期実行は 2 系統:

- Cloudflare Pages の Cron Trigger ([wrangler.jsonc](../../wrangler.jsonc) と [src/index.tsx](../../src/index.tsx) `scheduled` ハンドラ)
- GitHub Actions ワークフロー ([.github/workflows/](../../.github/workflows/))

## 1. Cloudflare Pages Cron

| | |
|---|---|
| 設定場所 | Cloudflare Dashboard > Pages > Settings > Functions > Cron Triggers (wrangler.jsonc では Pages 非対応) |
| Schedule | `0 1 * * *` (毎日 01:00 UTC = JST 10:00) |
| Handler | `scheduled(controller, env, ctx)` in [src/index.tsx](../../src/index.tsx) |
| 処理チェーン | `syncStockMaster` → `syncDailyPricesAll` (過去 7 日) |

### Breaking
- `scheduled` ハンドラの削除
- 処理チェーンの順序変更で副作用が変わる場合 (master → prices の順は前提)

### Additive
- 別の同期処理を末尾に追加
- 失敗時のログ出力強化

## 2. GitHub Actions ワークフロー

`verify.yml` は CI 専用 (PR / push)、それ以外は同期ジョブ。
**verify.yml は秘密情報を使わない**。同期 workflow は secrets 必須。

| Workflow | Cron | 主な処理 | Secrets |
|---|---|---|---|
| [verify.yml](../../.github/workflows/verify.yml) | (PR / push to main) | `bin/verify` | なし |
| [daily-sync.yml](../../.github/workflows/daily-sync.yml) | 平日 09:00 UTC | `daily-prices-sync.ts` | `DATABASE_URL`, `JQUANTS_API_KEY`, `DISCORD_WEBHOOK_URL` |
| [financial-sync.yml](../../.github/workflows/financial-sync.yml) | 日曜 09:30 UTC | `backfill-financials.ts` | 上記 + `EDINETDB_API_KEY`, `EDINET_API_KEY` |
| [edinet-watch-sync.yml](../../.github/workflows/edinet-watch-sync.yml) | 平日 10:15 UTC (daily) / 日曜 12:00 UTC (weekly) | `edinet-watch-sync.ts` | `DATABASE_URL`, `EDINETDB_API_KEY`, `DISCORD_WEBHOOK_URL` |
| [backfill-financials.yml](../../.github/workflows/backfill-financials.yml) | 毎月 1 日 13:00 UTC | `backfill-financials.ts` (大規模 backfill) | financial-sync.yml と同じ |
| [backfill-prices.yml](../../.github/workflows/backfill-prices.yml) | 土曜 11:00 UTC | `backfill-prices.ts` | `DATABASE_URL`, `JQUANTS_API_KEY`, `DISCORD_WEBHOOK_URL` |

### 共通動作

- `set +e` で exit code をキャプチャ → `PIPESTATUS[0]` で記録 → ジョブ末尾で fail 判定
- stdout を `tee sync.log` し `429` / `Too Many Requests` を grep して `rate_limited` フラグ化
- `if: always()` で [notify-discord.mjs](../../scripts/notify-discord.mjs) を呼ぶ
- 必ず `actions/checkout@v5` + `actions/setup-node@v5` (Node 24 forced rollout 対応済)

### Breaking
- 既存 cron schedule の時刻変更 (本番運用が依存)
- secret キー名 rename (GitHub 側の secret 設定と乖離)
- 手動トリガーの input parameter 名 rename
- `notify-discord.mjs` の呼び出し条件を狭める (現在 `if: always()`)
- スクリプト名変更 (workflow の `run:` 行が依存)

### Additive
- 新規 workflow 追加
- 既存 workflow に新しい `workflow_dispatch.inputs` を optional で追加
- `timeout-minutes` の延長
- 新しい通知先の追加

## 3. 手動 sync (`POST /api/sync`)

外部から叩く同期。詳細は [api.md §1](api.md#1-post-apisync)。
GitHub Actions の代替として、Cloudflare 上で動いているアプリに対して任意のタイミングで sync を投げられる。

### Breaking
- HTTP method / path / 認証ヘッダーの変更 ([api.md](api.md) と整合)
