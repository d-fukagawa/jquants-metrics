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
          doc_id: 'DOC1',
          pdf_url: 'https://example.com/DOC1.pdf',
        }],
      }],
    })
    const rows = await fetchCompanyFilings(API_KEY, 'E00001')
    expect(rows).toHaveLength(1)
    expect(rows[0].docId).toBe('DOC1')
    expect(rows[0].sourceUrl).toBe('https://example.com/DOC1.pdf')
  })

  it('fetchCompanyForecasts returns empty when next/next2 is unavailable', async () => {
    mockFetch({ data: [{ fiscalYear: '2027-03', horizon: 'next', salesForecast: '1000' }] })
    const rows = await fetchCompanyForecasts(API_KEY, 'E00001')
    expect(rows).toEqual([])
  })

  it('fetchCompanyBridgeFacts parses the current annual financial schema', async () => {
    mockFetch({
      data: [{
        fiscal_year: '2026-03',
        operating_income: '100',
        cf_operating: '80',
        cf_investing: '-30',
        capex: '20',
        accounting_standard: 'ifrs',
        basis: 'consolidated',
        submit_date: '2026-06-18 15:30',
        doc_id: 'S100TEST',
        ibd_current: '50',
        long_term_borrowings: '120',
      }],
    })
    const rows = await fetchCompanyBridgeFacts(API_KEY, 'E00001')
    expect(rows[0].fiscalYear).toBe('2026-03')
    expect(rows[0].debtCurrent).toBe('50')
    expect(rows[0].debtNonCurr).toBe('120')
    expect(rows[0].operatingProfit).toBe('100')
    expect(rows[0].cfo).toBe('80')
    expect(rows[0].cfi).toBe('-30')
    expect(rows[0].capex).toBe('20')
    expect(rows[0].accountingStandard).toBe('ifrs')
    expect(rows[0].basis).toBe('consolidated')
    expect(rows[0].submittedAt).toBe('2026-06-18T06:30:00.000Z')
    expect(rows[0].sourceDocId).toBe('S100TEST')
    const requested = new URL(vi.mocked(fetch).mock.calls[0][0] as string)
    expect(requested.searchParams.get('period')).toBe('annual')
    expect(requested.searchParams.get('years')).toBe('6')
    expect(requested.searchParams.get('include_nulls')).toBe('true')
  })

  it('keeps compatibility with legacy camelCase bridge fields', async () => {
    mockFetch({
      data: [{
        fiscalYear: '2025-03',
        periodType: 'FY',
        operatingProfit: '90',
        cashflowOperating: '70',
        cashflowInvesting: '-20',
        accountingStandard: 'JP',
        submittedAt: '2025-06-20T06:00:00.000Z',
        sourceDocId: 'S100LEGACY',
      }],
    })

    const rows = await fetchCompanyBridgeFacts(API_KEY, 'E00001')

    expect(rows[0]).toEqual(expect.objectContaining({
      fiscalYear: '2025-03',
      periodType: 'FY',
      operatingProfit: '90',
      cfo: '70',
      cfi: '-20',
      accountingStandard: 'JP',
      submittedAt: '2025-06-20T06:00:00.000Z',
      sourceDocId: 'S100LEGACY',
    }))
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
