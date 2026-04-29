# HTTP API 契約

実装: [src/index.tsx](../../src/index.tsx) と [src/routes/](../../src/routes/)。
変更時は対応するテスト ([src/routes/*.test.tsx](../../src/routes/)) も併せて更新する。

## 1. `POST /api/sync`

GitHub Actions の同期 workflow と手動 sync が叩く外部接点。

実装: [src/routes/sync.ts](../../src/routes/sync.ts)

### 認証

```
X-Sync-Secret: <SYNC_SECRET の値>
```

ヘッダー名・キーは固定。一致しない場合は **401** `{ error: 'Unauthorized' }`。

### Request body (JSON)

`target` フィールドで分岐するタグ付きユニオン。

| target | 必須 | 任意 |
|---|---|---|
| `master` | — | — |
| `prices` | `code` | `from`, `to` |
| `financials` | `code` | — |
| `fins_details` | `code` | — |
| `edinet_timeline` | `code` | `from`, `to` |
| `edinet_forecasts` | `code` | — |
| `edinet_bridge` | `code` | — |
| `edinet_quality_scores` | `code` | — |
| `edinet_text_scores` | `code` | — |

- `code`: 4 文字英数字 (例: `7203`)。`parseCode4` で検証。
- `from` / `to`: `YYYY-MM-DD`。

### Response shape

| status | body | 用途 |
|---|---|---|
| 200 | `{ ok: true, target, synced, ...optional }` | 成功 |
| 400 | `{ error: 'Invalid JSON body' }` | JSON パース失敗 |
| 400 | `{ error: 'invalid target' }` | 不明な target |
| 400 | `{ error: 'code must be a 4-char alphanumeric' }` | code 検証失敗 |
| 401 | `{ error: 'Unauthorized' }` | secret 不一致 |
| 500 | `{ ok: false, error }` | サーバエラー (DB 接続文字列はマスク) |

200 の `optional` は target 別に追加されることがある: `code`, `fallback`, `details_source`, `tax_expense_filled_count`, `adjustments_filled_count`, `skipped`, `reason`。

### Breaking change の例

- POST 以外への変更
- `X-Sync-Secret` ヘッダー名 rename
- `target` キーの rename / 削除
- 既存 `target` 値の意味変更
- `ok` キーの shape 変更 (boolean → string 等)
- 200 status を 204 にする等の status 変更
- 401 を 403 にする等の status 変更

### Additive change の例

- 新しい `target` 値の追加
- 200 response への optional フィールド追加
- 新しい query / body フィールドを optional で追加

---

## 2. HTML / JSON ルート一覧

`app.route()` 登録は [src/index.tsx](../../src/index.tsx)。

| パス | レスポンス | 役割 |
|---|---|---|
| `GET /` | HTML | 銘柄検索フォーム |
| `GET /stock/:code` | HTML | 個別銘柄詳細 |
| `GET /stock/:code/verdict` | HTML | バリュエーション判定ビュー |
| `GET /screen` | HTML | スクリーニング結果 |
| `GET /sync-status` | HTML | 同期状況 |
| `GET /timeline` | HTML | EDINET 開示タイムライン |
| `GET /alpha` | HTML | サプライズ抽出 |
| `GET /watchlist` | HTML | ウォッチリスト + メモ |
| `POST /watchlist/...` | redirect | メモ操作 |
| `GET /themes` ほか | HTML / redirect | テーマ機能一式 |
| `POST /api/sync` | JSON | 上記 §1 |

### Breaking change の例

- 既存パスの rename / 削除
- HTML を返していたパスを JSON にする (またはその逆)
- redirect を 200 にする

### Additive change の例

- 新規パス追加
- 新規 query parameter を optional で追加
