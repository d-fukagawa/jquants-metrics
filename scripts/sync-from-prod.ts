/**
 * sync-from-prod.ts — 本番 (Neon main branch) → ローカル (dev branch) DB 同期
 *
 * 動作:
 *   1. ローカルのユーザー編集テーブル (themes, theme_stocks, stock_memo_meta, stock_memos)
 *      を JSON ファイルに退避
 *   2. neonctl で dev branch を parent (main) から reset
 *   3. 退避した JSON を upsert で復元
 *
 * 実行方法:
 *   DATABASE_URL=... NEON_API_KEY=... NEON_DEV_BRANCH_ID=... \
 *     npx tsx scripts/sync-from-prod.ts
 *
 * 環境変数:
 *   DATABASE_URL        ローカル dev branch の Neon 接続文字列 (必須)
 *   NEON_API_KEY        Neon API キー (neonctl が読む / 必須)
 *   NEON_DEV_BRANCH_ID  reset 対象の dev branch ID または名前 (必須)
 *   NEON_PROJECT_ID     reset 対象の Neon project ID (任意。project-scoped API key では必須)
 *   SYNC_SKIP_RESET     "1" を指定すると branch reset をスキップ (退避と復元のみ)
 */

import { execFile } from 'node:child_process'
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { sql } from 'drizzle-orm'
import { type Db, createDb } from '../src/db/client'
import { stockMemoMeta, stockMemos, themeStocks, themes } from '../src/db/schema'
import { buildResetBranchArgs } from './neonctl-args'

const execFileP = promisify(execFile)

const databaseUrl = process.env.DATABASE_URL
const databaseUrlProd = process.env.DATABASE_URL_PROD
const neonApiKey = process.env.NEON_API_KEY
const devBranchId = process.env.NEON_DEV_BRANCH_ID
const neonProjectId = process.env.NEON_PROJECT_ID
const skipReset = process.env.SYNC_SKIP_RESET === '1'

if (!databaseUrl || !neonApiKey || !devBranchId) {
  console.error('ERROR: DATABASE_URL, NEON_API_KEY, NEON_DEV_BRANCH_ID are all required')
  process.exit(1)
}

function endpointHost(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

if (databaseUrlProd) {
  const devHost = endpointHost(databaseUrl)
  const prodHost = endpointHost(databaseUrlProd)
  if (devHost && prodHost && devHost === prodHost) {
    console.error(
      `ERROR: DATABASE_URL points to the same endpoint as DATABASE_URL_PROD (${devHost}). ` +
        'これは production branch を指している可能性が高いので reset を中止します。' +
        '\n.dev.vars の DATABASE_URL を dev branch のものに切り替えてください。',
    )
    process.exit(1)
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type Snapshot = {
  themes: (typeof themes.$inferSelect)[]
  themeStocks: (typeof themeStocks.$inferSelect)[]
  stockMemoMeta: (typeof stockMemoMeta.$inferSelect)[]
  stockMemos: (typeof stockMemos.$inferSelect)[]
}

async function dumpUserTables(db: Db): Promise<Snapshot> {
  const [t, ts, smm, sm] = await Promise.all([
    db.select().from(themes),
    db.select().from(themeStocks),
    db.select().from(stockMemoMeta),
    db.select().from(stockMemos),
  ])
  return { themes: t, themeStocks: ts, stockMemoMeta: smm, stockMemos: sm }
}

async function writeSnapshot(snap: Snapshot): Promise<string> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = path.resolve('tmp/db-snapshot')
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, `${stamp}.json`)
  await writeFile(file, JSON.stringify(snap, null, 2), 'utf8')
  return file
}

const KEEP_RECENT_SNAPSHOTS = 5

async function pruneOldSnapshots(): Promise<number> {
  const dir = path.resolve('tmp/db-snapshot')
  const entries = await readdir(dir).catch(() => [] as string[])
  const jsons = entries.filter((n) => n.endsWith('.json')).sort()
  if (jsons.length <= KEEP_RECENT_SNAPSHOTS) return 0
  const toDelete = jsons.slice(0, jsons.length - KEEP_RECENT_SNAPSHOTS)
  await Promise.all(toDelete.map((n) => unlink(path.join(dir, n))))
  return toDelete.length
}

async function resetDevBranch(branchId: string): Promise<void> {
  const args = buildResetBranchArgs(branchId, neonApiKey!, neonProjectId)
  // npx 経由で実行 (devDep として neonctl を入れる前提)
  const { stdout, stderr } = await execFileP('npx', args, {
    env: { ...process.env, NEON_API_KEY: neonApiKey! },
    shell: process.platform === 'win32',
  })
  if (stdout.trim()) console.log(`[neonctl] ${stdout.trim()}`)
  if (stderr.trim()) console.warn(`[neonctl:stderr] ${stderr.trim()}`)
}

async function awaitBranchReady(db: Db, maxMs = 60_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      await db.execute(sql`select 1`)
      return
    } catch (err) {
      console.log(`[wait] branch not ready yet (${(err as Error).message})`)
      await sleep(2000)
    }
  }
  throw new Error(`branch did not become ready within ${maxMs}ms`)
}

