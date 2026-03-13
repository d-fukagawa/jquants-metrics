# JQuants API エンドポイント追加

JQuants API v2 の公式ドキュメントを参照しながら、このプロジェクトの既存クライアント構成に合わせて新しい API エンドポイントを追加してください。

## 参照すべきファイル

@src/jquants/client.ts
@src/jquants/types.ts
@src/services/syncService.ts

## 作業手順

1. `src/jquants/types.ts` にレスポンス型を追加する
   - JQuants v2 フィールド名はキャメルケースではなく大文字略称（例: `O`, `H`, `L`, `C`, `Vo`）
   - レスポンスは `{ data: T[] }` 形式

2. `src/jquants/client.ts` に fetch 関数を追加する
   ```typescript
   // 認証: x-api-key ヘッダー（v1 のトークン方式は使わない）
   export async function fetchXxx(apiKey: string, ...): Promise<XxxItem[]> {
     const data = await get<XxxResponse>(apiKey, '/xxx/endpoint', { ...params })
     return data.data
   }
   ```

3. 必要に応じて `src/services/syncService.ts` に同期関数を追加する
   - upsert は `onConflictDoUpdate` で冪等に実装する
   - バッチ処理は `BATCH_SIZE = 500` 単位で行う
   - Free プランのレート制限（5 req/min）に注意する

4. テストを作成して `npm run test` で通ることを確認する

## 注意事項

- エンドポイント URL は `/v2/` で始まる（`/v1/` は廃止済み）
- Free プランで取得可能なデータ範囲を事前に確認する
- 空文字列フィールドは `null` に変換する（`toNum()` ヘルパー参照）

## 入力情報

追加する JQuants v2 エンドポイント（URL、取得したいデータ）を教えてください：
