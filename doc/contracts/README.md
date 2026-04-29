# 互換契約 (Public Surface Contracts)

このディレクトリの文書は「内部実装をどう変えてもよいが、これだけは壊してはいけない」面を定義する。
詳細な背景は [doc/harness/05_互換契約と設定分離仕様.md](../harness/05_互換契約と設定分離仕様.md) を参照。

## 文書一覧

| 文書 | 対象 |
|---|---|
| [api.md](api.md) | HTTP API (`/api/sync`) と HTML/JSON ルート |
| [cli.md](cli.md) | `scripts/*.ts` の引数・env・exit code・stdout |
| [db.md](db.md) | Drizzle schema (`src/db/schema.ts`) のテーブル/カラム |
| [jobs.md](jobs.md) | Cloudflare Cron と GitHub Actions ワークフロー |
| [env.md](env.md) | 環境変数の境界 (secrets / 共有設定 / 個人設定) |

## 変更分類

各契約には「**additive change**」(既存利用者を壊さない追加) と「**breaking change**」(既存利用者を壊す変更) の境界を示す。

- additive: optional key 追加 / 新エンドポイント / 内部リファクタ
- breaking: 削除・rename・型変更・必須化・exit code の意味変更・cron 時刻変更

**breaking change は自動で進めず、人間レビューに返す** ([doc/harness/02 §8 中断条件](../harness/02_ハーネス全体仕様.md))。

## ルール

- 内部実装変更時は `bin/verify` を通すだけで OK
- 公開面に触れる変更は、まずこの文書を更新してから実装する
- 文書とテストの両方で守るのが原則 (片方だけに依存しない)