async function restoreUserTables(db: Db, snap: Snapshot): Promise<void> {
  if (snap.themes.length > 0) {
    await db.insert(themes).values(snap.themes).onConflictDoUpdate({
      target: themes.id,
      set: {
        name: sql`excluded.name`,
        memo: sql`excluded.memo`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
  }
  if (snap.themeStocks.length > 0) {
    await db.insert(themeStocks).values(snap.themeStocks).onConflictDoUpdate({
      target: [themeStocks.themeId, themeStocks.code],
      set: {
        sortOrder: sql`excluded.sort_order`,
      },
    })
  }
  if (snap.stockMemoMeta.length > 0) {
    await db.insert(stockMemoMeta).values(snap.stockMemoMeta).onConflictDoUpdate({
      target: stockMemoMeta.code,
      set: {
        isWatched: sql`excluded.is_watched`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
  }
  if (snap.stockMemos.length > 0) {
    await db.insert(stockMemos).values(snap.stockMemos).onConflictDoUpdate({
      target: stockMemos.id,
      set: {
        body: sql`excluded.body`,
        updatedAt: sql`excluded.updated_at`,
      },
    })
  }
}

const localDb = createDb(databaseUrl)

console.log('[sync-from-prod] dump user tables: start')
const snap = await dumpUserTables(localDb)
const snapFile = await writeSnapshot(snap)
console.log(
  `[sync-from-prod] dump done: themes=${snap.themes.length} theme_stocks=${snap.themeStocks.length} ` +
    `stock_memo_meta=${snap.stockMemoMeta.length} stock_memos=${snap.stockMemos.length}`,
)
console.log(`[sync-from-prod] snapshot saved: ${snapFile}`)

if (skipReset) {
  console.log('[sync-from-prod] SYNC_SKIP_RESET=1 — skip branch reset')
} else {
  console.log(`[sync-from-prod] reset dev branch: ${devBranchId}`)
  await resetDevBranch(devBranchId)
  console.log('[sync-from-prod] wait for branch ready')
  await awaitBranchReady(localDb)
}

console.log('[sync-from-prod] restore user tables: start')
await restoreUserTables(localDb, snap)
console.log('[sync-from-prod] restore done')

const pruned = await pruneOldSnapshots()
if (pruned > 0) {
  console.log(`[sync-from-prod] pruned old snapshots: ${pruned} (keep newest ${KEEP_RECENT_SNAPSHOTS})`)
}

console.log(
  '[sync-from-prod] all done. ' +
    'もし src/db/schema.ts にローカル未適用のマイグレーションがあれば `npm run db:migrate` を再実行してください。',
)
