import { describe, expect, it } from 'vitest'
import { serializeDailyRankingCsv } from './dailyRankingCsvService'

describe('serializeDailyRankingCsv', () => {
  it('writes analysis columns as an Excel-compatible CSV', () => {
    const csv = serializeDailyRankingCsv({
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
        close: 3500,
        change: 50,
        changePct: 1.45,
        turnover: 123_456_789_000,
        turnover20dAverage: 61_728_394_500,
        turnover20dRatio: 2,
        marketCap: 55_000_000_000_000,
      }],
    })

    expect(csv.startsWith('\uFEFF対象日,比較日,表示順位,市場内順位,業種33内順位')).toBe(true)
    expect(csv).toContain(
      '2026-07-07,2026-07-06,1,1,2,7203,トヨタ自動車,プライム,'
      + '自動車・輸送機,輸送用機器,TOPIX Core30,3500,50,1.45,'
      + '123456789000,61728394500,2,55000000000000',
    )
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('escapes delimiters and guards spreadsheet formulas', () => {
    const csv = serializeDailyRankingCsv({
      date: '2026-07-07',
      previousDate: null,
      rows: [{
        rank: 1,
        marketRank: 1,
        sectorRank: 1,
        code: '99990',
        code4: '9999',
        coName: '=SUM(1,2)\n"銘柄"',
        market: 'プライム',
        sector17Name: '',
        sector33Name: '',
        scaleCategory: '',
        close: null,
        change: -10,
        changePct: -1.2,
        turnover: 1000,
        turnover20dAverage: null,
        turnover20dRatio: null,
        marketCap: null,
      }],
    })

    expect(csv).toContain('"\'=SUM(1,2)\n""銘柄"""')
    expect(csv).toContain(',-10,-1.2,1000,')
  })
})
