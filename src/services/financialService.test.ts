import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calcMetrics, fmtJpy, getLatestFinancials } from './financialService'
import type { Db } from '../db/client'

// ---------- テストフィクスチャ ----------
const BASE_FY = {
  code: '72030', discNo: '123', discDate: '2025-03-01',
  docType: 'fy', curPerType: 'FY',
  sales: '45000000000000', op: '5000000000000', np: '4000000000000',
  eps: '375.4', bps: '3108',
  equity: '26100000000000', eqAr: '0.275', totalAssets: '94800000000000',
  cfo: '4210000000000', cashEq: '8430000000000',
  shOutFy: '13148000000', trShFy: '1000000000',
  divAnn: '107', fSales: null, fOp: null, fNp: null, fEps: null, fDivAnn: null,
}

// ---------- calcMetrics ----------
describe('calcMetrics', () => {
  it('calculates PER correctly', () => {
    const m = calcMetrics(3450, [BASE_FY])
    // 3450 / 375.4 ≈ 9.2
    expect(m.per).toBe(9.2)
  })

  it('calculates PBR correctly', () => {
    const m = calcMetrics(3450, [BASE_FY])
    // 3450 / 3108 ≈ 1.11
    expect(m.pbr).toBe(1.11)
  })

  it('calculates ROE correctly', () => {
    const m = calcMetrics(3450, [BASE_FY])
    // 4000000000000 / 26100000000000 * 100 ≈ 15.3
    expect(m.roe).toBeCloseTo(15.3, 0)
  })

  it('calculates dividend yield correctly', () => {
    const m = calcMetrics(3450, [BASE_FY])
    // 107 / 3450 * 100 ≈ 3.1
    expect(m.divYield).toBeCloseTo(3.1, 0)
  })

  it('uses BPS fallback when BPS is empty string', () => {
    // IFRS中間では BPS が空 → Eq / (ShOutFY - TrShFY) で代替
    const row = { ...BASE_FY, bps: '' }
    const m   = calcMetrics(3450, [row])
    // 26100000000000 / (13148000000 - 1000000000) ≈ 2149
    expect(m.bps).not.toBeNull()
    expect(m.bps!).toBeGreaterThan(2000)
    expect(m.pbr).not.toBeNull()
  })

  it('prefers FY over interim (2Q) when both present', () => {
    const q2 = { ...BASE_FY, curPerType: '2Q', discNo: '456', eps: '50' }
    // q2 が先頭にあっても FY を使う
    const m  = calcMetrics(3450, [q2, BASE_FY])
    expect(m.curPerType).toBe('FY')
    expect(m.per).toBe(9.2)   // FY の EPS を使う
  })

  it('returns all nulls when latestClose is null', () => {
    const m = calcMetrics(null, [BASE_FY])
    expect(m.per).toBeNull()
    expect(m.pbr).toBeNull()
    expect(m.roe).toBeNull()
    expect(m.divYield).toBeNull()
  })

  it('returns all nulls when financials is empty', () => {
    const m = calcMetrics(3450, [])
    expect(m.per).toBeNull()
    expect(m.pbr).toBeNull()
  })

  it('returns null PER when EPS is zero', () => {
    const m = calcMetrics(3450, [{ ...BASE_FY, eps: '0' }])
    expect(m.per).toBeNull()
  })

  it('returns null PBR when BPS is zero', () => {
    const m = calcMetrics(3450, [{ ...BASE_FY, bps: '0' }])
    expect(m.pbr).toBeNull()
  })

  it('returns null ROE when equity is null', () => {
    const m = calcMetrics(3450, [{ ...BASE_FY, equity: null }])
    expect(m.roe).toBeNull()
  })

  it('exposes eps and divAnn values', () => {
    const m = calcMetrics(3450, [BASE_FY])
    expect(m.eps).toBe(375.4)
    expect(m.divAnn).toBe(107)
  })
})

// ---------- fmtJpy ----------
describe('fmtJpy', () => {
  it('formats trillion yen (兆)', () => {
    expect(fmtJpy('45100000000000')).toBe('¥45.10兆')
  })

  it('formats hundred million yen (億)', () => {
    expect(fmtJpy('20000000000')).toBe('¥200.00億')
  })

  it('formats small amount', () => {
    expect(fmtJpy('1234')).toBe('¥1,234')
  })

  it('returns — for null', () => {
    expect(fmtJpy(null)).toBe('—')
  })

  it('returns — for empty string', () => {
    expect(fmtJpy('')).toBe('—')
  })

  it('returns — for undefined', () => {
    expect(fmtJpy(undefined)).toBe('—')
  })

  it('formats negative trillion with ▼ prefix', () => {
    expect(fmtJpy('-3840000000000')).toContain('▼')
    expect(fmtJpy('-3840000000000')).toContain('兆')
  })
})

// ---------- getLatestFinancials ----------
describe('getLatestFinancials', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeMockDb(rows: unknown[] = []) {
    const limit   = vi.fn().mockResolvedValue(rows)
    const orderBy = vi.fn().mockReturnValue({ limit })
    const where   = vi.fn().mockReturnValue({ orderBy })
    const from    = vi.fn().mockReturnValue({ where })
    const select  = vi.fn().mockReturnValue({ from })
    return { db: { select } as unknown as Db, limit, orderBy }
  }

  it('returns rows ordered by discDate desc, limit 20', async () => {
    const { db, limit, orderBy } = makeMockDb([BASE_FY])
    const result = await getLatestFinancials(db, '72030')
    expect(orderBy).toHaveBeenCalledTimes(1)
    expect(limit).toHaveBeenCalledWith(20)
    expect(result).toEqual([BASE_FY])
  })

  it('returns empty array when no data', async () => {
    const { db } = makeMockDb([])
    const result = await getLatestFinancials(db, '99999')
    expect(result).toEqual([])
  })
})
