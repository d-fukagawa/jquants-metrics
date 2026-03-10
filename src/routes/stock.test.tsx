import { describe, it, expect, vi, beforeEach } from 'vitest'
import { stockRoute } from './stock'
import * as stockService    from '../services/stockService'
import * as priceService    from '../services/priceService'
// calcMetrics / fmtJpy は純粋関数なので実装をそのまま使う
vi.mock('../services/financialService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/financialService')>()
  return { ...mod, getLatestFinancials: vi.fn() }
})
import * as financialService from '../services/financialService'

vi.mock('../services/stockService')
vi.mock('../services/priceService')
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL:    'postgres://test',
  JQUANTS_API_KEY: 'key',
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
    const cases = ['abc', '123', '12345', '720a', '7203x']
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
})

// ---------- データなし ----------
describe('GET /stock/:code — empty prices / financials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(stockService.getStockByCode).mockResolvedValue(STOCK as any)
    vi.mocked(priceService.getRecentPrices).mockResolvedValue([])
    vi.mocked(financialService.getLatestFinancials).mockResolvedValue([])
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
