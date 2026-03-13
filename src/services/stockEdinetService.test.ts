import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getLatestForecasts,
  listAlphaSurprises,
  listTimelineEvents,
} from './stockEdinetService'
import type { Db } from '../db/client'

describe('stockEdinetService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listTimelineEvents returns rows from SQL execution', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ filing_date: '2026-02-14', event_type: '決算短信', title: 'Q3', code: '72030', edinet_code: 'E00001', doc_id: 'DOC1' }],
    })
    const db = { execute } as unknown as Db
    const rows = await listTimelineEvents(db, { code: '7203' })
    expect(rows).toHaveLength(1)
    expect(rows[0].eventType).toBe('決算短信')
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('getLatestForecasts picks next and next2', async () => {
    const rows = [
      { horizon: 'next2', fiscalYear: '2028-03', disclosedAt: '2026-01-01' },
      { horizon: 'next', fiscalYear: '2027-03', disclosedAt: '2026-01-01' },
    ]
    const orderBy = vi.fn().mockResolvedValue(rows)
    const where = vi.fn().mockReturnValue({ orderBy })
    const from = vi.fn().mockReturnValue({ where })
    const select = vi.fn().mockReturnValue({ from })
    const db = { select } as unknown as Db

    const result = await getLatestForecasts(db, '72030')
    expect(result.next?.fiscalYear).toBe('2027-03')
    expect(result.next2?.fiscalYear).toBe('2028-03')
  })

  it('listAlphaSurprises computes surprise pct', async () => {
    const forecastRows = [{ code: '72030', horizon: 'next', disclosedAt: '2026-02-14', opForecast: '100', npForecast: '80', salesForecast: '1000' }]
    const bridgeRows = [{ code: '72030', disclosedAt: '2026-02-14', operatingProfit: '120', netProfit: '70' }]

    const forecastLimit = vi.fn().mockResolvedValue(forecastRows)
    const forecastOrderBy = vi.fn().mockReturnValue({ limit: forecastLimit })
    const forecastFrom = vi.fn().mockReturnValue({ orderBy: forecastOrderBy })

    const bridgeLimit = vi.fn().mockResolvedValue(bridgeRows)
    const bridgeOrderBy = vi.fn().mockReturnValue({ limit: bridgeLimit })
    const bridgeFrom = vi.fn().mockReturnValue({ orderBy: bridgeOrderBy })

    const select = vi.fn()
      .mockReturnValueOnce({ from: forecastFrom })
      .mockReturnValueOnce({ from: bridgeFrom })

    const db = { select } as unknown as Db

    const result = await listAlphaSurprises(db, { metric: 'op', minSurprisePct: 10 })
    expect(result.total).toBe(1)
    expect(result.rows[0].surprisePct).toBe(20)
  })
})
