import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fetchDailyPrices,
  fetchDailyPricesAll,
  fetchEquitiesMaster,
  fetchEquityValuationsByCode,
  fetchEquityValuationsByDate,
  fetchFinancialSummary,
  fetchFinancialSummaryByDate,
  fetchFinsDetails,
} from './client'

const API_KEY = 'test-key'

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status })
  ))
}

// ---------- fetchEquitiesMaster ----------
describe('fetchEquitiesMaster', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('returns equities_master array', async () => {
    mockFetch({
      data: [{
        Code: '72030', CoName: 'トヨタ自動車', CoNameEn: 'TOYOTA MOTOR CORPORATION',
        Mkt: '0111', MktNm: 'プライム', S17: '6', S17Nm: '自動車・輸送機',
        S33: '3700', S33Nm: '輸送用機器', ScaleCat: 'TOPIX Core30',
        Mrgn: '2', MrgnNm: '貸借', ProdCat: '011', Date: '2026-02-21',
      }],
    })
    const result = await fetchEquitiesMaster(API_KEY)
    expect(result).toHaveLength(1)
    expect(result[0].Code).toBe('72030')
    expect(result[0].CoName).toBe('トヨタ自動車')
  })

  it('appends date query param when provided', async () => {
    mockFetch({ data: [] })
    await fetchEquitiesMaster(API_KEY, '2026-01-01')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('date=2026-01-01')
  })

  it('sends x-api-key header', async () => {
    mockFetch({ data: [] })
    await fetchEquitiesMaster(API_KEY)
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(API_KEY)
  })

  it('throws on non-OK response', async () => {
    mockFetch('Unauthorized', 401)
    await expect(fetchEquitiesMaster(API_KEY)).rejects.toThrow('JQuants API error 401')
  })
})

// ---------- fetchDailyPrices ----------
describe('fetchDailyPrices', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const bar = {
    Code: '72030', Date: '2025-11-29',
    O: 2800, H: 2850, L: 2780, C: 2830,
    Vo: 1_000_000, Va: 2_830_000_000,
    AdjFactor: 1.0, AdjO: 2800, AdjH: 2850, AdjL: 2780, AdjC: 2830, AdjVo: 1_000_000,
    UL: '0', LL: '0',
  }

  it('returns daily_bars array', async () => {
    mockFetch({ data: [bar] })
    const result = await fetchDailyPrices(API_KEY, '72030', '2025-11-01', '2025-11-29')
    expect(result).toHaveLength(1)
    expect(result[0].AdjC).toBe(2830)
  })

  it('sends correct query params', async () => {
    mockFetch({ data: [] })
    await fetchDailyPrices(API_KEY, '72030', '2025-11-01', '2025-11-29')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('code=72030')
    expect(url).toContain('from=2025-11-01')
    expect(url).toContain('to=2025-11-29')
  })

  it('throws on non-OK response', async () => {
    mockFetch({ message: 'out of range' }, 400)
    await expect(fetchDailyPrices(API_KEY, '72030', '2020-01-01', '2020-01-31'))
      .rejects.toThrow('JQuants API error 400')
  })

  it('fetches every page for a code range', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [bar],
        pagination_key: 'price.next',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ ...bar, Date: '2025-11-28' }],
      }))))

    const pending = fetchDailyPrices(API_KEY, '72030', '2025-11-01', '2025-11-29')
    await vi.runAllTimersAsync()
    const result = await pending

    expect(result).toHaveLength(2)
    const urls = vi.mocked(fetch).mock.calls.map(call => String(call[0]))
    expect(urls[1]).toContain('pagination_key=price.next')
    expect(urls[1]).toContain('code=72030')
  })

  it('fetches all codes for a date without adding a code filter', async () => {
    mockFetch({ data: [bar] })
    await fetchDailyPricesAll(API_KEY, '2025-11-29')
    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string)
    expect(url.searchParams.get('date')).toBe('2025-11-29')
    expect(url.searchParams.has('code')).toBe(false)
  })

  it('rejects a repeated pagination key', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [bar],
        pagination_key: 'repeated',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ ...bar, Date: '2025-11-28' }],
        pagination_key: 'repeated',
      }))))

    const pending = fetchDailyPrices(API_KEY, '72030', '2025-11-01', '2025-11-29')
    const assertion = expect(pending).rejects.toThrow('repeated pagination_key')
    await vi.runAllTimersAsync()
    await assertion
  })
})

