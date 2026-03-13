import { describe, it, expect, vi, beforeEach } from 'vitest'
import { alphaRoute } from './alpha'
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

describe('GET /alpha', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders surprise table', async () => {
    vi.mocked(stockEdinetService.listAlphaSurprises).mockResolvedValue({
      total: 1,
      rows: [{
        code: '72030',
        horizon: 'next',
        disclosedAt: '2026-02-14',
        metric: 'op',
        forecast: 100,
        actual: 120,
        surprisePct: 20,
      }],
    })
    const res = await alphaRoute.request('/', { method: 'GET' }, ENV)
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('サプライズ抽出')
    expect(html).toContain('20%')
  })

  it('passes filters to service', async () => {
    vi.mocked(stockEdinetService.listAlphaSurprises).mockResolvedValue({ total: 0, rows: [] })
    await alphaRoute.request('/?metric=np&min_surprise_pct=15.5&as_of=2026-02-14', { method: 'GET' }, ENV)
    expect(stockEdinetService.listAlphaSurprises).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metric: 'np',
        minSurprisePct: 15.5,
        asOf: '2026-02-14',
      }),
    )
  })
})
