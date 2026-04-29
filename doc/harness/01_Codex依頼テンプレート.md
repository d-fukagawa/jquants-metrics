# Codex依頼テンプレート

以下は、Codex に実装を依頼する際の標準テンプレートである。

---

## 依頼文テンプレート

```md
# Task

## Goal
今回達成したいことを1〜3文で書く。

## Scope
変更してよいファイル、ディレクトリ、責務を書く。

## Out of Scope
今回変更してはいけないものを書く。

## Constraints
- 既存の公開 API は壊さない
- 既存の DB schema に破壊的変更を入れない
- 認証・認可・決済・Webhook は触らない
- bin/verify を最終的に通す
- 既存スタイルに沿う
- 設定と秘密情報を分離する

## Required Outputs
- 実装
- 必要なテスト
- 必要なドキュメント更新
- 変更理由の要約

## Acceptance Criteria
- [ ] `bin/verify` が通る
- [ ] 新規追加または変更した挙動をテストで説明できる
- [ ] 破壊的変更がない。ある場合は明示して停止する
- [ ] 新しい設定値を追加した場合は `.env.example` または設定文書を更新する
- [ ] 作業ログを定型フォーマットで報告する

## Output Format
1. 変更概要
2. 実行したコマンド
3. 追加 / 更新したファイル
4. 未解決事項
5. リスク
6. 次に人間が確認すべき点

## Stop Conditions
次の場合は自動で作業を進めず停止し、状況を報告すること。
- migration の追加や既存カラム変更が必要
- API / CLI / DOM の互換契約に影響する
- 本番用 secrets や外部認証が必要
- CI が再現不能
- 影響範囲が scope を超える
```

---

## 実例 1: `bin/verify` 導入

```md
# Task

## Goal
Rails アプリに共通検証入口 `bin/verify` を追加してください。
`bin/lint` と `bin/test` を呼び出し、最後に `bin/rails zeitwerk:check` が通る構成にしてください。

## Scope
- `bin/verify`
- 必要なら `bin/lint`
- 必要なら `bin/test`
- 必要なら `Makefile`
- 必要なら CI 文書

## Out of Scope
- deploy 設定
- 認証
- DB schema 変更
- 新規 gem の大量追加

## Constraints
- シンプルな bash で書く
- Ruby / Node の有無で不必要に失敗しない
- ローカルと CI の入口を揃える
- `bin/verify` の責務は「最終検証」に限定する

## Required Outputs
- `bin/verify`
- 必要最小限の関連更新
- 変更理由

## Acceptance Criteria
- [ ] `bin/verify` がローカルで実行可能
- [ ] 既存テストがあるなら `bin/test` から呼べる
- [ ] GitHub Actions から利用しやすい
- [ ] 実装が複雑すぎない

## Output Format
1. 変更概要
2. 実行したコマンド
3. 追加 / 更新したファイル
4. 未解決事項
5. リスク
6. 次に人間が確認すべき点

## Stop Conditions
- 既存コマンド体系と競合する
- 依存関係追加が大きすぎる
- CI 仕様が不明瞭で設計が一意に定まらない
```

---

## 実例 2: GitHub Actions 接続

```md
# Task

## Goal
既存の Rails アプリに GitHub Actions の CI を追加または整理してください。
CI からは `bin/verify` を唯一の検証入口として呼び出してください。

## Scope
- `.github/workflows/ci.yml`
- 必要なら `bin/setup`
- 必要なら CI 実行に必要な軽微修正

## Out of Scope
- deploy workflow
- preview 環境
- 本番 credentials
- セキュリティスキャンの高度化

## Constraints
- ローカルと同じコマンドを使う
- DB の準備は CI 内で再現可能にする
- 追加する設定は最小限にする

## Acceptance Criteria
- [ ] pull_request で CI が動く
- [ ] `bin/verify` が実行される
- [ ] DB を使う場合はセットアップが明示されている
- [ ] CI 専用ロジックが過剰でない
```

---

## 実例 3: 設定分離

```md
# Task

## Goal
アプリの設定を、repo 管理対象と個人環境依存情報に分離してください。
`.env.example` と設定文書を追加し、秘密情報が repo に入らない構成にしてください。

## Scope
- `.env.example`
- `docs/contracts/` 以外の設定文書
- 必要なら初期化コードの軽微修正

## Out of Scope
- 本番 secrets manager 連携
- deploy の変更
- 外部サービス接続の全面改修

## Constraints
- 本番用 token や秘密鍵は repo に置かない
- ローカル開発に必要な最小構成を明示する
- 環境変数の命名を整理する

## Acceptance Criteria
- [ ] `.env.example` がある
- [ ] 個人依存値と共有設定が分離されている
- [ ] README または文書から初期セットアップがわかる
```

---

## 運用ルール
- Codex には常に 1 つの主責務だけを渡す
- 完了条件は必ずチェックリストにする
- 破壊的変更の可能性がある作業は stop condition を厳しくする
- 「いい感じに」は禁止し、コマンド・ファイル・条件を明記する
