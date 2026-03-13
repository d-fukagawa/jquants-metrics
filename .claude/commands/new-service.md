# 新規サービス作成

このプロジェクトの既存サービス構成に合わせて新しいサービス関数を作成してください。

## 参照すべきファイル

@src/services/stockService.ts
@src/services/financialService.ts
@src/services/CLAUDE.md

## 作成手順

1. `src/services/` に新しいファイルを作成する
2. `Db` インスタンスを引数で受け取る純粋関数として実装する（`c.env` は受け取らない）
3. Drizzle ORM の公式ドキュメントを参照してクエリを実装する
4. `numeric` 型の値は `Number()` で変換してから計算する
5. 対応するテストファイル（`*.test.ts`）も作成し、`npm run test` で通ることを確認する

## 入力情報

作成するサービスの役割と必要なクエリを教えてください：
