import { describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/client'
import {
  calcThemeSummaryScores,
  judgeThemeSummary,
  listThemeSummaries,
  sortThemeSummaryRows,
} from './themeSummaryService'

describe('themeSummaryService scoring', () => {
  it('judges strong momentum with turnover inflow', () => {
    expect(judgeThemeSummary({
      return5d: 0.04,
      return20d: 0.08,
      advancersPct: 70,
      turnoverRatio: 1.8,
    })).toEqual({ status: '勢いあり・資金流入', tone: 'strong' })
  })

  it('judges overheated short-term moves', () => {
    expect(judgeThemeSummary({
      return5d: 0.12,
      return20d: 0.18,
      advancersPct: 80,
      turnoverRatio: 2.8,
    })).toEqual({ status: '過熱注意', tone: 'caution' })
  })

  it('calculates bounded scores', () => {
    const scores = calcThemeSummaryScores({
      return20d: 0.4,
      advancersPct: 120,
      turnoverRatio: 5,
      volumeRatio: 4,
    })
    expect(scores.momentumScore).toBe(100)
    expect(scores.flowScore).toBe(100)
  })
})

describe('themeSummaryService listThemeSummaries', () => {
  it('maps SQL rows and derives status fields', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{
        group_type: 'themes',
        group_id: 'theme-1',
        group_name: '半導体',
        stock_count: 3,
        data_stock_count: 3,
        latest_date: '2026-05-20',
        return_5d: '0.03',
        return_20d: '0.08',
        return_60d: '0.12',
        advancers_pct: '66.7',
        turnover_5d_avg: '20000000000',
        turnover_20d_avg: '10000000000',
        turnover_ratio: '2',
        volume_ratio: '1.4',
      }],
    })
    const db = { execute } as unknown as Db

    const rows = await listThemeSummaries(db, { scope: 'themes', sort: 'return20d', direction: 'desc' })

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      groupType: 'themes',
      groupName: '半導体',
      stockCount: 3,
      dataStockCount: 3,
      latestDate: '2026-05-20',
      return20d: 0.08,
      turnoverRatio: 2,
      status: '勢いあり・資金流入',
      statusTone: 'strong',
    })
  })
})

describe('themeSummaryService sortThemeSummaryRows', () => {
  const baseRow = {
    groupType: 'themes' as const,
    groupId: 'base',
    groupName: 'base',
    stockCount: 1,
    dataStockCount: 1,
    latestDate: '2026-05-20',
    return5d: null,
    return20d: null,
    return60d: null,
    advancersPct: null,
    turnover5dAvg: null,
    turnover20dAvg: null,
    turnoverRatio: null,
    volumeRatio: null,
    momentumScore: 0,
    flowScore: 0,
    status: '横ばい',
    statusTone: 'neutral' as const,
  }

  it('sorts numeric columns with nulls last', () => {
    const rows = sortThemeSummaryRows([
      { ...baseRow, groupId: 'a', groupName: 'A', return20d: null },
      { ...baseRow, groupId: 'b', groupName: 'B', return20d: 0.08 },
      { ...baseRow, groupId: 'c', groupName: 'C', return20d: -0.02 },
    ], 'return20d', 'desc')

    expect(rows.map(row => row.groupId)).toEqual(['b', 'c', 'a'])
  })

  it('sorts text columns ascending', () => {
    const rows = sortThemeSummaryRows([
      { ...baseRow, groupId: 'b', groupName: '防衛' },
      { ...baseRow, groupId: 'a', groupName: 'AI' },
    ], 'groupName', 'asc')

    expect(rows.map(row => row.groupName)).toEqual(['AI', '防衛'])
  })
})
