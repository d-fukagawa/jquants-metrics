# リファクタリング実施レポート（更新版）

最終更新: 2026-03-13

## 1. 目的

- 重複ロジックの共通化
- ルート層とサービス層の責務分離
- 新機能（テーマ分析3画面）追加時の保守性確保

## 2. 実施済みリファクタリング

### 2.1 共通ユーティリティ

- `src/utils/stockCode.ts`
  - 4桁/5桁コード変換・正規化を一元化
- `src/utils/number.ts`
  - nullable 値の安全な数値パース
- `src/utils/date.ts`
  - 日付列挙処理を共通化

### 2.2 ルート層の整理

- `sync`, `watchlist`, `stock`, `home`, `screen`, `timeline`, `alpha`
  - 直接実装していたコード正規化/数値パースを共通関数へ寄せた
  - ルートは HTTP 入出力とオーケストレーションに限定

### 2.3 サービス層の整理

- `syncService`
  - 日足整形/upsertロジックの共通化
- `financialService`, `stockEdinetService`
  - 数値変換処理の統一
- `syncStatusService`
  - 集計ロジックの整理と並列化

### 2.4 テーマ機能追加に伴う構造化（2026-03-13）

- 新規テーブル
  - `themes`
  - `theme_stocks`
- 新規サービス
  - `themeService`（CRUD + 入力検証 + 日足/週足/月足再集計）
- 新規ルート
  - `themesRoute`（一覧/新規/編集/分析/メモ保存/削除）
- 新規フロントスクリプト
  - `public/static/theme-form.js`
  - `public/static/theme-analysis.js`

## 3. テスト

- 既存テスト: 回帰なし
- 新規テスト追加:
  - `src/services/themeService.test.ts`
  - `src/routes/themes.test.tsx`

実行結果（最新）:

- `npm run test`: 25 files, 205 tests passed
- `npm run build`: success

## 4. 運用改善

- Windows PowerShell でのデプロイ失敗（`$npm_execpath`）対策として、
  `npx wrangler pages deploy dist` を標準手順に統一。
- `.codex/prompts/deploy-pages-windows.md` を追加し、再発を回避。

## 5. 備考

- このレポートは「実施済み変更の要約」。
- 今後の未完了事項は `doc/todo.md`、全体方針は `doc/plan.md` を参照。
