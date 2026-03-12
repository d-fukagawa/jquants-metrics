import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncStatusRoute } from './syncStatus'
import * as syncStatusService from '../services/syncStatusService'

vi.mock('../services/syncStatusService')
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL: 'postgres://test',
  JQUANTS_API_KEY: 'test-key',
  SYNC_SECRET: 'secret',
}

async function get(path: string) {
  return syncStatusRoute.request(path, { method: 'GET' }, ENV)
}

describe('GET /sync-status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 and renders summary values', async () => {
    vi.mocked(syncStatusService.getSyncStatusSummary).mockResolvedValue({
      masterCount: 4200,
      masterUpdatedAt: '2026-03-12 00:10:00+00',
      priceTotalCount: 3000000,
      priceDateCount: 750,
      priceLatestDate: '2026-03-11',
      priceLatestDateCount: 4190,
      financialTotalCount: 820000,
      financialCodeCount: 4160,
      financialLatestDiscDate: '2026-02-14',
      financialLatestDiscDateCount: 4100,
      missingPriceOnLatest: 10,
      financialCoveragePct: 99.0,
    })

    const res = await get('/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('同期ステータス')
    expect(html).toContain('4,200')
    expect(html).toContain('2026-03-11')
    expect(html).toContain('99.0%')
  })

  it('renders 未同期 when no data', async () => {
    vi.mocked(syncStatusService.getSyncStatusSummary).mockResolvedValue({
      masterCount: 0,
      masterUpdatedAt: null,
      priceTotalCount: 0,
      priceDateCount: 0,
      priceLatestDate: null,
      priceLatestDateCount: 0,
      financialTotalCount: 0,
      financialCodeCount: 0,
      financialLatestDiscDate: null,
      financialLatestDiscDateCount: 0,
      missingPriceOnLatest: null,
      financialCoveragePct: null,
    })

    const html = await (await get('/')).text()
    expect(html).toContain('未同期')
  })
})

