import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/client'
import { listBuyTimingBars } from './buyTimingService'

function makeMockDb(rows: unknown[] = []) {
  const orderBy = vi.fn().mockResolvedValue(rows)
  const where = vi.fn().mockReturnValue({ orderBy })
  const from = vi.fn().mockReturnValue({ where })
  const select = vi.fn().mockReturnValue({ from })
  return { db: { select } as unknown as Db, select, from, where, orderBy }
}

describe('listBuyTimingBars', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps adjusted closes to ascending backtest bars', async () => {
    const { db } = makeMockDb([
      { date: '2026-01-01', close: '100', adjClose: '101.5' },
      { date: '2026-01-02', close: '102', adjClose: null },
    ])

    const result = await listBuyTimingBars(db, {
      code5: '00000',
      from: '2024-06-16',
      to: '2026-06-16',
    })

    expect(result).toEqual([
      { date: '2026-01-01', close: 101.5 },
      { date: '2026-01-02', close: 102 },
    ])
  })

  it('drops rows without finite positive closes', async () => {
    const { db } = makeMockDb([
      { date: '2026-01-01', close: null, adjClose: null },
      { date: '2026-01-02', close: '0', adjClose: null },
      { date: '2026-01-03', close: '103', adjClose: null },
    ])

    const result = await listBuyTimingBars(db, {
      code5: '00000',
      from: '2024-06-16',
      to: '2026-06-16',
    })

    expect(result).toEqual([{ date: '2026-01-03', close: 103 }])
  })

  it('builds a filtered ordered query', async () => {
    const { db, where, orderBy } = makeMockDb()

    await listBuyTimingBars(db, {
      code5: '00000',
      from: '2024-06-16',
      to: '2026-06-16',
    })

    expect(where).toHaveBeenCalledTimes(1)
    expect(orderBy).toHaveBeenCalledTimes(1)
  })
})
