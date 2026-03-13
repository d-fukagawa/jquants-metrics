import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { stockMaster, stockMemoMeta, stockMemos } from '../db/schema'

const MAX_MEMO_BODY_LEN = 1000

function normalizeMemoBody(body: string): string | null {
  const normalized = body.trim()
  if (!normalized) return null
  return normalized.slice(0, MAX_MEMO_BODY_LEN)
}

async function upsertWatchMeta(db: Db, code5: string, isWatched: boolean): Promise<void> {
  const now = new Date()
  await db.insert(stockMemoMeta).values({
    code: code5,
    isWatched,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: stockMemoMeta.code,
    set: {
      isWatched: sql`excluded.is_watched`,
      updatedAt: sql`excluded.updated_at`,
    },
  })
}

export type StockMemo = {
  id: string
  code: string
  body: string
  createdAt: Date
  updatedAt: Date
}

export type StockMemoPanel = {
  isWatched: boolean
  notes: StockMemo[]
}

export async function getStockMemoPanel(db: Db, code5: string): Promise<StockMemoPanel> {
  const [meta] = await db
    .select({ isWatched: stockMemoMeta.isWatched })
    .from(stockMemoMeta)
    .where(eq(stockMemoMeta.code, code5))
    .limit(1)

  const notes = await db
    .select({
      id: stockMemos.id,
      code: stockMemos.code,
      body: stockMemos.body,
      createdAt: stockMemos.createdAt,
      updatedAt: stockMemos.updatedAt,
    })
    .from(stockMemos)
    .where(eq(stockMemos.code, code5))
    .orderBy(desc(stockMemos.updatedAt))

  return {
    isWatched: meta?.isWatched ?? false,
    notes,
  }
}

export async function setWatchState(db: Db, code5: string, isWatched: boolean): Promise<void> {
  await upsertWatchMeta(db, code5, isWatched)
}

export async function addStockMemo(db: Db, code5: string, body: string): Promise<string | null> {
  const normalized = normalizeMemoBody(body)
  if (!normalized) return null

  const now = new Date()
  const noteId = crypto.randomUUID()

  await upsertWatchMeta(db, code5, true)
  await db.insert(stockMemos).values({
    id: noteId,
    code: code5,
    body: normalized,
    createdAt: now,
    updatedAt: now,
  })
  return noteId
}

export async function updateStockMemo(db: Db, code5: string, noteId: string, body: string): Promise<boolean> {
  const normalized = normalizeMemoBody(body)
  if (!normalized) return false

  const updated = await db
    .update(stockMemos)
    .set({
      body: normalized,
      updatedAt: new Date(),
    })
    .where(and(eq(stockMemos.code, code5), eq(stockMemos.id, noteId)))
    .returning({ id: stockMemos.id })

  return updated.length > 0
}

export async function deleteStockMemo(db: Db, code5: string, noteId: string): Promise<boolean> {
  const deleted = await db
    .delete(stockMemos)
    .where(and(eq(stockMemos.code, code5), eq(stockMemos.id, noteId)))
    .returning({ id: stockMemos.id })

  return deleted.length > 0
}

export type WatchedStockRow = {
  code: string
  isWatched: boolean
  createdAt: Date
  updatedAt: Date
  coName: string | null
  mktNm: string | null
  sector33Nm: string | null
  memoCount: number
  latestMemoUpdatedAt: Date | string | null
  latestMemoBody: string | null
}

export async function listWatchedStocks(db: Db): Promise<WatchedStockRow[]> {
  const watchedRows = await db
    .select({
      code: stockMemoMeta.code,
      isWatched: stockMemoMeta.isWatched,
      createdAt: stockMemoMeta.createdAt,
      updatedAt: stockMemoMeta.updatedAt,
      coName: stockMaster.coName,
      mktNm: stockMaster.mktNm,
      sector33Nm: stockMaster.sector33Nm,
    })
    .from(stockMemoMeta)
    .leftJoin(stockMaster, eq(stockMaster.code, stockMemoMeta.code))
    .where(eq(stockMemoMeta.isWatched, true))
    .orderBy(desc(stockMemoMeta.updatedAt))

  if (watchedRows.length === 0) return []

  const codes = watchedRows.map((row) => row.code)
  const memoStats = await db
    .select({
      code: stockMemos.code,
      memoCount: sql<number>`count(*)::int`,
      latestMemoUpdatedAt: sql<Date | string | null>`max(${stockMemos.updatedAt})`,
      latestMemoBody: sql<string | null>`(array_agg(${stockMemos.body} order by ${stockMemos.updatedAt} desc))[1]`,
    })
    .from(stockMemos)
    .where(inArray(stockMemos.code, codes))
    .groupBy(stockMemos.code)

  const memoByCode = new Map(memoStats.map((m) => [m.code, m]))
  return watchedRows.map((row) => {
    const memo = memoByCode.get(row.code)
    return {
      ...row,
      memoCount: memo?.memoCount ?? 0,
      latestMemoUpdatedAt: memo?.latestMemoUpdatedAt ?? null,
      latestMemoBody: memo?.latestMemoBody ?? null,
    }
  })
}

// Backward-compatibility helpers for existing call sites/tests.
export async function isWatched(db: Db, code5: string): Promise<boolean> {
  const [meta] = await db
    .select({ isWatched: stockMemoMeta.isWatched })
    .from(stockMemoMeta)
    .where(eq(stockMemoMeta.code, code5))
    .limit(1)
  return meta?.isWatched ?? false
}

export async function addToWatchlist(db: Db, code5: string, note?: string): Promise<void> {
  await setWatchState(db, code5, true)
  if (note?.trim()) {
    await addStockMemo(db, code5, note)
  }
}

export async function removeFromWatchlist(db: Db, code5: string): Promise<void> {
  await setWatchState(db, code5, false)
}

export async function listWatchlist(db: Db): Promise<WatchedStockRow[]> {
  return listWatchedStocks(db)
}
