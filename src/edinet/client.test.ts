import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchCompanyBridgeFacts,
  fetchCompanyFilings,
  fetchCompanyForecasts,
  fetchQualityScore,
  fetchTextAnomalyScore,
  searchCompanyByCode,
} from './client'

const API_KEY = 'edinet-key'

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  ))
}

function mockFetchSequence(entries: Array<{ body: unknown; status?: number }>) {
  const fn = vi.fn()
  for (const e of entries) {
    fn.mockResolvedValueOnce(new Response(JSON.stringify(e.body), { status: e.status ?? 200 }))
  }
  vi.stubGlobal('fetch', fn)
}

describe('edinet client', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('searchCompanyByCode parses company rows', async () => {
    mockFetch({ data: [{ edinetCode: 'E00001', code: '7203', name: 'トヨタ自動車' }] })
    const rows = await searchCompanyByCode(API_KEY, '7203')
    expect(rows[0].edinetCode).toBe('E00001')
  })

  it('fetchCompanyFilings parses filing rows', async () => {
    mockFetch({
      data: [{
        edinet_code: 'E00001',
        count: 1,
        earnings: [{
          disclosure_date: '2026-02-14',
          quarter: 3,
          title: 'Q3',
          is_correction: false,
          pdf_url: 'DOC1',
        }],
      }],
    })
    const rows = await fetchCompanyFilings(API_KEY, 'E00001')
    expect(rows).toHaveLength(1)
    expect(rows[0].docId).toBe('DOC1')
  })

  it('fetchCompanyForecasts returns empty when next/next2 is unavailable', async () => {
    mockFetch({ data: [{ fiscalYear: '2027-03', horizon: 'next', salesForecast: '1000' }] })
    const rows = await fetchCompanyForecasts(API_KEY, 'E00001')
    expect(rows).toEqual([])
  })

  it('fetchCompanyBridgeFacts parses financial rows', async () => {
    mockFetch({
      data: [{
        fiscalYear: '2026-03',
        periodType: 'FY',
        operatingProfit: '100',
        ibd_current: '50',
        long_term_borrowings: '120',
      }],
    })
    const rows = await fetchCompanyBridgeFacts(API_KEY, 'E00001')
    expect(rows[0].fiscalYear).toBe('2026-03')
    expect(rows[0].debtCurrent).toBe('50')
    expect(rows[0].debtNonCurr).toBe('120')
  })

  it('fetchQualityScore returns score object', async () => {
    mockFetchSequence([
      { body: { data: [{ edinet_code: 'E00001', sec_code: '72030' }] } },
      { body: { data: [{ history: [{ fiscal_year: 2025, credit_score: 80, credit_rating: 'A', benchmark_strong_count: 1, benchmark_weak_count: 0, credit_flag_count: 0 }] }] } },
    ])
    const s = await fetchQualityScore(API_KEY, '72030')
    expect(s?.score).toBe(80)
  })

  it('fetchTextAnomalyScore returns score object', async () => {
    mockFetchSequence([
      { body: { data: [{ edinet_code: 'E00001', sec_code: '72030' }] } },
      { body: { data: [{ section: '事業等のリスク', text: '減損 訴訟 継続企業 重要な後発事象' }] } },
    ])
    const s = await fetchTextAnomalyScore(API_KEY, '72030')
    expect(s?.score).toBeGreaterThan(0)
  })

  it('throws API error on non-OK response', async () => {
    mockFetch('bad', 500)
    await expect(searchCompanyByCode(API_KEY, '7203')).rejects.toThrow('EDINETDB API error 500')
  })
})