// ---------- fetchEquityValuations ----------
describe('fetchEquityValuations', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

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

  it('fetches all pages for a date and forwards pagination_key', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [valuation],
        pagination_key: 'next.page',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ ...valuation, Code: '67580' }],
      }))))

    const pending = fetchEquityValuationsByDate(API_KEY, '2026-08-26')
    await vi.runAllTimersAsync()
    const result = await pending

    expect(result.map(row => row.Code)).toEqual(['72030', '67580'])
    const urls = vi.mocked(fetch).mock.calls.map(call => String(call[0]))
    expect(urls[0]).toContain('date=2026-08-26')
    expect(urls[1]).toContain('pagination_key=next.page')
  })

  it('fetches a code with an optional date range', async () => {
    mockFetch({ data: [valuation] })

    const result = await fetchEquityValuationsByCode(
      API_KEY,
      '72030',
      '2026-08-01',
      '2026-08-26',
    )

    expect(result).toHaveLength(1)
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('code=72030')
    expect(url).toContain('from=2026-08-01')
    expect(url).toContain('to=2026-08-26')
  })
})

// ---------- fetchFinancialSummary ----------
describe('fetchFinancialSummary', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const summary = {
    DiscNo: '20240801123456', DiscDate: '2024-08-01',
    Code: '72030', DocType: '2QFinancialStatements_Consolidated_IFRS', CurPerType: '2Q',
    Sales: '24630753000000', OP: '2005692000000', NP: '1773426000000',
    EPS: '136.07', BPS: '',  // IFRS中間では空
    Eq: '38456954000000', EqAR: '0.384', TA: '100000000000000',
    CFO: '2944609000000', CashEq: '8112922000000',
    ShOutFY: '15794987460', TrShFY: '2761598241', AvgSh: '13033161110',
    DivAnn: '30', FDivAnn: '35',
    FSales: '45000000000000', FOP: '4500000000000', FNP: '3500000000000', FEPS: '268.0',
  }

  it('returns fins_summary array', async () => {
    mockFetch({ data: [summary] })
    const result = await fetchFinancialSummary(API_KEY, '72030')
    expect(result).toHaveLength(1)
    expect(result[0].EPS).toBe('136.07')
    expect(result[0].CurPerType).toBe('2Q')
  })

  it('BPS is empty string for IFRS interim reports', async () => {
    mockFetch({ data: [summary] })
    const result = await fetchFinancialSummary(API_KEY, '72030')
    expect(result[0].BPS).toBe('')
  })

  it('appends date param when provided', async () => {
    mockFetch({ data: [] })
    await fetchFinancialSummary(API_KEY, '72030', '2024-08-01')
    const url = vi.mocked(fetch).mock.calls[0][0] as string
    expect(url).toContain('code=72030')
    expect(url).toContain('date=2024-08-01')
  })

  it('throws on non-OK response', async () => {
    mockFetch('Forbidden', 403)
    await expect(fetchFinancialSummary(API_KEY, '72030')).rejects.toThrow('JQuants API error 403')
  })

  it('fetches all pages for a code history', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [summary],
        pagination_key: 'summary.next',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ ...summary, DiscNo: '20240801123457' }],
      }))))

    const pending = fetchFinancialSummary(API_KEY, '72030')
    await vi.runAllTimersAsync()
    const result = await pending

    expect(result).toHaveLength(2)
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toContain('pagination_key=summary.next')
  })
})

describe('fetchFinancialSummaryByDate', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('requests all disclosures for one date without a code filter', async () => {
    mockFetch({ data: [] })

    await fetchFinancialSummaryByDate(API_KEY, '2026-09-14')

    const url = new URL(vi.mocked(fetch).mock.calls[0][0] as string)
    expect(url.searchParams.get('date')).toBe('2026-09-14')
    expect(url.searchParams.has('code')).toBe(false)
  })
})

describe('fetchFinsDetails', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('reads the v2 top-level fields and FS object', async () => {
    mockFetch({
      data: [{
        DiscDate: '2026-05-15',
        DiscTime: '15:00:00',
        Code: '62870',
        DiscNo: '20260515555555',
        DocType: 'FYFinancialStatements_Consolidated_JP',
        FS: { 'Type of current period, DEI': 'FY' },
      }],
    })

    const result = await fetchFinsDetails(API_KEY, '62870')

    expect(result[0]).toEqual(expect.objectContaining({
      Code: '62870',
      DiscNo: '20260515555555',
      FS: { 'Type of current period, DEI': 'FY' },
    }))
  })

  it('fetches every v2 details page while preserving the code filter', async () => {
    vi.useFakeTimers()
    const detail = {
      DiscDate: '2026-05-15',
      DiscTime: '15:00:00',
      Code: '62870',
      DiscNo: '20260515555555',
      DocType: 'FYFinancialStatements_Consolidated_JP',
      FS: { 'Type of current period, DEI': 'FY' },
    }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [detail],
        pagination_key: 'details.next',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ ...detail, DiscNo: '20260515555556' }],
      }))))

    const pending = fetchFinsDetails(API_KEY, '62870')
    await vi.runAllTimersAsync()
    const result = await pending

    expect(result).toHaveLength(2)
    const nextUrl = new URL(String(vi.mocked(fetch).mock.calls[1][0]))
    expect(nextUrl.searchParams.get('code')).toBe('62870')
    expect(nextUrl.searchParams.get('pagination_key')).toBe('details.next')
  })
})
