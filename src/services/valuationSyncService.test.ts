import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/client'
import * as jquants from '../jquants/client'
import { mapEquityValuation, syncEquityValuationsByDate } from './valuationSyncService'

vi.mock('../jquants/client')

function makeMockDb() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
  const values = vi.fn().mockReturnValue({ onConflictDoUpdate })
  const insert = vi.fn().mockReturnValue({ values })
  return { db: { insert } as unknown as Db, insert, values, onConflictDoUpdate }
}

const valuation = {
  Date: '2026-08-26',
  Code: '72030',
  EPS: 250.5,
  FwdEPS: 280.25,
  BPS: 3100.1,
  ROE: 0.0812,
  FwdROE: 0.0904,
  PER: 12.5,
  FwdPER: 11.17,
  PBR: 1.01,
  MktCap: 4_500_000,
}

describe('valuationSyncService', () => {
  beforeEach(() => vi.clearAllMocks())

  it('maps API values without changing units', () => {
    expect(mapEquityValuation(valuation)).toEqual({
      code: '72030',
      date: '2026-08-26',
      epsTtm: '250.5',
      epsCompanyForecast: '280.25',
      bps: '3100.1',
      roeTtm: '0.0812',
      roeCompanyForecast: '0.0904',
      perTtm: '12.5',
      perCompanyForecast: '11.17',
      pbr: '1.01',
      marketCapMillion: '4500000',
    })
  })

  it('keeps missing values null and upserts by code and date', async () => {
    vi.mocked(jquants.fetchEquityValuationsByDate).mockResolvedValue([{
      ...valuation,
      FwdEPS: null,
      FwdROE: null,
      FwdPER: null,
    }])
    const { db, values, onConflictDoUpdate } = makeMockDb()

    const count = await syncEquityValuationsByDate(db, 'key', '2026-08-26')

    expect(count).toBe(1)
    expect(values.mock.calls[0][0][0]).toMatchObject({
      epsCompanyForecast: null,
      roeCompanyForecast: null,
      perCompanyForecast: null,
    })
    expect(onConflictDoUpdate).toHaveBeenCalledOnce()
  })

  it('does not write when the API returns no rows', async () => {
    vi.mocked(jquants.fetchEquityValuationsByDate).mockResolvedValue([])
    const { db, insert } = makeMockDb()

    await expect(syncEquityValuationsByDate(db, 'key', '2026-08-26')).resolves.toBe(0)
    expect(insert).not.toHaveBeenCalled()
  })
})
