import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as valuationService from '../services/valuationService'
import { valuationsRoute } from './valuations'

vi.mock('../services/valuationService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/valuationService')>()
  return { ...actual, listValuationRankings: vi.fn() }
})
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL: 'postgres://test',
  JQUANTS_API_KEY: 'test-key',
  EDINETDB_API_KEY: 'edinet-key',
  EDINET_API_KEY: 'official-edinet-key',
  SYNC_SECRET: 'secret',
}

const row: valuationService.ValuationRankingRow = {
  rank: 1,
  code: '72030',
  code4: '7203',
  coName: 'トヨタ自動車',
  market: 'プライム',
  comparisonDate: '2026-08-25',
  epsTtm: 250,
  epsCompanyForecast: 280,
  previousEpsCompanyForecast: 250,
  epsChange: 30,
  epsChangePct: 12,
  perCompanyForecast: 11,
  previousPerCompanyForecast: 12,
  perChangePct: -8.33,
  close: 3080,
  previousClose: 3000,
  priceChangePct: 2.67,
  epsPriceGapPct: 9.33,
  epsPriceGap1mPct: 8.5,
  epsPriceGap3mPct: 15.25,
  forecastVsTtmEpsPct: 12,
  roeTtm: 0.08,
  roeCompanyForecast: 0.09,
  roeImprovementPoint: 1,
  marketCapMillion: 4_500_000,
  perPercentile1y: 18.5,
  perPercentile3y: 12.25,
  perPercentile5y: 9.75,
  perMedian1y: 14.2,
  perMedian3y: 16.4,
  perMedian5y: 18.1,
  perObservationCount1y: 245,
  perObservationCount3y: 735,
  perObservationCount5y: 1220,
  perHistoryStartDate: '2021-08-26',
  hasFinancialDisclosure: true,
  corporateActionSuspected: false,
  judgment: 'EPS上昇・PER低下',
}

describe('GET /valuations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(valuationService.listValuationRankings).mockResolvedValue({
      date: '2026-08-26',
      rows: [row],
    })
  })

  it('renders valuation changes, source semantics, and stock links', async () => {
    const response = await valuationsRoute.request('/', { method: 'GET' }, ENV)
    const html = await response.text()

    expect(response.status).toBe(200)
    expect(html).toContain('業績・バリュエーション変化')
    expect(html).toContain('会社予想')
    expect(html).toContain('トヨタ自動車')
    expect(html).toContain('/stock/7203')
    expect(html).toContain('+12.00%')
    expect(html).toContain('-8.33%')
    expect(html).toContain('EPS上昇・PER低下')
    expect(html).toContain('期間内決算開示あり')
    expect(html).toContain('+1.00pt')
    expect(html).toContain('45,000 億円')
    expect(html).toContain('+8.50%')
    expect(html).toContain('+15.25%')
    expect(html).toContain('/valuations/csv?')
    expect(html).toContain('最大5年PER位置')
    expect(html).toContain('9.8%ile')
    expect(html).toContain('n=1220')
    expect(html).toContain('開始 2021-08-26')
    expect(html).toContain('最大5年PER低位')
    expect(html).toContain('ROE改善')
    expect(html).toContain('TTM→会社予想EPS成長')
    expect(html).toContain('観測200件以上')
  })

  it('passes validated filters to the service', async () => {
    const response = await valuationsRoute.request(
      '/?date=2026-08-26&market=%E3%82%B0%E3%83%AD%E3%83%BC%E3%82%B9&period=3m&ranking=expectation_driven&limit=100',
      { method: 'GET' },
      ENV,
    )

    expect(response.status).toBe(200)
    expect(valuationService.listValuationRankings).toHaveBeenCalledWith({}, {
      date: '2026-08-26',
      market: 'グロース',
      period: '3m',
      ranking: 'expectation_driven',
      limit: 100,
    })
  })

  it.each([
    ['date', '2026-02-30'],
    ['market', 'invalid'],
    ['period', '5y'],
    ['ranking', 'invalid'],
  ])('returns 400 for invalid %s', async (name, value) => {
    const response = await valuationsRoute.request(`/?${name}=${value}`, { method: 'GET' }, ENV)

    expect(response.status).toBe(400)
    expect(valuationService.listValuationRankings).not.toHaveBeenCalled()
  })

  it('renders an empty state', async () => {
    vi.mocked(valuationService.listValuationRankings).mockResolvedValue({
      date: '2026-08-26',
      rows: [],
    })

    const html = await (await valuationsRoute.request('/', { method: 'GET' }, ENV)).text()
    expect(html).toContain('指定条件のバリュエーション変化がありません')
  })

  it('downloads CSV with the validated comparison settings', async () => {
    const response = await valuationsRoute.request(
      '/csv?date=2026-08-26&period=1m&ranking=eps_up_per_down&limit=50',
      { method: 'GET' },
      ENV,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('content-disposition')).toContain(
      'valuation-ranking_2026-08-26_1m_eps_up_per_down_all_50.csv',
    )
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes.slice(3))).toContain('1か月 EPS変化率-株価変化率')
  })
})
