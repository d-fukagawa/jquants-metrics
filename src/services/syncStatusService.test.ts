import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSyncStatusSummary } from './syncStatusService'
import type { Db } from '../db/client'

describe('getSyncStatusSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns aggregated sync stats', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ count: 4200, latest_updated_at: '2026-03-12 00:10:00+00' }] })
      .mockResolvedValueOnce({ rows: [{ total_count: 3000000, date_count: 750, latest_date: '2026-03-11' }] })
      .mockResolvedValueOnce({ rows: [{ latest_count: 4190 }] })
      .mockResolvedValueOnce({ rows: [{ total_count: 820000, code_count: 4160, latest_disc_date: '2026-02-14' }] })
      .mockResolvedValueOnce({ rows: [{ latest_count: 4100 }] })
      .mockResolvedValueOnce({ rows: [{ total_count: 600000, code_count: 3600, dna_count: 2800, latest_disc_date: '2026-02-14' }] })
      .mockResolvedValueOnce({ rows: [{ latest_count: 3000 }] })
      .mockResolvedValueOnce({ rows: [{ ready_count: 3000 }] })
      .mockResolvedValueOnce({ rows: [{ ready_count: 2500 }] })
      .mockResolvedValueOnce({ rows: [{ run_total: 20, run_success: 18, latest_success_at: '2026-03-13 00:00:00+00', http429_total: 2, http5xx_total: 1 }] })
      .mockResolvedValueOnce({ rows: [{ timeline_code_count: 800, forecast_code_count: 700, bridge_code_count: 650, quality_code_count: 300, text_code_count: 250 }] })

    const db = { execute } as unknown as Db
    const s = await getSyncStatusSummary(db)

    expect(s.masterCount).toBe(4200)
    expect(s.priceLatestDate).toBe('2026-03-11')
    expect(s.priceLatestDateCount).toBe(4190)
    expect(s.missingPriceOnLatest).toBe(10)
    expect(s.financialCodeCount).toBe(4160)
    expect(s.financialCoveragePct).toBe(99)
    expect(s.finsDetailsCodeCount).toBe(3600)
    expect(s.finsDetailsDnaCount).toBe(2800)
    expect(s.finsDetailsCoveragePct).toBe(85.7)
    expect(s.ebitdaReadyCount).toBe(3000)
    expect(s.evEbitdaReadyCount).toBe(2500)
    expect(s.edinetSuccessRatePct).toBe(90)
    expect(s.edinetRunSuccess).toBe(18)
    expect(s.edinetTimelineCodeCount).toBe(800)
  })

  it('handles empty tables', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ count: 0, latest_updated_at: null }] })
      .mockResolvedValueOnce({ rows: [{ total_count: 0, date_count: 0, latest_date: null }] })
      .mockResolvedValueOnce({ rows: [{ latest_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ total_count: 0, code_count: 0, latest_disc_date: null }] })
      .mockResolvedValueOnce({ rows: [{ latest_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ total_count: 0, code_count: 0, dna_count: 0, latest_disc_date: null }] })
      .mockResolvedValueOnce({ rows: [{ latest_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ ready_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ ready_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ run_total: 0, run_success: 0, latest_success_at: null, http429_total: 0, http5xx_total: 0 }] })
      .mockResolvedValueOnce({ rows: [{ timeline_code_count: 0, forecast_code_count: 0, bridge_code_count: 0, quality_code_count: 0, text_code_count: 0 }] })

    const db = { execute } as unknown as Db
    const s = await getSyncStatusSummary(db)

    expect(s.masterCount).toBe(0)
    expect(s.priceLatestDate).toBeNull()
    expect(s.missingPriceOnLatest).toBeNull()
    expect(s.financialCoveragePct).toBeNull()
    expect(s.finsDetailsCoveragePct).toBeNull()
    expect(s.ebitdaReadyCount).toBe(0)
    expect(s.evEbitdaReadyCount).toBe(0)
    expect(s.edinetSuccessRatePct).toBeNull()
  })
})
