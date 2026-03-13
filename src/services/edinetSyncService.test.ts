import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  syncEdinetBridge,
  syncEdinetForecasts,
  syncEdinetQualityScores,
  syncEdinetTextScores,
  syncEdinetTimeline,
} from './edinetSyncService'

vi.mock('../edinet/client', () => ({
  searchCompanyByCode: vi.fn(),
  fetchCompanyFilings: vi.fn(),
  fetchCompanyForecasts: vi.fn(),
  fetchCompanyBridgeFacts: vi.fn(),
  fetchQualityScore: vi.fn(),
  fetchTextAnomalyScore: vi.fn(),
}))

import {
  searchCompanyByCode,
  fetchCompanyFilings,
  fetchCompanyForecasts,
  fetchCompanyBridgeFacts,
  fetchQualityScore,
  fetchTextAnomalyScore,
} from '../edinet/client'

function makeDb() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
  const insert = vi.fn().mockReturnValue({ values })

  const limit = vi.fn().mockResolvedValue([])
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where })
  const select = vi.fn().mockReturnValue({ from })

  return { insert, select }
}

describe('edinetSyncService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('syncEdinetTimeline upserts rows', async () => {
    const db = makeDb() as any
    vi.mocked(searchCompanyByCode).mockResolvedValue([{ edinetCode: 'E00001', code: '7203' }] as any)
    vi.mocked(fetchCompanyFilings).mockResolvedValue([{
      edinetCode: 'E00001',
      docId: 'DOC1',
      filingDate: '2026-02-14',
      eventType: '決算短信',
      title: 'Q3',
      isAmendment: false,
    }] as any)
    const n = await syncEdinetTimeline(db, 'k', '72030')
    expect(n).toBe(1)
    expect(fetchCompanyFilings).toHaveBeenCalled()
  })

  it('syncEdinetForecasts upserts rows', async () => {
    const db = makeDb() as any
    vi.mocked(searchCompanyByCode).mockResolvedValue([{ edinetCode: 'E00001', code: '7203' }] as any)
    vi.mocked(fetchCompanyForecasts).mockResolvedValue([{
      fiscalYear: '2027-03',
      horizon: 'next',
    }] as any)
    const n = await syncEdinetForecasts(db, 'k', '72030')
    expect(n).toBe(1)
  })

  it('syncEdinetBridge upserts rows', async () => {
    const db = makeDb() as any
    vi.mocked(searchCompanyByCode).mockResolvedValue([{ edinetCode: 'E00001', code: '7203' }] as any)
    vi.mocked(fetchCompanyBridgeFacts).mockResolvedValue([{
      fiscalYear: '2026-03',
      periodType: 'FY',
    }] as any)
    const n = await syncEdinetBridge(db, 'k', '72030')
    expect(n).toBe(1)
  })

  it('syncEdinetQualityScores upserts score row', async () => {
    const db = makeDb() as any
    vi.mocked(fetchQualityScore).mockResolvedValue({
      code: '72030',
      asOfDate: '2026-02-14',
      score: 80,
      formulaText: 'quality_score = 100 - penalties',
      components: {},
    } as any)
    const n = await syncEdinetQualityScores(db, 'k', '72030')
    expect(n).toBe(1)
  })

  it('syncEdinetTextScores upserts score row', async () => {
    const db = makeDb() as any
    vi.mocked(fetchTextAnomalyScore).mockResolvedValue({
      code: '72030',
      asOfDate: '2026-02-14',
      score: 35,
      formulaText: 'anomaly_score = normalized(text delta)',
      components: {},
    } as any)
    const n = await syncEdinetTextScores(db, 'k', '72030')
    expect(n).toBe(1)
  })
})

