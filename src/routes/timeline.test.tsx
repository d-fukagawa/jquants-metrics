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
        coName: 'トヨタ自動車',
        sourceUrl: 'https://example.com/DOC1.pdf',
        isAmendment: false,
      } as any,
    ])
    const res = await timelineRoute.request('/', { method: 'GET' }, ENV)
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('開示イベント日別ビュー')
    expect(html).toContain('第3四半期決算短信')
    expect(html).toContain('トヨタ自動車')
    expect(html).toContain('href="/stock/7203"')
    expect(html).toContain('href="https://example.com/DOC1.pdf"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('does not render an unsafe filing source URL', async () => {
    vi.mocked(stockEdinetService.listTimelineEvents).mockResolvedValue([{
      edinetCode: 'E00001',
      docId: 'javascript:alert(1)',
      code: '72030',
      filingDate: '2026-02-14',
      eventType: '決算短信',
      title: '第3四半期決算短信',
      coName: 'トヨタ自動車',
      sourceUrl: 'javascript:alert(1)',
      isAmendment: false,
      submittedAt: null,
      sourceUpdatedAt: null,
    }])

    const res = await timelineRoute.request('/', { method: 'GET' }, ENV)
    const html = await res.text()

    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('原文リンク未取得')
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
