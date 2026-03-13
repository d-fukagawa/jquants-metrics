# リファクタリング実施レポート（2026-03-13）

## 目的
- プロジェクト全体で散在していた重複ロジック（コード正規化・数値変換・日付列挙・upsert前整形）を共通化し、保守性を向上。
- 既存挙動を維持したまま、ルート層とサービス層の責務を明確化。

## 実施内容

### 1. 共通ユーティリティ追加
- `src/utils/stockCode.ts`
  - 4桁コード正規化/検証、4桁⇄5桁変換を集約。
- `src/utils/number.ts`
  - 数値パース（`null/undefined/空文字`安全対応）と nullable string 変換を集約。
- `src/utils/date.ts`
  - `YYYY-MM-DD` の包含日付列挙を共通化。

### 2. ルート層の重複整理
- `src/routes/sync.ts`
  - 4桁コード検証を共通関数化。
  - `prices` 同期の既定日付を `syncService` 側定数参照に統一。
  - `code + '0'` の直書きを `toCode5()` へ統一。
- `src/routes/watchlist.tsx`
  - 4桁コード処理を共通ユーティリティに置換。
- `src/routes/stock.tsx`
  - `:code` 検証・5桁化・表示4桁化を共通ユーティリティへ統一。
- `src/routes/home.tsx`
  - コード表示処理を `toCode4()` に統一。
- `src/routes/screen.tsx`
  - クエリ数値パースを `parseOptionalNumber()` に統一。
  - ページングURL生成の数値パラメータ処理をループ化して重複削減。
- `src/routes/timeline.tsx`, `src/routes/alpha.tsx`
  - 数値パースとコード正規化処理を共通ユーティリティへ寄せた。

### 3. サービス層の整理
- `src/services/syncService.ts`
  - 日足データ整形/UPSERT処理を `mapDailyPriceRow` + `upsertDailyPriceRows` に共通化。
  - 既定日付を `DEFAULT_PRICE_SYNC_FROM/TO` として明示化。
  - nullable string 変換を共通ユーティリティへ移行。
  - 日付列挙処理を `enumerateDates()` 利用へ変更。
- `src/services/financialService.ts`
  - 数値変換を `parseNumber()` に統一し、内部重複を削減。
- `src/services/edinetSyncService.ts`
  - nullable string 変換を共通化。
- `src/services/stockEdinetService.ts`
  - 数値変換を共通化。
  - `timeline` のコードフィルタに共通コード正規化を適用。
- `src/services/stockService.ts`
  - `getStockByCode` を `ilike` から `eq` に変更（完全一致検索の意図を明確化）。
- `src/services/syncStatusService.ts`
  - 単一行取得ヘルパーを導入。
  - 集計SQLを `Promise.all` で並列化し、可読性と実行効率を改善。

### 4. テスト追加
- `src/utils/stockCode.test.ts`
- `src/utils/number.test.ts`
- `src/utils/date.test.ts`

## 検証結果
- `npm run test`: **成功**（22 files, 177 tests passed）
- `npm run build`: **成功**

## 備考
- 既存の未コミット変更は維持したまま、今回のリファクタリングを追加実施。
