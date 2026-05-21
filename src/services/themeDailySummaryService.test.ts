import { describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/client'
import {
  calcDailyMarketScores,
  judgeDailyMarket,
  listThemeDailySummaries,
} from './themeDailySummaryService'

describe('themeDailySummaryService scoring', () => {
  it('judges broad risk-on market with flow', () => {
    expect(judgeDailyMarket({
      return1d: 0.023,
      return5d: 0.04,
      advancersPct: 74,
      turnoverRatio: 1.6,
      volumeRatio: 1.3,
      intradayRange: 0.025,
    })).toEqual({ status: '全面高・資金流入', tone: 'strong' })
  })

  it('judges risk-off market', () => {
    expect(judgeDailyMarket({
      return1d: -0.026,
      return5d: -0.05,
      advancersPct: 28,
      turnoverRatio: 1.2,
      volumeRatio: 1.1,
      intradayRange: 0.03,
    })).toEqual({ status: 'リスクオフ', tone: 'weak' })
  })

  it('calculates bounded daily scores', () => {
    const scores = calcDailyMarketScores({
      return1d: 0.2,
      return5d: 0.4,
      advancersPct: 120,
      turnoverRatio: 5,
      volumeRatio: 4,
      intradayRange: 0.2,
    })
    expect(scores).toEqual({
      momentumScore: 100,
      flowScore: 100,
      volatilityScore: 100,
    })
  })
})

describe('themeDailySummaryService listThemeDailySummaries', () => {
  it('maps SQL rows and derives status fields', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{
        date: '2026-05-20',
        stock_count: 1000,
        data_stock_count: 980,
        return_1d: '0.023',
        return_5d: '0.04',
        return_20d: '0.06',
        advancers_pct: '74',
        turnover: '4200000000000',
        turnover_ratio: '1.6',
        volume_ratio: '1.3',
        intraday_range: '0.025',
        leader_group_id: '6',
        leader_group_name: '電機・精密',
        leader_return_1d: '0.034',
        leader_turnover_ratio: '1.9',
      }],
    })
    const db = { execute } as unknown as Db

    const rows = await listThemeDailySummaries(db, { scope: 'sector17', from: '2026-05-01', to: '2026-05-20' })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      date: '2026-05-20',
      stockCount: 1000,
      dataStockCount: 980,
      return1d: 0.023,
      turnover: 4_200_000_000_000,
      turnoverRatio: 1.6,
      leaderGroupName: '電機・精密',
      leaderReturn1d: 0.034,
      status: '全面高・資金流入',
      statusTone: 'strong',
    })
  })
})
