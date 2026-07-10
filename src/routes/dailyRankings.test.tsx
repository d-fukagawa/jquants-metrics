import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as dailyRankingService from '../services/dailyRankingService'
import { dailyRankingsRoute } from './dailyRankings'

vi.mock('../services/dailyRankingService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/dailyRankingService')>()
  return { ...actual, listDailyTurnoverRankings: vi.fn() }
})
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL: 'postgres://test',
  JQUANTS_API_KEY: 'test-key',
  EDINETDB_API_KEY: 'edinet-key',
  EDINET_API_KEY: 'official-edinet-key',
  SYNC_SECRET: 'secret',
}

describe('GET /rankings/daily', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders turnover rankings and stock links', async () => {
    vi.mocked(dailyRankingService.listDailyTurnoverRankings).mockResolvedValue({
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

    const res = await dailyRankingsRoute.request('/', { method: 'GET' }, ENV)
    const html = await res.text()

    expect(res.status).toBe(200)
    expect(html).toContain('売買代金ランキング')
    expect(html).toContain('トヨタ自動車')
    expect(html).toContain('/stock/7203')
    expect(html).toContain('+1.45%')
    expect(html).toContain('123,457 百万円')
    expect(html).toContain('2026-07-06')
    expect(html).toContain('輸送用機器')
    expect(html).toContain('TOPIX Core30')
    expect(html).toContain('2.00倍')
    expect(html).toContain('550,000 億円')
    expect(html).toContain('/rankings/daily/csv?limit=50&amp;date=2026-07-07')
  })

  it('passes validated filters to the service', async () => {
    vi.mocked(dailyRankingService.listDailyTurnoverRankings).mockResolvedValue({
      date: '2026-07-07',
      previousDate: '2026-07-06',
      rows: [],
    })

    const res = await dailyRankingsRoute.request(
      '/?date=2026-07-07&market=%E3%82%B0%E3%83%AD%E3%83%BC%E3%82%B9&limit=100',
      { method: 'GET' },
      ENV,
    )

    expect(res.status).toBe(200)
    expect(dailyRankingService.listDailyTurnoverRankings).toHaveBeenCalledWith({}, {
      date: '2026-07-07',
      market: 'グロース',
      limit: 100,
    })
  })

  it('returns 400 for an invalid date', async () => {
    const res = await dailyRankingsRoute.request('/?date=2026-02-30', { method: 'GET' }, ENV)

    expect(res.status).toBe(400)
    expect(dailyRankingService.listDailyTurnoverRankings).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid market', async () => {
    const res = await dailyRankingsRoute.request('/?market=invalid', { method: 'GET' }, ENV)

    expect(res.status).toBe(400)
    expect(dailyRankingService.listDailyTurnoverRankings).not.toHaveBeenCalled()
  })

  it('renders an empty state', async () => {
    vi.mocked(dailyRankingService.listDailyTurnoverRankings).mockResolvedValue({
      date: '2026-07-05',
      previousDate: '2026-07-03',
      rows: [],
    })

    const html = await (await dailyRankingsRoute.request('/', { method: 'GET' }, ENV)).text()

    expect(html).toContain('指定日のランキングデータがありません')
  })

  it('downloads CSV using the validated filters', async () => {
    vi.mocked(dailyRankingService.listDailyTurnoverRankings).mockResolvedValue({
      date: '2026-07-07',
      previousDate: '2026-07-06',
      rows: [],
    })

    const res = await dailyRankingsRoute.request(
      '/csv?date=2026-07-07&market=%E3%83%97%E3%83%A9%E3%82%A4%E3%83%A0&limit=100',
      { method: 'GET' },
      ENV,
    )

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('content-disposition')).toContain(
      'daily-turnover-ranking_2026-07-07_prime_100.csv',
    )
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes.slice(3))).toContain('対象日,比較日')
    expect(dailyRankingService.listDailyTurnoverRankings).toHaveBeenCalledWith({}, {
      date: '2026-07-07',
      market: 'プライム',
      limit: 100,
    })
  })

  it('returns 400 for invalid CSV filters', async () => {
    const res = await dailyRankingsRoute.request('/csv?date=invalid', { method: 'GET' }, ENV)

    expect(res.status).toBe(400)
    expect(dailyRankingService.listDailyTurnoverRankings).not.toHaveBeenCalled()
  })
})
