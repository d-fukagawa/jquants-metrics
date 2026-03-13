import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncStatusRoute } from './syncStatus'
import * as syncStatusService from '../services/syncStatusService'

vi.mock('../services/syncStatusService')
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL: 'postgres://test',
  JQUANTS_API_KEY: 'test-key',
  EDINETDB_API_KEY: 'edinet-key',
  EDINET_API_KEY: 'official-edinet-key',
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
      finsDetailsTotalCount: 600000,
      finsDetailsCodeCount: 3600,
      finsDetailsDnaCount: 2800,
      finsDetailsLatestDiscDate: '2026-02-14',
      finsDetailsLatestDiscDateCount: 3000,
      missingPriceOnLatest: 10,
      financialCoveragePct: 99.0,
      finsDetailsCoveragePct: 85.7,
      ebitdaReadyCount: 3000,
      evEbitdaReadyCount: 2500,
      edinetRunTotal: 20,
      edinetRunSuccess: 18,
      edinetSuccessRatePct: 90,
      edinetLatestSuccessAt: '2026-03-13 00:00:00+00',
      edinetHttp429Total: 2,
      edinetHttp5xxTotal: 1,
      edinetTimelineCodeCount: 800,
      edinetForecastCodeCount: 700,
      edinetBridgeCodeCount: 650,
      edinetQualityCodeCount: 300,
      edinetTextCodeCount: 250,
    })

    const res = await get('/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('同期ステータス')
    expect(html).toContain('4,200')
    expect(html).toContain('2026-03-11')
    expect(html).toContain('99.0%')
    expect(html).toContain('85.7%')
    expect(html).toContain('3,000')
    expect(html).toContain('2,500')
    expect(html).toContain('90.0%')
    expect(html).toContain('800')
    expect(html).toContain('GitHub Actions')
    expect(html).toContain('actions/workflows/daily-sync.yml')
    expect(html).toContain('actions/workflows/backfill-financials.yml')
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
      finsDetailsTotalCount: 0,
      finsDetailsCodeCount: 0,
      finsDetailsDnaCount: 0,
      finsDetailsLatestDiscDate: null,
      finsDetailsLatestDiscDateCount: 0,
      missingPriceOnLatest: null,
      financialCoveragePct: null,
      finsDetailsCoveragePct: null,
      ebitdaReadyCount: 0,
      evEbitdaReadyCount: 0,
      edinetRunTotal: 0,
      edinetRunSuccess: 0,
      edinetSuccessRatePct: null,
      edinetLatestSuccessAt: null,
      edinetHttp429Total: 0,
      edinetHttp5xxTotal: 0,
      edinetTimelineCodeCount: 0,
      edinetForecastCodeCount: 0,
      edinetBridgeCodeCount: 0,
      edinetQualityCodeCount: 0,
      edinetTextCodeCount: 0,
    })

    const html = await (await get('/')).text()
    expect(html).toContain('未同期')
  })
})
