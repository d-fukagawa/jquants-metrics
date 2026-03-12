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

    const db = { execute } as unknown as Db
    const s = await getSyncStatusSummary(db)

    expect(s.masterCount).toBe(4200)
    expect(s.priceLatestDate).toBe('2026-03-11')
    expect(s.priceLatestDateCount).toBe(4190)
    expect(s.missingPriceOnLatest).toBe(10)
    expect(s.financialCodeCount).toBe(4160)
    expect(s.financialCoveragePct).toBe(99)
  })

  it('handles empty tables', async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ count: 0, latest_updated_at: null }] })
      .mockResolvedValueOnce({ rows: [{ total_count: 0, date_count: 0, latest_date: null }] })
      .mockResolvedValueOnce({ rows: [{ latest_count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ total_count: 0, code_count: 0, latest_disc_date: null }] })
      .mockResolvedValueOnce({ rows: [{ latest_count: 0 }] })

    const db = { execute } as unknown as Db
    const s = await getSyncStatusSummary(db)

    expect(s.masterCount).toBe(0)
    expect(s.priceLatestDate).toBeNull()
    expect(s.missingPriceOnLatest).toBeNull()
    expect(s.financialCoveragePct).toBeNull()
  })
})

