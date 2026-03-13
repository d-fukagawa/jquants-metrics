import { describe, it, expect, vi, beforeEach } from 'vitest'
import { stockRoute } from './stock'
import * as stockService    from '../services/stockService'
import * as priceService    from '../services/priceService'
import * as stockEdinetService from '../services/stockEdinetService'
import * as watchlistService from '../services/watchlistService'
// calcMetrics / fmtJpy は純粋関数なので実装をそのまま使う
vi.mock('../services/financialService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/financialService')>()
  return {
    ...mod,
    getLatestFinancials: vi.fn(),
    getFinsDetailsLatest: vi.fn(),
    getFinancialAdjustmentsLatest: vi.fn(),
  }
})
import * as financialService from '../services/financialService'

vi.mock('../services/stockService')
vi.mock('../services/priceService')
vi.mock('../services/stockEdinetService')
vi.mock('../services/watchlistService')
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL:    'postgres://test',
  JQUANTS_API_KEY: 'key',
  EDINETDB_API_KEY: 'edinet-key',
  EDINET_API_KEY: 'official-edinet-key',
  SYNC_SECRET:     'secret',
}

// --- フィクスチャ ---
const STOCK = {
  code: '72030', coName: 'トヨタ自動車', coNameEn: 'TOYOTA MOTOR CORPORATION',
  mktNm: 'プライム', sector17Nm: '自動車・輸送機', sector33Nm: '輸送用機器',
  scaleCat: 'TOPIX Core30', mrgn: '2', mrgnNm: '貸借',
  sector17: '6', sector33: '3700', mkt: '0111', updatedAt: new Date(),
}

const PRICES = [
  {
    code: '72030', date: '2025-11-29',
    adjOpen: '2800', adjHigh: '2850', adjLow: '2780', adjClose: '2830',
    volume: '1000000', turnover: '2830000000000', adjFactor: '1.0',
    open: null, high: null, low: null, close: null, adjVolume: null,
  },
  {
    code: '72030', date: '2025-11-28',
    adjOpen: '2750', adjHigh: '2820', adjLow: '2740', adjClose: '2800',
    volume: '900000', turnover: '2520000000000', adjFactor: '1.0',
    open: null, high: null, low: null, close: null, adjVolume: null,
  },
]

const FINANCIALS = [{
  code: '72030', discNo: '123', discDate: '2025-03-01', docType: 'fy', curPerType: 'FY',
  sales: '45000000000000', op: '5000000000000', np: '4000000000000',
  eps: '375.4', bps: '3108', equity: '26100000000000', eqAr: '0.275',
  totalAssets: '94800000000000', cfo: '4210000000000', cashEq: '8430000000000',
  shOutFy: '13148000000', trShFy: '1000000000', divAnn: '107',
  fSales: null, fOp: null, fNp: null, fEps: null, fDivAnn: null,
}]

async function get(path: string) {
  return stockRoute.request(path, { method: 'GET' }, ENV)
}

// ---------- バリデーション ----------
describe('GET /stock/:code — validation', () => {
  it('returns 400 for non-4-digit code', async () => {
    const cases = ['abc', '123', '12345', '72-3', '7203x']
    for (const code of cases) {
      const res = await get(`/${code}`)
      expect(res.status, `code="${code}" should be rejected`).toBe(400)
    }
  })
})

// ---------- 404 ----------
describe('GET /stock/:code — not found', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(stockService.getStockByCode).mockResolvedValue(null)
    vi.mocked(priceService.getRecentPrices).mockResolvedValue([])
    vi.mocked(financialService.getLatestFinancials).mockResolvedValue([])
    vi.mocked(financialService.getFinsDetailsLatest).mockResolvedValue(null)
    vi.mocked(financialService.getFinancialAdjustmentsLatest).mockResolvedValue([])
    vi.mocked(stockEdinetService.getDisclosureTimeline).mockResolvedValue([])
    vi.mocked(stockEdinetService.getLatestForecasts).mockResolvedValue({ next: null, next2: null })
    vi.mocked(stockEdinetService.getLatestBridgeFact).mockResolvedValue(null)
    vi.mocked(stockEdinetService.getLatestQualityScore).mockResolvedValue(null)
    vi.mocked(stockEdinetService.getLatestTextScore).mockResolvedValue(null)
    vi.mocked(watchlistService.getStockMemoPanel).mockResolvedValue({ isWatched: false, notes: [] } as any)
  })

  it('returns 404 when stock not found in DB', async () => {
    const res = await get('/7203')
    expect(res.status).toBe(404)
  })
})

