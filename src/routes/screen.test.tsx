import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screenRoute } from './screen'
import * as screenService from '../services/screenService'

vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))
vi.mock('../services/screenService')

const ENV = {
  DATABASE_URL: 'postgres://test',
  JQUANTS_API_KEY: 'key',
  SYNC_SECRET: 'secret',
}

const MOCK_ROW = {
  code: '72030', coName: 'トヨタ自動車', sector17Nm: '自動車・輸送機',
  mktNm: 'プライム', scaleCat: 'TOPIX Core30', mrgnNm: '貸借',
  close: 3450, per: 12.5, pbr: 1.1, roe: 11.0, divYield: 2.5,
  eqAr: 0.384, psr: 0.3, evEbitda: 8.1, evAdjustedEbitda: 7.6, netCashRatio: 0.12,
}

async function get(path: string) {
  return screenRoute.request(path, { method: 'GET' }, ENV)
}

describe('GET /screen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(screenService.screenStocks).mockResolvedValue({ rows: [MOCK_ROW], total: 1 })
  })

  it('renders the filter sidebar', async () => {
    const res = await get('/')
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('スクリーニング条件')
    expect(html).toContain('PER（倍）')
    expect(html).toContain('PSR（倍）')
    expect(html).toContain('自己資本比率（%）')
    expect(html).toContain('黒字のみ')
  })

  it('renders results table with stock row', async () => {
    const res = await get('/')
    const html = await res.text()
    expect(html).toContain('7203')
    expect(html).toContain('トヨタ自動車')
    expect(html).toContain('12.5x')
    expect(html).toContain('8.1x')   // EV/EBITDA (既存指標)
    expect(html).toContain('7.6x')
    expect(html).toContain('38.4%') // eqAr 0.384 → 38.4%
    expect(html).toContain('2.5%')  // divYield
  })

  it('renders model label for adjusted EBITDA metric', async () => {
    const res = await get('/')
    const html = await res.text()
    expect(html).toContain('EV/調整後EBITDA')
    expect(html).toContain('model')
  })

  it('shows total count', async () => {
    const res = await get('/')
    const html = await res.text()
    expect(html).toContain('1件')
  })

  it('passes per_min/per_max to screenStocks', async () => {
    await get('/?per_min=5&per_max=20')
    expect(screenService.screenStocks).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ perMin: 5, perMax: 20 }),
    )
  })

  it('passes mkt array to screenStocks', async () => {
    await get('/?mkt=%E3%83%97%E3%83%A9%E3%82%A4%E3%83%A0&mkt=%E3%82%B9%E3%82%BF%E3%83%B3%E3%83%80%E3%83%BC%E3%83%89')
    expect(screenService.screenStocks).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mkt: ['プライム', 'スタンダード'] }),
    )
  })

  it('passes profit_only flag to screenStocks', async () => {
    await get('/?profit_only=1')
    expect(screenService.screenStocks).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ profitOnly: true }),
    )
  })

  it('shows empty state when no results', async () => {
    vi.mocked(screenService.screenStocks).mockResolvedValue({ rows: [], total: 0 })
    const res = await get('/?per_max=1')
    const html = await res.text()
    expect(html).toContain('条件に一致する銘柄がありません')
  })

  it('renders reset link', async () => {
    const res = await get('/?per_max=20')
    const html = await res.text()
    expect(html).toContain('href="/screen"')
  })
})
