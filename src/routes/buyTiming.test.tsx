import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buyTimingApiRoute, buyTimingRoute } from './buyTiming'
import * as buyTimingService from '../services/buyTimingService'

vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))
vi.mock('../services/buyTimingService')

type ApiBacktestJson = {
  count: number
  barsCount: number
  params: {
    code: string
    threshold: number
    refWindow: number
    cooldown: number
    from: string
    to: string
  }
  triggers: Array<{
    date: string
    price: number
    ref: number
  }>
}

const ENV = {
  DATABASE_URL: 'postgres://test',
  JQUANTS_API_KEY: 'key',
  EDINETDB_API_KEY: 'edinet-key',
  EDINET_API_KEY: 'official-edinet-key',
  SYNC_SECRET: 'secret',
}

async function getPage(path: string) {
  return buyTimingRoute.request(path, { method: 'GET' }, ENV)
}

async function getApi(path: string) {
  return buyTimingApiRoute.request(path, { method: 'GET' }, ENV)
}

describe('GET /buy-timing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(buyTimingService.listBuyTimingBars).mockResolvedValue([
      { date: '2026-01-01', close: 100 },
      { date: '2026-01-02', close: 105 },
      { date: '2026-01-03', close: 101 },
    ])
  })

  it('renders controls and initial result', async () => {
    const res = await getPage('/')
    const html = await res.text()

    expect(res.status).toBe(200)
    expect(html).toContain('日経平均の押し目買いタイミング')
    expect(html).toContain('name="threshold"')
    expect(html).toContain('value="0.03"')
    expect(html).toContain('name="refWindow"')
    expect(html).toContain('name="cooldown"')
    expect(html).toContain('/static/buy-timing.js')
  })

  it('passes query params to the price service', async () => {
    await getPage('/?code=0000&threshold=0.04&refWindow=10&cooldown=5&from=2025-01-01&to=2026-01-01')

    expect(buyTimingService.listBuyTimingBars).toHaveBeenCalledWith(
      expect.anything(),
      {
        code5: '00000',
        from: '2025-01-01',
        to: '2026-01-01',
      },
    )
  })
})

describe('GET /api/buy-timing/backtest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(buyTimingService.listBuyTimingBars).mockResolvedValue([
      { date: '2026-01-01', close: 100 },
      { date: '2026-01-02', close: 105 },
      { date: '2026-01-03', close: 101 },
    ])
  })

  it('returns JSON backtest result', async () => {
    const res = await getApi('/backtest?code=0000&threshold=0.03&refWindow=20&cooldown=15&from=2026-01-01&to=2026-01-31')
    const json = await res.json() as ApiBacktestJson

    expect(res.status).toBe(200)
    expect(json).toMatchObject({
      count: 1,
      barsCount: 3,
      params: {
        code: '0000',
        threshold: 0.03,
        refWindow: 20,
        cooldown: 15,
        from: '2026-01-01',
        to: '2026-01-31',
      },
    })
    expect(json.triggers[0]).toMatchObject({
      date: '2026-01-03',
      price: 101,
      ref: 105,
    })
  })

  it('rejects invalid date range', async () => {
    const res = await getApi('/backtest?from=2026-02-01&to=2026-01-01')
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'from must be <= to' })
  })

  it('rejects invalid params', async () => {
    const res = await getApi('/backtest?threshold=0')
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ error: 'threshold must be > 0' })
  })
})
