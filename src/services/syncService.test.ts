import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncStockMaster, syncDailyPrices, syncFinancialSummary, syncFinsDetails, syncFinsDetailsFromEdinet } from './syncService'
import * as jquants from '../jquants/client'
import * as edinet from '../edinet/client'
import * as officialEdinet from '../edinet/officialClient'
import type { Db } from '../db/client'

vi.mock('../jquants/client')
vi.mock('../edinet/client')
vi.mock('../edinet/officialClient')

// チェーン可能なモック DB を生成
function makeMockDb() {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined)
  const values             = vi.fn().mockReturnValue({ onConflictDoUpdate })
  const insert             = vi.fn().mockReturnValue({ values })
  return { db: { insert } as unknown as Db, insert, values, onConflictDoUpdate }
}

const API_KEY = 'test-key'

// ---------- syncStockMaster ----------
describe('syncStockMaster', () => {
  beforeEach(() => vi.clearAllMocks())

  const master = {
    Code: '72030', CoName: 'トヨタ自動車', CoNameEn: 'TOYOTA MOTOR CORPORATION',
    Mkt: '0111', MktNm: 'プライム', S17: '6', S17Nm: '自動車・輸送機',
    S33: '3700', S33Nm: '輸送用機器', ScaleCat: 'TOPIX Core30',
    Mrgn: '2', MrgnNm: '貸借', Date: '2026-02-21',
  }

  it('returns number of synced records', async () => {
    vi.mocked(jquants.fetchEquitiesMaster).mockResolvedValue([master])
    const { db } = makeMockDb()
    const count = await syncStockMaster(db, API_KEY)
    expect(count).toBe(1)
  })

  it('maps API fields to DB columns correctly', async () => {
    vi.mocked(jquants.fetchEquitiesMaster).mockResolvedValue([master])
    const { db, values } = makeMockDb()
    await syncStockMaster(db, API_KEY)
    const row = values.mock.calls[0][0][0]
    expect(row.code).toBe('72030')
    expect(row.coName).toBe('トヨタ自動車')
    expect(row.coNameEn).toBe('TOYOTA MOTOR CORPORATION')
    expect(row.sector17).toBe('6')
    expect(row.sector17Nm).toBe('自動車・輸送機')
    expect(row.mrgn).toBe('2')
  })

  it('returns 0 and skips insert when empty', async () => {
    vi.mocked(jquants.fetchEquitiesMaster).mockResolvedValue([])
    const { db, insert } = makeMockDb()
    const count = await syncStockMaster(db, API_KEY)
    // empty配列でもBATCH_SIZEループは0回
    expect(count).toBe(0)
    expect(insert).not.toHaveBeenCalled()
  })
})

// ---------- syncDailyPrices ----------
describe('syncDailyPrices', () => {
  beforeEach(() => vi.clearAllMocks())

  const bar = {
    Code: '72030', Date: '2025-11-29',
    O: 2800, H: 2850, L: 2780, C: 2830,
    Vo: 1_000_000, Va: 2_830_000_000,
    AdjFactor: 1.0, AdjO: 2800, AdjH: 2850, AdjL: 2780, AdjC: 2830, AdjVo: 1_000_000,
    UL: '0', LL: '0',
  }

  it('returns number of synced records', async () => {
    vi.mocked(jquants.fetchDailyPrices).mockResolvedValue([bar])
    const { db } = makeMockDb()
    const count = await syncDailyPrices(db, API_KEY, '72030', '2025-11-01', '2025-11-29')
    expect(count).toBe(1)
  })

  it('maps OHLCV fields to string columns', async () => {
    vi.mocked(jquants.fetchDailyPrices).mockResolvedValue([bar])
    const { db, values } = makeMockDb()
    await syncDailyPrices(db, API_KEY, '72030', '2025-11-01', '2025-11-29')
    const row = values.mock.calls[0][0][0]
    expect(row.code).toBe('72030')
    expect(row.date).toBe('2025-11-29')
    expect(row.open).toBe('2800')
    expect(row.adjClose).toBe('2830')
    expect(row.turnover).toBe('2830000000')
  })

  it('converts null fields to null (not string "null")', async () => {
    vi.mocked(jquants.fetchDailyPrices).mockResolvedValue([
      { ...bar, O: null, Va: null, AdjFactor: null },
    ])
    const { db, values } = makeMockDb()
    await syncDailyPrices(db, API_KEY, '72030', '2025-11-01', '2025-11-29')
    const row = values.mock.calls[0][0][0]
    expect(row.open).toBeNull()
    expect(row.turnover).toBeNull()
    expect(row.adjFactor).toBeNull()
  })

  it('returns 0 when API returns empty array', async () => {
    vi.mocked(jquants.fetchDailyPrices).mockResolvedValue([])
    const { db, insert } = makeMockDb()
    const count = await syncDailyPrices(db, API_KEY, '72030', '2025-11-01', '2025-11-29')
    expect(count).toBe(0)
    expect(insert).not.toHaveBeenCalled()
  })

  it('uses default from/to when not specified', async () => {
    vi.mocked(jquants.fetchDailyPrices).mockResolvedValue([])
    const { db } = makeMockDb()
    await syncDailyPrices(db, API_KEY, '72030')
    expect(vi.mocked(jquants.fetchDailyPrices)).toHaveBeenCalledWith(
      API_KEY, '72030', '2023-11-29', '2025-11-29',
    )
  })
})

