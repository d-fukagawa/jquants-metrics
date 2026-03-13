# JQuants API v2 検証メモ（更新版）

最終更新: 2026-03-13
初回検証日: 2026-02-21

## 1. この資料の位置づけ

- 初回の API 可用性確認ログを、実装後の学びで補足したもの
- 実運用の仕様は `src/jquants/types.ts` と `src/jquants/client.ts` を正とする

## 2. 検証済みエンドポイント（現行）

| エンドポイント | 状況 | 備考 |
|---|---|---|
| `/v2/equities/master` | 利用中 | レスポンスルートは `data` |
| `/v2/equities/bars/daily` | 利用中 | 日次同期・バックフィルで利用 |
| `/v2/fins/summary` | 利用中 | `DiscNo` / `DiscDate` / `TA` を使用 |
| `/v2/fins/details` | 部分利用 | 契約プランにより 403 あり |

## 3. 実装時に確定した注意点

1. レスポンスルートキー
- `equities/master`, `bars/daily`, `fins/summary` は `data` 配下

2. 銘柄コード
- API は 5桁（例: `72030`）
- UIは4桁（例: `7203`）を受け、内部で5桁へ変換

3. 財務フィールド名
- `DisclosureNumber` ではなく `DiscNo`
- `DisclosureDate` ではなく `DiscDate`
- `TotalAssets` ではなく `TA`

4. BPS欠損
- BPSが空のケースがあるため、必要時は `Eq / (ShOutFY - TrShFY)` を代替利用

5. `fins/details` 制約
- プランにより `403 not available on your subscription` が発生する
- 現在は EDINET 側補完でカバレッジ改善を進行中

## 4. 運用メモ

- 429 はリトライ実装済み（待機して再試行）
- 日足は date 指定で全銘柄一括取得を活用
- 最新データ範囲/契約制限はプラン変更で変わるため、定期再確認する
