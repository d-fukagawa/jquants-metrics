# Step 0.5 補足調査: jquants-api-client-python の評価

調査日: 2026-02-21
リポジトリ: https://github.com/J-Quants/jquants-api-client-python

---

## ライブラリ概要

JQuants が公式に提供する Python クライアントライブラリ。

| 項目 | 内容 |
|------|------|
| バージョン | v2.0.0（2026-01-19 リリース） |
| 最終更新 | 2026-02-20 |
| スター | 179 |
| ライセンス | Apache 2.0 |
| Python | 3.10 以上 |

## 対応エンドポイント（主要）

- 株式: `get_eq_master`, `get_eq_bars_daily`, `get_eq_bars_daily_range`
- 財務: `get_fin_summary`, `get_fin_details`, `get_fin_dividend`
- 指数: `get_idx_bars_daily`, `get_idx_bars_daily_topix`
- 市場: `get_mkt_short_ratio`, `get_mkt_margin_interest` ほか
- デリバティブ: `get_drv_bars_daily_fut`, `get_drv_bars_daily_opt` ほか
- ユーティリティ: `get_bulk_list`, `get_bulk`, `get_market_segments` ほか

## 技術的特性

| 機能 | 内容 |
|------|------|
| 認証 | `x-api-key` ヘッダー（v2 形式）または環境変数 `JQUANTS_API_KEY` |
| 返却形式 | **pandas DataFrame** |
| リトライ | tenacity（429/5xx を最大 3 回自動リトライ） |
| 並列取得 | `_range` 系メソッドが ThreadPoolExecutor で日付ごとに並列リクエスト |
| ページネーション | `pagination_key` に自動対応 |

## TypeScript/Hono との比較

| 観点 | TypeScript/Hono | Python |
|------|----------------|--------|
| JQuants クライアント | 自前実装（3 本なら数十行） | 公式ライブラリ（30 本以上）|
| Web フレームワーク | Hono + JSX（フルスタック） | FastAPI + Jinja2 など別途必要 |
| デプロイ | Cloudflare Pages（一発）| Render / Railway など別サービス |
| コスト | 無料枠で収まる | Python ホスティングは制約大 |
| 言語統一 | TS 一本 | フロント＋バックで分離 |
| pandas の恩恵 | 不要（Web 表示用 JSON で十分）| Phase 2+ の集計で便利 |
| 冷起動 | Workers = ほぼゼロ | サーバーレス Python は遅い |

## 結論

**Phase 1 は TypeScript/Hono で継続。**

- 今フェーズで使う API は 3 エンドポイントのみ。Python クライアントの強みは過剰。
- Cloudflare Pages の無料・エッジ・ゼロ冷起動を活かす構成の方が合理的。
- pandas が真価を発揮するのはスクリーニング集計が複雑化する Phase 2/3 以降。

## 将来の選択肢（ハイブリッド構成）

Phase 2/3 以降、データ量・集計の複雑さが増した場合は以下の構成が候補になる。

```
[Python バッチ（cron）]        Neon DB         [Hono Web アプリ]
 jquants-api-client で  →  （集計済みデータ）  ←  （閲覧・スクリーニング）
 同期・前処理
```

- Python：データ取得・前処理・DB 書き込みに特化
- Hono：Web 表示・ルーティングに特化
- 現時点では不要。スコープが固まってから再検討する。