// ---------- syncFinancialSummary ----------
describe('syncFinancialSummary', () => {
  beforeEach(() => vi.clearAllMocks())

  const summary = {
    DiscNo: '20240801123456', DiscDate: '2024-08-01',
    Code: '72030', DocType: '2QFinancialStatements_Consolidated_IFRS', CurPerType: '2Q',
    Sales: '24630753000000', OP: '2005692000000', NP: '1773426000000',
    EPS: '136.07', BPS: '',   // IFRS中間 — 空文字
    Eq: '38456954000000', EqAR: '0.384', TA: '100000000000000',
    CFO: '2944609000000', CashEq: '8112922000000',
    ShOutFY: '15794987460', TrShFY: '2761598241', AvgSh: '13033161110',
    DivAnn: '30', FDivAnn: '35',
    FSales: '45000000000000', FOP: '4500000000000', FNP: '3500000000000', FEPS: '268.0',
  }

  it('returns number of synced records', async () => {
    vi.mocked(jquants.fetchFinancialSummary).mockResolvedValue([summary])
    const { db } = makeMockDb()
    const count = await syncFinancialSummary(db, API_KEY, '72030')
    expect(count).toBe(1)
  })

  it('converts empty BPS string to null', async () => {
    vi.mocked(jquants.fetchFinancialSummary).mockResolvedValue([summary])
    const { db, values } = makeMockDb()
    await syncFinancialSummary(db, API_KEY, '72030')
    const row = values.mock.calls[0][0][0]
    expect(row.bps).toBeNull()
  })

  it('maps financial fields correctly', async () => {
    vi.mocked(jquants.fetchFinancialSummary).mockResolvedValue([summary])
    const { db, values } = makeMockDb()
    await syncFinancialSummary(db, API_KEY, '72030')
    const row = values.mock.calls[0][0][0]
    expect(row.discNo).toBe('20240801123456')
    expect(row.curPerType).toBe('2Q')
    expect(row.eps).toBe('136.07')
    expect(row.eqAr).toBe('0.384')
    expect(row.cfo).toBe('2944609000000')
  })

  it('returns 0 when API returns empty array', async () => {
    vi.mocked(jquants.fetchFinancialSummary).mockResolvedValue([])
    const { db, insert } = makeMockDb()
    const count = await syncFinancialSummary(db, API_KEY, '72030')
    expect(count).toBe(0)
    expect(insert).not.toHaveBeenCalled()
  })
})

