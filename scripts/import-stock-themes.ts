/**
 * import-stock-themes.ts — 手動メンテJSONからテーマ情報を取り込む
 *
 * 実行方法:
 *   DATABASE_URL=... npx tsx scripts/import-stock-themes.ts data/stock-themes.json
 *
 * 環境変数:
 *   DATABASE_URL  Neon 接続文字列（必須）
 */

import { readFile } from 'node:fs/promises'
import { createDb } from '../src/db/client'
import { ThemeImportError, importStockThemes } from '../src/services/themeImportService'

const databaseUrl = process.env.DATABASE_URL
const jsonPath = process.argv[2]

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is required')
  process.exit(1)
}

if (!jsonPath) {
  console.error('ERROR: JSON file path is required')
  console.error('Usage: DATABASE_URL=... npx tsx scripts/import-stock-themes.ts data/stock-themes.json')
  process.exit(1)
}

let payload: unknown
try {
  payload = JSON.parse(await readFile(jsonPath, 'utf8'))
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[theme-import] invalid JSON file: ${message}`)
  process.exit(1)
}

try {
  const db = createDb(databaseUrl)
  const result = await importStockThemes(db, payload)
  console.log(
    `[theme-import] done themes=${result.themes} links=${result.links} skipped_user_links=${result.skippedUserLinks}`,
  )
} catch (error) {
  const message = error instanceof ThemeImportError || error instanceof Error
    ? error.message
    : String(error)
  console.error(`[theme-import] failed: ${message}`)
  process.exit(1)
}
