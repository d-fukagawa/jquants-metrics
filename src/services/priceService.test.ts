import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getRecentPrices } from './priceService'
import type { Db } from '../db/client'

// Drizzle select→from→where→orderBy→limit チェーンをモック
function makeMockDb(rows: unknown[] = []) {
  const limit   = vi.fn().mockResolvedValue(rows)
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where   = vi.fn().mockReturnValue({ orderBy })
  const from    = vi.fn().mockReturnValue({ where })
  const select  = vi.fn().mockReturnValue({ from })
  return { db: { select } as unknown as Db, select, from, where, orderBy, limit }
}

describe('getRecentPrices', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns rows from DB', async () => {
    const row = { code: '72030', date: '2025-11-29', adjClose: '2830' }
    const { db } = makeMockDb([row])
    const result = await getRecentPrices(db, '72030')
    expect(result).toEqual([row])
  })

  it('applies default limit of 60', async () => {
    const { db, limit } = makeMockDb()
    await getRecentPrices(db, '72030')
    expect(limit).toHaveBeenCalledWith(60)
  })

  it('applies custom limit', async () => {
    const { db, limit } = makeMockDb()
    await getRecentPrices(db, '72030', 10)
    expect(limit).toHaveBeenCalledWith(10)
  })

  it('calls orderBy (desc date)', async () => {
    const { db, orderBy } = makeMockDb()
    await getRecentPrices(db, '72030')
    expect(orderBy).toHaveBeenCalledTimes(1)
  })

  it('calls where to filter by code', async () => {
    const { db, where } = makeMockDb()
    await getRecentPrices(db, '72030')
    expect(where).toHaveBeenCalledTimes(1)
  })

  it('returns empty array when no data', async () => {
    const { db } = makeMockDb([])
    const result = await getRecentPrices(db, '99999')
    expect(result).toEqual([])
  })
})