// ---------- syncFinsDetails ----------
describe('syncFinsDetails', () => {
  beforeEach(() => vi.clearAllMocks())

  const detail = {
    LocalCode: '72030',
    DisclosureNumber: 'D202603120001',
    DisclosedDate: '2026-03-12',
    TypeOfDocument: 'FYFinancialStatements_Consolidated_IFRS',
    TypeOfCurrentPeriod: 'FY',
    Statement: {
      'Depreciation and amortization': '30000000000',
      'Short-term borrowings': '50000000000',
      'Long-term borrowings': '150000000000',
      'Impairment loss': '10000000000',
      'Gain on sale of non-current assets': '2000000000',
    },
  }

  it('returns number of synced details records', async () => {
    vi.mocked(jquants.fetchFinsDetails).mockResolvedValue([detail])
    const { db } = makeMockDb()
    const count = await syncFinsDetails(db, API_KEY, '72030')
    expect(count).toBe(1)
  })

  it('upserts fins_details and financial_adjustments', async () => {
    vi.mocked(jquants.fetchFinsDetails).mockResolvedValue([detail])
    const { db, insert, values } = makeMockDb()
    await syncFinsDetails(db, API_KEY, '72030')

    // 1回目: fins_details
    expect(insert).toHaveBeenCalledTimes(2)
    const finsRows = values.mock.calls[0][0]
    expect(finsRows[0].code).toBe('72030')
    expect(finsRows[0].dna).toBe('30000000000')
    expect(finsRows[0].debtCurrent).toBe('50000000000')
    expect(finsRows[0].debtNonCurr).toBe('150000000000')

    // 2回目: financial_adjustments
    const adjustmentRows = values.mock.calls[1][0]
    expect(adjustmentRows).toHaveLength(2)
    expect(adjustmentRows[0].direction).toBe('addback')
    expect(adjustmentRows[0].itemKey).toBe('Impairment loss')
    expect(adjustmentRows[1].direction).toBe('deduction')
    expect(adjustmentRows[1].itemKey).toBe('Gain on sale of non-current assets')
  })

  it('returns 0 when API returns empty array', async () => {
    vi.mocked(jquants.fetchFinsDetails).mockResolvedValue([])
    const { db, insert } = makeMockDb()
    const count = await syncFinsDetails(db, API_KEY, '72030')
    expect(count).toBe(0)
    expect(insert).not.toHaveBeenCalled()
  })
})

// ---------- syncFinsDetailsFromEdinet ----------
describe('syncFinsDetailsFromEdinet', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores FY row as EDINET:<fiscal_year> and saves official tax/adjustments', async () => {
    vi.mocked(edinet.searchCompanyByCode).mockResolvedValue([
      { edinetCode: 'E00001', code: '7203' },
    ] as any)
    vi.mocked(edinet.fetchCompanyBridgeFacts).mockResolvedValue([
      {
        fiscalYear: '2026-03',
        periodType: 'FY',
        debtCurrent: '50000000000',
        debtNonCurr: '150000000000',
        depreciation: '30000000000',
        pretaxProfit: '120000000000',
        sourceDocId: 'S100TEST',
      },
    ] as any)
    vi.mocked(officialEdinet.fetchOfficialTaxAndAdjustments).mockResolvedValue({
      taxExpense: '36000000000',
      adjustments: [
        { itemKey: 'Impairment loss', amount: '10000000000', direction: 'addback', category: 'impairment' },
      ],
    })

    const { db, values } = makeMockDb()
    const out = await syncFinsDetailsFromEdinet(db, 'edinetdb-key', 'official-key', '72030')

    expect(out.synced).toBe(1)
    expect(out.detailsSource).toBe('edinet+official')
    expect(out.taxExpenseFilledCount).toBe(1)
    expect(out.adjustmentsFilledCount).toBe(1)

    const detailsRows = values.mock.calls[0][0]
    expect(detailsRows[0].discNo).toBe('EDINET:2026-03')
    expect(detailsRows[0].taxExpense).toBe('36000000000')
    const adjRows = values.mock.calls[1][0]
    expect(adjRows[0].source).toBe('edinet.official.statement')
  })

  it('returns edinetdb source when official key is unavailable', async () => {
    vi.mocked(edinet.searchCompanyByCode).mockResolvedValue([
      { edinetCode: 'E00001', code: '7203' },
    ] as any)
    vi.mocked(edinet.fetchCompanyBridgeFacts).mockResolvedValue([
      { fiscalYear: '2026-03', periodType: 'FY', depreciation: '1' },
    ] as any)

    const { db } = makeMockDb()
    const out = await syncFinsDetailsFromEdinet(db, 'edinetdb-key', null, '72030')
    expect(out.detailsSource).toBe('edinetdb')
    expect(out.taxExpenseFilledCount).toBe(0)
    expect(out.adjustmentsFilledCount).toBe(0)
  })
})
