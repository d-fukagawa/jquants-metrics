import { describe, it, expect, vi, beforeEach } from 'vitest'
import { homeRoute } from './home'
import * as stockService from '../services/stockService'

vi.mock('../services/stockService')
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL:    'postgres://test',
  JQUANTS_API_KEY: 'key',
  SYNC_SECRET:     'secret',
}

const SAMPLE_STOCKS = [
  {
    code: '72030', coName: 'トヨタ自動車', coNameEn: 'TOYOTA MOTOR CORPORATION',
    sector33Nm: '輸送用機器', mktNm: 'プライム',
    sector17: '6', sector17Nm: '自動車・輸送機', sector33: '3700',
    scaleCat: 'TOPIX Core30', mkt: '0111', mrgn: '2', mrgnNm: '貸借',
    updatedAt: new Date(),
  },
  {
    code: '72670', coName: 'ホンダ技研工業', coNameEn: 'HONDA MOTOR CO LTD',
    sector33Nm: '輸送用機器', mktNm: 'プライム',
    sector17: '6', sector17Nm: '自動車・輸送機', sector33: '3700',
    scaleCat: 'TOPIX Large70', mkt: '0111', mrgn: '2', mrgnNm: '貸借',
    updatedAt: new Date(),
  },
]

async function get(path: string) {
  return homeRoute.request(path, { method: 'GET' }, ENV)
}

// ---------- GET / （クエリなし）----------
describe('GET /', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200', async () => {
    const res = await get('/')
    expect(res.status).toBe(200)
  })

  it('renders search form', async () => {
    const html = await (await get('/')).text()
    expect(html).toContain('<form')
    expect(html).toContain('name="q"')
    expect(html).toContain('type="submit"')
  })

  it('does NOT call searchStocks when q is absent', async () => {
    await get('/')
    expect(vi.mocked(stockService.searchStocks)).not.toHaveBeenCalled()
  })

  it('renders prompt message when no query', async () => {
    const html = await (await get('/')).text()
    expect(html).toContain('銘柄コード')
  })
})

// ---------- GET /?q=xxx （検索結果あり）----------
describe('GET /?q=xxx — results found', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(stockService.searchStocks).mockResolvedValue(SAMPLE_STOCKS as any)
  })

  it('calls searchStocks with the query string', async () => {
    await get('/?q=トヨタ')
    expect(vi.mocked(stockService.searchStocks)).toHaveBeenCalledWith(
      expect.anything(), 'トヨタ',
    )
  })

  it('renders result rows (4-digit codes)', async () => {
    const html = await (await get('/?q=toyota')).text()
    expect(html).toContain('7203')   // 72030 → 7203
    expect(html).toContain('7267')   // 72670 → 7267
  })

  it('renders company names', async () => {
    const html = await (await get('/?q=トヨタ')).text()
    expect(html).toContain('トヨタ自動車')
    expect(html).toContain('ホンダ技研工業')
  })

  it('result row links to /stock/:code4', async () => {
    const html = await (await get('/?q=トヨタ')).text()
    expect(html).toContain("/stock/7203")
    expect(html).toContain("/stock/7267")
  })

  it('renders sector and market info', async () => {
    const html = await (await get('/?q=トヨタ')).text()
    expect(html).toContain('輸送用機器')
    expect(html).toContain('プライム')
  })

  it('shows result count in section title', async () => {
    const html = await (await get('/?q=トヨタ')).text()
    expect(html).toContain('2件')
  })
})

// ---------- GET /?q=xxx （結果なし）----------
describe('GET /?q=xxx — no results', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(stockService.searchStocks).mockResolvedValue([])
  })

  it('renders "not found" message', async () => {
    const html = await (await get('/?q=zzz')).text()
    expect(html).toContain('zzz')
    expect(html).toContain('見つかりません')
  })

  it('does NOT render the result table', async () => {
    const html = await (await get('/?q=zzz')).text()
    expect(html).not.toContain('fav-table')
  })
})

// ---------- クエリのトリム ----------
describe('GET /?q=  (whitespace only)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('treats whitespace-only query as empty (no search)', async () => {
    await get('/?q=   ')
    expect(vi.mocked(stockService.searchStocks)).not.toHaveBeenCalled()
  })
})
