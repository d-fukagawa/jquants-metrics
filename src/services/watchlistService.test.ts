import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addStockMemo,
  deleteStockMemo,
  listWatchedStocks,
  setWatchState,
  updateStockMemo,
} from './watchlistService'
import type { Db } from '../db/client'

describe('watchlistService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('setWatchState executes upsert', async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
    const insert = vi.fn().mockReturnValue({ values })
    const db = { insert } as unknown as Db

    await setWatchState(db, '72030', true)
    expect(insert).toHaveBeenCalled()
    expect(onConflictDoUpdate).toHaveBeenCalled()
  })

  it('addStockMemo inserts meta and memo rows', async () => {
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
    const metaValues = vi.fn().mockReturnValue({ onConflictDoUpdate })
    const memoValues = vi.fn().mockResolvedValue(undefined)
    const insert = vi.fn()
      .mockReturnValueOnce({ values: metaValues })
      .mockReturnValueOnce({ values: memoValues })
    const db = { insert } as unknown as Db

    const id = await addStockMemo(db, '72030', 'memo body')
    expect(id).toBeTruthy()
    expect(insert).toHaveBeenCalledTimes(2)
  })

  it('updateStockMemo updates existing note', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'memo-1' }])
    const where = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where })
    const update = vi.fn().mockReturnValue({ set })
    const db = { update } as unknown as Db

    await expect(updateStockMemo(db, '72030', 'memo-1', 'updated')).resolves.toBe(true)
  })

  it('deleteStockMemo deletes existing note', async () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'memo-1' }])
    const where = vi.fn().mockReturnValue({ returning })
    const del = vi.fn().mockReturnValue({ where })
    const db = { delete: del } as unknown as Db

    await expect(deleteStockMemo(db, '72030', 'memo-1')).resolves.toBe(true)
  })

  it('listWatchedStocks returns empty array when no watched stocks', async () => {
    const orderBy = vi.fn().mockResolvedValue([])
    const where = vi.fn().mockReturnValue({ orderBy })
    const leftJoin = vi.fn().mockReturnValue({ where })
    const from = vi.fn().mockReturnValue({ leftJoin })
    const select = vi.fn().mockReturnValue({ from })
    const db = { select } as unknown as Db

    await expect(listWatchedStocks(db)).resolves.toEqual([])
  })
})

