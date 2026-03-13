# Drizzle スキーマ追加・マイグレーション

Drizzle ORM の公式ドキュメントを参照しながら、このプロジェクトの既存スキーマ構成に合わせて新しいテーブルまたはカラムを追加してください。

## 参照すべきファイル

@src/db/schema.ts
@src/db/CLAUDE.md
@drizzle.config.ts

## 作業手順

1. `src/db/schema.ts` に新しいテーブルまたはカラムを追加する
2. 既存テーブルのスタイルに倣う
   - PK は `primaryKey()` または複合 PK を使う
   - 数値フィールドは `numeric()` 型（JQuants API が文字列で返すため）
   - タイムスタンプは `timestamp('...', { withTimezone: true })`
3. `src/db/index.ts` に re-export を追加する（必要な場合）
4. マイグレーションを生成・確認する：
   ```bash
   npm run db:generate   # drizzle/ にマイグレーションファイルが生成される
   ```
5. 生成されたマイグレーションファイルを確認して問題がなければ適用：
   ```bash
   npm run db:migrate
   npm run db:studio     # テーブルを目視確認
   ```

## 注意事項

- マイグレーションファイル（`drizzle/` ディレクトリ）は手動編集しない
- `numeric` 型は文字列で返る（計算前に `Number()` 変換が必要）

## 入力情報

追加するテーブル・カラムの定義（用途、フィールド名、型、ソース API）を教えてください：
