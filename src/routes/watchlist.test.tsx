import { beforeEach, describe, expect, it, vi } from 'vitest'
import { watchlistRoute } from './watchlist'
import * as watchlistService from '../services/watchlistService'

vi.mock('../services/watchlistService')
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL: 'postgres://test',
  JQUANTS_API_KEY: 'key',
  EDINETDB_API_KEY: 'edinet-key',
  EDINET_API_KEY: 'official-edinet-key',
  SYNC_SECRET: 'secret',
}

describe('watchlistRoute', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET / renders watched list', async () => {
    vi.mocked(watchlistService.listWatchedStocks).mockResolvedValue([
      {
        code: '72030',
        isWatched: true,
        createdAt: new Date('2026-03-01T00:00:00Z'),
        updatedAt: new Date('2026-03-01T00:00:00Z'),
        coName: 'トヨタ自動車',
        mktNm: 'プライム',
        sector33Nm: '輸送用機器',
        memoCount: 2,
        latestMemoUpdatedAt: new Date('2026-03-02T00:00:00Z'),
        latestMemoBody: 'test memo',
      },
    ] as any)

    const res = await watchlistRoute.request('/', { method: 'GET' }, ENV)
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('ウォッチ銘柄')
    expect(html).toContain('7203')
    expect(html).toContain('メモ件数')
  })

  it('POST /watch validates code and redirects', async () => {
    vi.mocked(watchlistService.setWatchState).mockResolvedValue(undefined)
    const form = new URLSearchParams({ code: '7203', is_watched: '1', redirect_to: '/stock/7203' })
    const res = await watchlistRoute.request('/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }, ENV)
    expect(res.status).toBe(303)
  })

  it('POST /notes/add validates code and redirects', async () => {
    vi.mocked(watchlistService.addStockMemo).mockResolvedValue('memo-1')
    const form = new URLSearchParams({ code: '7203', body: 'memo body', redirect_to: '/stock/7203' })
    const res = await watchlistRoute.request('/notes/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }, ENV)
    expect(res.status).toBe(303)
  })

  it('POST /notes/update validates payload and redirects', async () => {
    vi.mocked(watchlistService.updateStockMemo).mockResolvedValue(true)
    const form = new URLSearchParams({ code: '7203', note_id: 'memo-1', body: 'updated', redirect_to: '/stock/7203' })
    const res = await watchlistRoute.request('/notes/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }, ENV)
    expect(res.status).toBe(303)
  })

  it('POST /notes/delete validates payload and redirects', async () => {
    vi.mocked(watchlistService.deleteStockMemo).mockResolvedValue(true)
    const form = new URLSearchParams({ code: '7203', note_id: 'memo-1', redirect_to: '/stock/7203' })
    const res = await watchlistRoute.request('/notes/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }, ENV)
    expect(res.status).toBe(303)
  })
})

