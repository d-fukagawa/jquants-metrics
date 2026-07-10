import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/client'
import { listDailyTurnoverRankings } from './dailyRankingService'

function makeMockDb(rows: unknown[] = []) {
  const execute = vi.fn().mockResolvedValue({ rows })
  return { db: { execute } as unknown as Db, execute }
}

describe('listDailyTurnoverRankings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps ranking rows and converts numeric values', async () => {
    const { db } = makeMockDb([
      {
        target_date: '2026-07-07',
        previous_date: '2026-07-06',
        rank: 1,
        market_rank: 1,
        sector_rank: 2,
        code: '72030',
        co_name: 'トヨタ自動車',
        mkt_nm: 'プライム',
        sector17_nm: '自動車・輸送機',
        sector33_nm: '輸送用機器',
        scale_cat: 'TOPIX Core30',
        close: '3500.5',
        change: '50.5',
        change_pct: '1.463768',
        turnover: '123456789000',
        turnover_20d_average: '61728394500',
        turnover_20d_ratio: '2',
        market_cap: '55000000000000',
      },
    ])

    const result = await listDailyTurnoverRankings(db)

    expect(result).toEqual({
      date: '2026-07-07',
      previousDate: '2026-07-06',
        rows: [{
          rank: 1,
          marketRank: 1,
          sectorRank: 2,
          code: '72030',
          code4: '7203',
          coName: 'トヨタ自動車',
          market: 'プライム',
          sector17Name: '自動車・輸送機',
          sector33Name: '輸送用機器',
          scaleCategory: 'TOPIX Core30',
          close: 3500.5,
          change: 50.5,
          changePct: 1.463768,
          turnover: 123456789000,
          turnover20dAverage: 61728394500,
          turnover20dRatio: 2,
          marketCap: 55000000000000,
        }],
    })
  })

  it('returns metadata and no rows when the selected date has no data', async () => {
    const { db } = makeMockDb([{
      target_date: '2026-07-05',
      previous_date: '2026-07-03',
      rank: null,
      code: null,
    }])

    const result = await listDailyTurnoverRankings(db, { date: '2026-07-05' })

    expect(result).toEqual({
      date: '2026-07-05',
      previousDate: '2026-07-03',
      rows: [],
    })
  })

  it('keeps missing price comparisons as null', async () => {
    const { db } = makeMockDb([{
      target_date: '2026-07-07',
      previous_date: null,
      rank: 1,
      market_rank: 1,
      sector_rank: 1,
      code: '13010',
      co_name: '銘柄A',
      mkt_nm: 'プライム',
      sector17_nm: '食品',
      sector33_nm: '水産・農林業',
      scale_cat: '',
      close: null,
      change: null,
      change_pct: null,
      turnover: '1000',
      turnover_20d_average: null,
      turnover_20d_ratio: null,
      market_cap: null,
    }])

    const result = await listDailyTurnoverRankings(db)

    expect(result.rows[0]).toMatchObject({
      close: null,
      change: null,
      changePct: null,
      turnover20dAverage: null,
      turnover20dRatio: null,
      marketCap: null,
    })
    expect(result.previousDate).toBeNull()
  })

  it('executes one query with filters', async () => {
    const { db, execute } = makeMockDb([])

    await listDailyTurnoverRankings(db, {
      date: '2026-07-07',
      market: 'グロース',
      limit: 100,
    })

    expect(execute).toHaveBeenCalledTimes(1)
  })
})
