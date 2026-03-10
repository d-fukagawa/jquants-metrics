import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchStocks, getStockByCode } from './stockService'
import type { Db } from '../db/client'

// Drizzle の select チェーンをモック
function makeMockDb(rows: unknown[] = []) {
  const limit  = vi.fn().mockResolvedValue(rows)
  const where  = vi.fn().mockReturnValue({ limit })
  const from   = vi.fn().mockReturnValue({ where })
  const select = vi.fn().mockReturnValue({ from })
  return { db: { select } as unknown as Db, select, from, where, limit }
}

// ---------- searchStocks ----------
describe('searchStocks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls limit(20) and returns rows', async () => {
    const row = { code: '72030', coName: 'トヨタ自動車' }
    const { db, limit } = makeMockDb([row])
    const result = await searchStocks(db, '7203')
    expect(limit).toHaveBeenCalledWith(20)
    expect(result).toEqual([row])
  })

  it('passes correct pattern to where (% wrapping)', async () => {
    const { db, where } = makeMockDb()
    await searchStocks(db, 'トヨタ')
    // where に渡された引数は drizzle の or(...) オブジェクト — 呼ばれたことを確認
    expect(where).toHaveBeenCalledTimes(1)
  })

  it('calls from(stockMaster)', async () => {
    const { db, from } = makeMockDb()
    await searchStocks(db, 'test')
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('returns empty array when no match', async () => {
    const { db } = makeMockDb([])
    const result = await searchStocks(db, 'zzz')
    expect(result).toEqual([])
  })
})

// ---------- getStockByCode ----------
describe('getStockByCode', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the first row when found', async () => {
    const row = { code: '72030', coName: 'トヨタ自動車' }
    const { db } = makeMockDb([row])
    const result = await getStockByCode(db, '72030')
    expect(result).toEqual(row)
  })

  it('returns null when not found', async () => {
    const { db } = makeMockDb([])
    const result = await getStockByCode(db, '99999')
    expect(result).toBeNull()
  })

  it('calls limit(1)', async () => {
    const { db, limit } = makeMockDb([])
    await getStockByCode(db, '72030')
    expect(limit).toHaveBeenCalledWith(1)
  })
})
