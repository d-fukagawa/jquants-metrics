import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screenStocks, PAGE_SIZE } from './screenService'
import type { Db } from '../db/client'

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    code: '72030', co_name: 'トヨタ自動車', sector17_nm: '自動車・輸送機',
    mkt_nm: 'プライム', scale_cat: 'TOPIX Core30', mrgn_nm: '貸借',
    close: 3450, np: 1_000_000, cfo: 500_000, eq_ar: 0.384,
    per: 12.5, pbr: 1.1, roe: 11.0, div_yield: 2.5, psr: 0.3,
    mktcap: 50_000_000, total_count: 1,
    ...overrides,
  }
}

function makeMockDb(rows: unknown[] = []) {
  const execute = vi.fn().mockResolvedValue({ rows })
  return { db: { execute } as unknown as Db, execute }
}

describe('screenStocks', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns mapped rows and total count', async () => {
    const row = makeRow()
    const { db } = makeMockDb([row])
    const { rows, total } = await screenStocks(db, {})
    expect(total).toBe(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      code: '72030',
      coName: 'トヨタ自動車',
      sector17Nm: '自動車・輸送機',
      mktNm: 'プライム',
      close: 3450,
      per: 12.5,
      pbr: 1.1,
      roe: 11.0,
      divYield: 2.5,
      eqAr: 0.384,
      psr: 0.3,
    })
  })

  it('returns empty result when no rows', async () => {
    const { db } = makeMockDb([])
    const { rows, total } = await screenStocks(db, {})
    expect(rows).toHaveLength(0)
    expect(total).toBe(0)
  })

  it('handles null values in numeric fields', async () => {
    const row = makeRow({ per: null, pbr: null, roe: null, div_yield: null, psr: null, close: null, eq_ar: null })
    const { db } = makeMockDb([row])
    const { rows } = await screenStocks(db, {})
    expect(rows[0].per).toBeNull()
    expect(rows[0].pbr).toBeNull()
    expect(rows[0].close).toBeNull()
    expect(rows[0].eqAr).toBeNull()
  })

  it('calls db.execute once per query', async () => {
    const { db, execute } = makeMockDb([])
    await screenStocks(db, { perMin: 5, perMax: 20 })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('uses PAGE_SIZE = 50', () => {
    expect(PAGE_SIZE).toBe(50)
  })

  it('calls db.execute once for page 2', async () => {
    const { db, execute } = makeMockDb([])
    await screenStocks(db, { page: 2 })
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('maps total_count from first row', async () => {
    const rows = [makeRow({ total_count: 99 }), makeRow({ code: '86010', total_count: 99 })]
    const { db } = makeMockDb(rows)
    const { total } = await screenStocks(db, {})
    expect(total).toBe(99)
  })
})
