# CLIとローカル再現仕様

## 目的
CLI を、人間と Codex が共有する唯一の安定した操作面にする。

---

## 1. 設計原則

### 原則 1: `bin/*` を真実にする
- README ではなく `bin/*` が正
- GitHub Actions も `bin/*` を呼ぶ
- Makefile は薄いラッパーに留める

### 原則 2: 1 コマンド 1 責務
- `bin/setup`: セットアップ
- `bin/lint`: lint / 静的検査
- `bin/test`: テスト
- `bin/verify`: 最終検証
- `bin/verify-changed`: 差分検証

### 原則 3: 失敗は exit code で返す
標準出力に成功っぽい文を出しても exit code が 0 でなければ失敗とみなす。

---

## 2. 各コマンド仕様

## `bin/setup`
### 目的
ローカルと CI の初期化手順を極力共通化する。

### 必須処理
- bundle install
- JS 依存の install
- `bin/rails db:prepare`
- キャッシュや不要ファイルの掃除

### 禁止
- 本番 secrets 前提
- 個人 PC 固有パス依存
- 対話式入力必須

---

## `bin/lint`
### 目的
静的検査とセキュリティ検査を集約する。

### 候補
- `bundle exec rubocop`
- `bundle exec brakeman -q`
- `npm run lint`
- `npm run typecheck`

### 仕様
- JS がない場合は不要に失敗しない
- lint 失敗を無視しない
- 警告の扱いはプロジェクトルールに従う

---

## `bin/test`
### 目的
アプリのテスト実行を集約する。

### 候補
- `bundle exec rspec`
- frontend test があれば呼ぶ

### 仕様
- テスト専用 DB を前提にする
- ローカルと CI で同じ呼び方にする
- 失敗した spec を明示できると望ましい

---

## `bin/verify`
### 目的
最終的な品質確認の単一入口。

### 必須処理
1. `bin/lint`
2. `bin/test`
3. `bin/rails routes > /dev/null`
4. `bin/rails zeitwerk:check`

### 仕様
- ここを通れば PR を出せる状態に近い
- ここに差分限定最適化を入れすぎない
- 依存関係のインストールは含めない

---

## `bin/verify-changed`
### 目的
差分だけを高速に検証し、イテレーションを早くする。

### 仕様
- `git diff` で changed files を取る
- Ruby 変更があるなら該当 lint
- spec 変更があるなら該当 spec
- JS 変更があるなら JS lint / typecheck

### 注意
- これは補助コマンド
- merge 前の最終判断は `bin/verify`

---

## 3. Makefile 方針

### 目的
人間が覚えやすい入口を用意する。

### 仕様
- `make verify` は `./bin/verify` を呼ぶだけ
- Makefile にロジックを書きすぎない
- 真実は `bin/*`

---

## 4. ローカル再現要件

### 必須
- Ruby / Node のバージョン固定
- DB 起動と接続先が明示されている
- 初回セットアップ手順が 1 回で通る
- test / development の切り替えが明示されている

### 望ましい
- Docker / devcontainer / mise / asdf のいずれかで再現支援
- README に概要だけ置き、詳細は `bin/*` に寄せる

---

## 5. Codex に対する指示原則
CLI まわりを触らせるときは、以下を明示する。

- どのコマンドを追加するか
- 各コマンドの責務
- 既存コマンドを壊さないこと
- `bin/verify` を最終入口にすること
- Makefile を厚くしないこと

---

## 6. 完了条件
CLI 改修タスクの完了条件は以下。

- [ ] `bin/*` が実行可能
- [ ] 依存がない環境で不必要に落ちない
- [ ] exit code が正しい
- [ ] CI から呼びやすい
- [ ] README だけに依存していない
