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
        code: '72030',
        code4: '7203',
        coName: 'トヨタ自動車',
        market: 'プライム',
        sector17Name: '自動車・輸送機',
        close: 3500,
        change: 50,
        changePct: 1.45,
        turnover: 123_456_789_000,
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
})
