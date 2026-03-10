import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncRoute } from './sync'
import * as syncService from '../services/syncService'

vi.mock('../services/syncService')
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL:    'postgres://test',
  JQUANTS_API_KEY: 'test-key',
  SYNC_SECRET:     'secret123',
}

async function post(body: unknown, secret?: string) {
  return syncRoute.request('/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(secret !== undefined ? { 'X-Sync-Secret': secret } : {}),
    },
    body: JSON.stringify(body),
  }, ENV)
}

// ---------- 認証 ----------
describe('POST /api/sync — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when X-Sync-Secret header is missing', async () => {
    const res = await post({ target: 'master' })
    expect(res.status).toBe(401)
  })

  it('returns 401 when secret is wrong', async () => {
    const res = await post({ target: 'master' }, 'wrong')
    expect(res.status).toBe(401)
  })

  it('returns 200 when secret is correct', async () => {
    vi.mocked(syncService.syncStockMaster).mockResolvedValue(100)
    const res = await post({ target: 'master' }, 'secret123')
    expect(res.status).toBe(200)
  })
})

// ---------- target: master ----------
describe('POST /api/sync — target: master', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls syncStockMaster and returns count', async () => {
    vi.mocked(syncService.syncStockMaster).mockResolvedValue(4200)
    const res  = await post({ target: 'master' }, 'secret123')
    const json = await res.json() as { ok: boolean; synced: number }
    expect(json.ok).toBe(true)
    expect(json.synced).toBe(4200)
  })
})

// ---------- target: prices ----------
describe('POST /api/sync — target: prices', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when code is missing', async () => {
    const res = await post({ target: 'prices' }, 'secret123')
    expect(res.status).toBe(400)
  })

  it('calls syncDailyPrices with code and default dates', async () => {
    vi.mocked(syncService.syncDailyPrices).mockResolvedValue(507)
    const res  = await post({ target: 'prices', code: '7203' }, 'secret123')
    const json = await res.json() as { ok: boolean; synced: number; code: string }
    expect(json.ok).toBe(true)
    expect(json.code).toBe('7203')
    expect(json.synced).toBe(507)
    expect(vi.mocked(syncService.syncDailyPrices)).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), '7203', '2023-11-29', '2025-11-29',
    )
  })

  it('passes custom from/to when provided', async () => {
    vi.mocked(syncService.syncDailyPrices).mockResolvedValue(10)
    await post({ target: 'prices', code: '7203', from: '2025-01-01', to: '2025-01-31' }, 'secret123')
    expect(vi.mocked(syncService.syncDailyPrices)).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), '7203', '2025-01-01', '2025-01-31',
    )
  })

  it('returns 400 when code is not 4-digit number', async () => {
    const cases = ['abc', '123', '12345', '', '720 3', '7203a']
    for (const code of cases) {
      const res = await post({ target: 'prices', code }, 'secret123')
      expect(res.status, `code="${code}" should be rejected`).toBe(400)
    }
  })
})

// ---------- target: financials ----------
describe('POST /api/sync — target: financials', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when code is missing', async () => {
    const res = await post({ target: 'financials' }, 'secret123')
    expect(res.status).toBe(400)
  })

  it('calls syncFinancialSummary and returns count', async () => {
    vi.mocked(syncService.syncFinancialSummary).mockResolvedValue(20)
    const res  = await post({ target: 'financials', code: '7203' }, 'secret123')
    const json = await res.json() as { ok: boolean; synced: number; code: string }
    expect(json.ok).toBe(true)
    expect(json.code).toBe('7203')
    expect(json.synced).toBe(20)
  })

  it('returns 400 when code is not 4-digit number', async () => {
    const cases = ['abc', '123', '12345', '7203x']
    for (const code of cases) {
      const res = await post({ target: 'financials', code }, 'secret123')
      expect(res.status, `code="${code}" should be rejected`).toBe(400)
    }
  })
})

// ---------- エラーハンドリング ----------
describe('POST /api/sync — error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 when syncService throws', async () => {
    vi.mocked(syncService.syncStockMaster).mockRejectedValue(new Error('API timeout'))
    const res  = await post({ target: 'master' }, 'secret123')
    const json = await res.json() as { ok: boolean; error: string }
    expect(res.status).toBe(500)
    expect(json.ok).toBe(false)
    expect(json.error).toContain('API timeout')
  })

  it('hides DB connection string in error message', async () => {
    vi.mocked(syncService.syncStockMaster).mockRejectedValue(
      new Error('connect ECONNREFUSED postgresql://user:pass@host/db'),
    )
    const res  = await post({ target: 'master' }, 'secret123')
    const json = await res.json() as { ok: boolean; error: string }
    expect(res.status).toBe(500)
    expect(json.error).toBe('Database error')
    expect(json.error).not.toContain('postgresql://')
  })

  it('returns 400 for invalid target', async () => {
    const res = await post({ target: 'unknown' }, 'secret123')
    expect(res.status).toBe(400)
  })
})