// ---------- 正常系 ----------
describe('GET /stock/:code — found', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(stockService.getStockByCode).mockResolvedValue(STOCK as any)
    vi.mocked(priceService.getRecentPrices).mockResolvedValue(PRICES as any)
    vi.mocked(financialService.getLatestFinancials).mockResolvedValue(FINANCIALS as any)
    vi.mocked(financialService.getFinsDetailsLatest).mockResolvedValue(null)
    vi.mocked(financialService.getFinancialAdjustmentsLatest).mockResolvedValue([])
    vi.mocked(stockEdinetService.getDisclosureTimeline).mockResolvedValue([{
      edinetCode: 'E00001',
      docId: 'DOC1',
      code: '72030',
      filingDate: '2026-02-14',
      eventType: '決算短信',
      title: '2026年3月期 第3四半期決算短信',
      isAmendment: false,
      submittedAt: null,
      sourceUpdatedAt: null,
    }] as any)
    vi.mocked(stockEdinetService.getLatestForecasts).mockResolvedValue({
      next: {
        code: '72030',
        edinetCode: 'E00001',
        fiscalYear: '2027-03',
        horizon: 'next',
        salesForecast: '46000000000000',
        opForecast: '5100000000000',
        npForecast: '4100000000000',
        epsForecast: '382.1',
        disclosedAt: '2026-02-14',
        sourceDocId: 'DOC1',
        updatedAt: new Date(),
      },
      next2: null,
    } as any)
    vi.mocked(stockEdinetService.getLatestBridgeFact).mockResolvedValue({
      code: '72030',
      edinetCode: 'E00001',
      fiscalYear: '2026-03',
      periodType: 'FY',
      operatingProfit: '5000000000000',
      pretaxProfit: '5200000000000',
      netProfit: '4000000000000',
      cfo: '4210000000000',
      depreciation: '1300000000000',
      adjustmentItemsJson: {},
      disclosedAt: '2026-02-14',
      sourceDocId: 'DOC1',
      updatedAt: new Date(),
    } as any)
    vi.mocked(stockEdinetService.getLatestQualityScore).mockResolvedValue({
      code: '72030',
      asOfDate: '2026-02-14',
      qualityScore: 78,
      componentsJson: { cfo_gap_penalty: 12 },
      formulaText: 'quality_score = 100 - penalties',
      updatedAt: new Date(),
    } as any)
    vi.mocked(stockEdinetService.getLatestTextScore).mockResolvedValue({
      code: '72030',
      asOfDate: '2026-02-14',
      anomalyScore: 34,
      componentsJson: { risk_terms_delta: 2.1 },
      formulaText: 'anomaly_score = normalized(text delta)',
      updatedAt: new Date(),
    } as any)
    vi.mocked(watchlistService.getStockMemoPanel).mockResolvedValue({
      isWatched: true,
      notes: [{
        id: 'memo-1',
        code: '72030',
        body: 'existing memo',
        createdAt: new Date('2026-02-01T00:00:00Z'),
        updatedAt: new Date('2026-02-02T00:00:00Z'),
      }],
    } as any)
  })

  it('returns 200', async () => {
    const res = await get('/7203')
    expect(res.status).toBe(200)
  })

  it('renders stock name', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('トヨタ自動車')
  })

  it('renders 4-digit code (not 5-digit)', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('7203')
    expect(html).not.toContain('72030')
  })

  it('renders breadcrumb with home link', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('href="/"')
    expect(html).toContain('ホーム')
  })

  it('renders market and sector tags', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('プライム市場')
    expect(html).toContain('輸送用機器')
    expect(html).toContain('TOPIX Core30')
  })

  it('renders latest adjClose price', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('2,830')  // latestClose toLocaleString
  })

  it('renders price change from previous day', async () => {
    const html = await (await get('/7203')).text()
    // 2830 - 2800 = +30
    expect(html).toContain('+30')
  })

  it('renders PER from calcMetrics', async () => {
    const html = await (await get('/7203')).text()
    // 2830 / 375.4 ≈ 7.5x
    expect(html).toContain('7.5x')
  })

  it('renders PBR from calcMetrics', async () => {
    const html = await (await get('/7203')).text()
    // 2830 / 3108 ≈ 0.91x
    expect(html).toContain('0.91x')
  })

  it('renders ROE from calcMetrics', async () => {
    const html = await (await get('/7203')).text()
    // 4000000000000 / 26100000000000 * 100 ≈ 15.3%
    expect(html).toContain('15.3%')
  })

  it('renders daily price table', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('2025-11-29')
    expect(html).toContain('2,800')  // adjOpen
  })

  it('renders financial summary (FY)', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('FY')
    expect(html).toContain('損益計算書')
    expect(html).toContain('貸借対照表')
  })

  it('renders financial history table', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('決算履歴')
    expect(html).toContain('2025-03-01')
  })

  it('renders adjusted EBITDA model status', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('調整後EBITDA（model）')
    expect(html).toContain('調整後EBITDA 算出状態')
  })

  it('renders EDINET sections and tooltip marker', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('EDINET 開示タイムライン')
    expect(html).toContain('会社予想スナップショット')
    expect(html).toContain('会計調整ブリッジ')
    expect(html).toContain('会計品質スコア')
    expect(html).toContain('テキスト異常スコア')
    expect(html).toContain('ⓘ')
  })

  it('renders watchlist control', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('ウォッチ解除')
    expect(html).toContain('メモ一覧')
  })
})

// ---------- データなし ----------
describe('GET /stock/:code — empty prices / financials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(stockService.getStockByCode).mockResolvedValue(STOCK as any)
    vi.mocked(priceService.getRecentPrices).mockResolvedValue([])
    vi.mocked(financialService.getLatestFinancials).mockResolvedValue([])
    vi.mocked(financialService.getFinsDetailsLatest).mockResolvedValue(null)
    vi.mocked(financialService.getFinancialAdjustmentsLatest).mockResolvedValue([])
    vi.mocked(stockEdinetService.getDisclosureTimeline).mockResolvedValue([])
    vi.mocked(stockEdinetService.getLatestForecasts).mockResolvedValue({ next: null, next2: null })
    vi.mocked(stockEdinetService.getLatestBridgeFact).mockResolvedValue(null)
    vi.mocked(stockEdinetService.getLatestQualityScore).mockResolvedValue(null)
    vi.mocked(stockEdinetService.getLatestTextScore).mockResolvedValue(null)
    vi.mocked(watchlistService.getStockMemoPanel).mockResolvedValue({ isWatched: false, notes: [] } as any)
  })

  it('shows sync prompt when no price data', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('同期してください')
  })

  it('shows sync prompt when no financial data', async () => {
    const html = await (await get('/7203')).text()
    expect(html).toContain('財務データがありません')
  })

  it('does not render price change when no prices', async () => {
    const html = await (await get('/7203')).text()
    // priceBlock は latestClose が null の場合は表示されない
    expect(html).not.toContain('stock-change')
  })
})
