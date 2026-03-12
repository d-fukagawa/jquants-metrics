import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calcAdjustedEbitda, calcAdvancedMetrics, calcMetrics, fmtJpy, getLatestFinancials } from './financialService'
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

const BASE_DETAIL = {
  code: '72030',
  discNo: 'D-001',
  discDate: '2025-03-01',
  docType: 'FY',
  curPerType: 'FY',
  debtCurrent: '50000000000',
  debtNonCurr: '150000000000',
  dna: '30000000000',
  pretaxProfit: '120000000000',
  taxExpense: '36000000000',
}

const BASE_ADJUSTMENTS = [
  {
    code: '72030',
    discNo: 'D-001',
    discDate: '2025-03-01',
    itemKey: 'Impairment loss',
    amount: '10000000000',
    direction: 'addback',
    category: 'impairment',
    source: 'fins_details.statement',
  },
  {
    code: '72030',
    discNo: 'D-001',
    discDate: '2025-03-01',
    itemKey: 'Gain on sale of non-current assets',
    amount: '2000000000',
    direction: 'deduction',
    category: 'gain',
    source: 'fins_details.statement',
  },
]

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

// ---------- calcAdvancedMetrics ----------
describe('calcAdvancedMetrics', () => {
  it('calculates EBITDA from OP + D&A', () => {
    const fy = { ...BASE_FY, op: '100000000000', shOutFy: '100', cashEq: '200000000000' }
    const d  = { ...BASE_DETAIL, dna: '30000000000', debtCurrent: '50000000000', debtNonCurr: '150000000000' }
    const m  = calcAdvancedMetrics(2000, fy, d)

    // EBITDA = OP + D&A = 100,000,000,000 + 30,000,000,000
    expect(m.ebitda).toBe(130000000000)
    // OP はそのまま出発点として NOPAT 計算に使われる
    expect(m.nopat).not.toBeNull()
  })

  it('returns null EBITDA when D&A is missing', () => {
    const fy = { ...BASE_FY, op: '100000000000' }
    const d  = { ...BASE_DETAIL, dna: null }
    const m  = calcAdvancedMetrics(2000, fy, d)

    expect(m.ebitda).toBeNull()
    expect(m.evEbitda).toBeNull()
  })

  it('returns null EBITDA when operating income is missing', () => {
    const fy = { ...BASE_FY, op: null }
    const m  = calcAdvancedMetrics(2000, fy, BASE_DETAIL)

    expect(m.ebitda).toBeNull()
    expect(m.nopat).toBeNull()
  })
})

// ---------- calcAdjustedEbitda ----------
describe('calcAdjustedEbitda', () => {
  it('calculates adjusted EBITDA with addback and deduction items', () => {
    const fy = { ...BASE_FY, op: '100000000000' }
    const d  = { ...BASE_DETAIL, dna: '30000000000' }
    const m  = calcAdjustedEbitda(fy, d, BASE_ADJUSTMENTS)

    // EBITDA = 130,000,000,000
    expect(m.ebitda).toBe(130000000000)
    // adjusted = 130,000,000,000 + 10,000,000,000 - 2,000,000,000
    expect(m.adjustedEbitda).toBe(138000000000)
    expect(m.addbackTotal).toBe(10000000000)
    expect(m.deductionTotal).toBe(2000000000)
    expect(m.reason).toBe('ok')
  })

  it('matches manual reconciliation: OP -> EBITDA -> Adjusted EBITDA', () => {
    const fy = { ...BASE_FY, op: '12000000000' } // 営業利益 120億
    const d  = { ...BASE_DETAIL, dna: '3000000000' } // D&A 30億
    const adjustments = [
      { ...BASE_ADJUSTMENTS[0], amount: '500000000' }, // 加算 5億
      { ...BASE_ADJUSTMENTS[1], amount: '200000000' }, // 控除 2億
    ]
    const m = calcAdjustedEbitda(fy, d, adjustments)

    // 手計算:
    // EBITDA = 120億 + 30億 = 150億
    // 調整後EBITDA = 150億 + 5億 - 2億 = 153億
    expect(m.ebitda).toBe(15000000000)
    expect(m.adjustedEbitda).toBe(15300000000)

    // 差分分解: 調整後EBITDA - 営業利益 = D&A + 加算 - 控除
    const op = 12000000000
    expect((m.adjustedEbitda ?? 0) - op).toBe(3300000000)
    expect(3000000000 + 500000000 - 200000000).toBe(3300000000)
  })

  it('returns op_missing when operating income is missing', () => {
    const fy = { ...BASE_FY, op: null }
    const m  = calcAdjustedEbitda(fy, BASE_DETAIL, BASE_ADJUSTMENTS)
    expect(m.reason).toBe('op_missing')
    expect(m.ebitda).toBeNull()
    expect(m.adjustedEbitda).toBeNull()
  })

  it('returns dna_missing when depreciation is missing', () => {
    const d = { ...BASE_DETAIL, dna: null }
    const m = calcAdjustedEbitda(BASE_FY, d, BASE_ADJUSTMENTS)
    expect(m.reason).toBe('dna_missing')
    expect(m.ebitda).toBeNull()
    expect(m.adjustedEbitda).toBeNull()
  })

  it('returns adjustment_missing when adjustment rows are empty', () => {
    const m = calcAdjustedEbitda(BASE_FY, BASE_DETAIL, [])
    expect(m.reason).toBe('adjustment_missing')
    expect(m.ebitda).toBe(5030000000000)
    expect(m.adjustedEbitda).toBeNull()
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
