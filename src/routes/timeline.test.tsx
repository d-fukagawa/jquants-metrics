import { describe, it, expect, vi, beforeEach } from 'vitest'
import { timelineRoute } from './timeline'
import * as stockEdinetService from '../services/stockEdinetService'

vi.mock('../services/stockEdinetService')
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL: 'postgres://test',
  JQUANTS_API_KEY: 'test-key',
  EDINETDB_API_KEY: 'edinet-key',
  EDINET_API_KEY: 'official-edinet-key',
  SYNC_SECRET: 'secret',
}

describe('GET /timeline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders timeline rows', async () => {
    vi.mocked(stockEdinetService.listTimelineEvents).mockResolvedValue([
      {
        edinetCode: 'E00001',
        docId: 'DOC1',
        code: '72030',
        filingDate: '2026-02-14',
        eventType: '決算短信',
        title: '第3四半期決算短信',
        isAmendment: false,
      } as any,
    ])
    const res = await timelineRoute.request('/', { method: 'GET' }, ENV)
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('開示イベント日別ビュー')
    expect(html).toContain('第3四半期決算短信')
  })

  it('passes filters to service', async () => {
    vi.mocked(stockEdinetService.listTimelineEvents).mockResolvedValue([])
    await timelineRoute.request('/?date_from=2026-01-01&date_to=2026-01-31&code=7203&event_type=決算短信', { method: 'GET' }, ENV)
    expect(stockEdinetService.listTimelineEvents).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        code: '7203',
      }),
    )
  })
})
