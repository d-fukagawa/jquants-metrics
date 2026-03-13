# Step 0.5 補足調査: jquants-api-client-python の評価（履歴）

最終更新: 2026-03-13
初回調査日: 2026-02-21
対象: https://github.com/J-Quants/jquants-api-client-python

## 1. この資料の位置づけ

このドキュメントは「Phase 0.5 時点での比較検討ログ」。
現行実装の方針は `doc/plan.md` を正とする。

## 2. 当時の評価ポイント（要約）

- Python公式クライアントは対応API範囲が広く、DataFrame連携が強い
- 本プロジェクトは Cloudflare Pages + Hono のため、
  Webアプリ本体の言語統一（TypeScript）を優先
- Phase 1〜5 の実装では TypeScript 直実装の方が運用コストが低い

## 3. 現在の結論（2026-03-13 時点）

- Webアプリ本体は引き続き TypeScript/Hono を継続
- Pythonクライアントは以下用途でのみ再検討対象:
  - 大規模なオフライン集計バッチ
  - DataFrame 前提の分析パイプライン
  - Web配信と分離したETL専用ワーカー

## 4. 再検討トリガー

次の条件を満たした場合に、ハイブリッド構成を再評価する。

- 日次処理の計算量が現行ワークフローを継続的に超える
- pandasベースの集計が開発速度/品質を明確に改善する
- 運用監視・障害対応の責務分離が必要になる
