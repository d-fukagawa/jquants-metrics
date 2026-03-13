# jquants-metrics TODO（現行）

最終更新: 2026-03-13

## 完了済み

- [x] 銘柄検索・銘柄詳細（`/`, `/stock/:code`）
- [x] スクリーニング（`/screen`）
- [x] ウォッチ/メモ（`/watchlist`）
- [x] 開示タイムライン/サプライズ（`/timeline`, `/alpha`）
- [x] 高度財務指標（EV/EBITDA, NC比率, ROIC）
- [x] 調整後EBITDA（model）
- [x] テーマ分析3画面（`/themes`）
  - [x] テーマ一覧
  - [x] テーマ新規/編集
  - [x] テーマ分析（日足/週足/月足 + from/to + ECharts）
  - [x] テーマメモ常時編集 + 保存
  - [x] 銘柄上限6 + 並び替え + 完全削除

## 優先度: 高

- [ ] EDINETDB 補完で `fins_details` 欠損率を下げる
  - [ ] `debt_current`
  - [ ] `debt_non_curr`
  - [ ] `dna`
  - [ ] `pretax_profit`
  - [ ] `tax_expense`
- [ ] `/screen` で EV 系指標の表示率を改善
- [ ] `/sync-status` で補完前後の改善可視化を追加

## 優先度: 中

- [ ] テーマ分析のUX改善
  - [ ] 保存後フィードバック表示
  - [ ] 銘柄検索結果の操作性改善
  - [ ] チャート初期表示/凡例操作の改善
- [ ] テーマのエクスポート仕様検討（CSV/JSON）

## 優先度: 低

- [ ] 分足対応の再検討（データ取得・保存コストを含む）
- [ ] 追加指標（将来要件）

## 運用メモ

### デプロイ（Windows）

PowerShell では `npm run deploy` が `$npm_execpath` で失敗することがあるため、標準手順は以下。

```bash
npm run test
npm run build
npx wrangler pages deploy dist
```

### 同期

- 日次株価: GitHub Actions
- 財務/補完: 手動ワークフロー + 分割実行
- 手動API同期: `/api/sync`（`X-Sync-Secret` 必須）
