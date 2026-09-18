import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncStockMaster, syncDailyPrices, syncFinancialSummary, syncFinancialSummaryByDate, syncFinsDetails, syncFinsDetailsFromEdinet } from './syncService'
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
    Mrgn: '2', MrgnNm: '貸借', ProdCat: '011', Date: '2026-02-21',
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
    expect(row.prodCat).toBe('011')
    expect(row.sourceDate).toBe('2026-02-21')
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
    DiscTime: '15:00:00',
    Code: '72030', DocType: '2QFinancialStatements_Consolidated_IFRS', CurPerType: '2Q',
    CurPerSt: '2024-04-01', CurPerEn: '2024-09-30',
    CurFYSt: '2024-04-01', CurFYEn: '2025-03-31',
    Sales: '24630753000000', OP: '2005692000000', NP: '1773426000000',
    EPS: '136.07', BPS: '',   // IFRS中間 — 空文字
    Eq: '38456954000000', ShEq: 38000000000000, EqAR: '0.384', TA: '100000000000000',
    CFO: '2944609000000', CFI: '-1200000000000', CFF: '-500000000000', CashEq: '8112922000000',
    ShOutFY: '15794987460', TrShFY: '2761598241', AvgSh: '13033161110',
    DivAnn: '30', FDivAnn: '35',
    FSales: '45000000000000', FOP: '4500000000000', FNP: '3500000000000', FEPS: '268.0',
    NCSales: '100', NCOP: '10', NCNP: '8', NCEPS: '1', NCTA: '200', NCEq: '90',
    NCShEq: '80', NCEqAR: '0.4', NCBPS: '40',
    FNCSales: '110', FNCOP: '11', FNCNP: '9', FNCEPS: '1.1',
    MatChgSub: true, SigChgInC: 'false',
    RetroRst: 'true', ChgByASRev: 'false', ChgNoASRev: '', ChgAcEst: 'false',
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
    expect(row.shareholdersEquity).toBe('38000000000000')
    expect(row.cfo).toBe('2944609000000')
    expect(row.cfi).toBe('-1200000000000')
    expect(row.cff).toBe('-500000000000')
    expect(row.discTime).toBe('15:00:00')
    expect(row.curPerStart).toBe('2024-04-01')
    expect(row.curPerEnd).toBe('2024-09-30')
    expect(row.curFyStart).toBe('2024-04-01')
    expect(row.curFyEnd).toBe('2025-03-31')
    expect(row.retroRestatement).toBe(true)
    expect(row.changedByAsRevision).toBe(false)
    expect(row.changedOtherThanAsRevision).toBeNull()
    expect(row.ncSales).toBe('100')
    expect(row.ncShareholdersEquity).toBe('80')
    expect(row.materialChangeSubsidiaries).toBe(true)
    expect(row.significantScopeChange).toBe(false)
  })

  it('updates the added source fields on conflict', async () => {
    vi.mocked(jquants.fetchFinancialSummary).mockResolvedValue([summary])
    const { db, onConflictDoUpdate } = makeMockDb()
    await syncFinancialSummary(db, API_KEY, '72030')
    const options = onConflictDoUpdate.mock.calls[0][0]
    expect(options.set).toEqual(expect.objectContaining({
      discTime: expect.anything(),
      curPerStart: expect.anything(),
      curPerEnd: expect.anything(),
      cfi: expect.anything(),
      cff: expect.anything(),
      shareholdersEquity: expect.anything(),
      ncSales: expect.anything(),
      significantScopeChange: expect.anything(),
      retroRestatement: expect.anything(),
    }))
  })

  it('returns 0 when API returns empty array', async () => {
    vi.mocked(jquants.fetchFinancialSummary).mockResolvedValue([])
    const { db, insert } = makeMockDb()
    const count = await syncFinancialSummary(db, API_KEY, '72030')
    expect(count).toBe(0)
    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects an unknown boolean value instead of storing it as null', async () => {
    vi.mocked(jquants.fetchFinancialSummary).mockResolvedValue([
      { ...summary, SigChgInC: 'unknown' },
    ])
    const { db, insert } = makeMockDb()

    await expect(syncFinancialSummary(db, API_KEY, '72030'))
      .rejects.toThrow('Invalid J-Quants boolean for SigChgInC')
    expect(insert).not.toHaveBeenCalled()
  })

  it('splits a large disclosure date into safe database batches', async () => {
    vi.mocked(jquants.fetchFinancialSummary).mockResolvedValue(
      Array.from({ length: 501 }, (_, index) => ({
        ...summary,
        DiscNo: `20240801${String(index).padStart(6, '0')}`,
      })),
    )
    const { db, values } = makeMockDb()

    const count = await syncFinancialSummary(db, API_KEY, '72030')

    expect(count).toBe(501)
    expect(values).toHaveBeenCalledTimes(2)
    expect(values.mock.calls[0][0]).toHaveLength(500)
    expect(values.mock.calls[1][0]).toHaveLength(1)
  })
})

describe('syncFinancialSummaryByDate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('stores all rows returned for a disclosure date', async () => {
    vi.mocked(jquants.fetchFinancialSummaryByDate).mockResolvedValue([{
      DiscNo: '20260914000001', DiscDate: '2026-09-14', DiscTime: '15:00:00',
      Code: '72030', DocType: '2QFinancialStatements_Consolidated_JP', CurPerType: '2Q',
      CurPerSt: '2026-04-01', CurPerEn: '2026-09-30', CurFYSt: '2026-04-01', CurFYEn: '2027-03-31',
      Sales: '100', OP: '10', NP: '8', EPS: '1', BPS: '10', Eq: '50', EqAR: '0.5', TA: '100',
      CFO: '12', CFI: '-5', CFF: '-2', CashEq: '20', ShOutFY: '100', TrShFY: '0', AvgSh: '100',
      DivAnn: '1', FDivAnn: '1', FSales: '200', FOP: '20', FNP: '16', FEPS: '2',
      RetroRst: 'false', ChgByASRev: 'false', ChgNoASRev: 'false', ChgAcEst: 'false',
    }])
    const { db, values } = makeMockDb()

    const count = await syncFinancialSummaryByDate(db, API_KEY, '2026-09-14')

    expect(count).toBe(1)
    expect(jquants.fetchFinancialSummaryByDate).toHaveBeenCalledWith(API_KEY, '2026-09-14')
    expect(values.mock.calls[0][0][0]).toEqual(expect.objectContaining({
      code: '72030',
      cfi: '-5',
      curPerStart: '2026-04-01',
    }))
  })
})

// ---------- syncFinsDetails ----------
describe('syncFinsDetails', () => {
  beforeEach(() => vi.clearAllMocks())

  const detail = {
    Code: '72030',
    DiscNo: 'D202603120001',
    DiscDate: '2026-03-12',
    DiscTime: '15:30:00',
    DocType: 'FYFinancialStatements_Consolidated_IFRS',
    FS: {
      'Type of current period, DEI': 'FY',
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
    expect(finsRows[0].discTime).toBe('15:30:00')
    expect(finsRows[0].curPerType).toBe('FY')

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
    expect(out.officialErrorCount).toBe(0)
    expect(out.officialWarningCount).toBe(0)

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
    expect(out.officialErrorCount).toBe(0)
  })

  it('counts an official API failure while preserving EDINET DB rows', async () => {
    vi.mocked(edinet.searchCompanyByCode).mockResolvedValue([
      { edinetCode: 'E00001', code: '7203' },
    ] as any)
    vi.mocked(edinet.fetchCompanyBridgeFacts).mockResolvedValue([
      { fiscalYear: '2026-03', periodType: 'FY', depreciation: '1', sourceDocId: 'S100ERR' },
    ] as any)
    vi.mocked(officialEdinet.fetchOfficialTaxAndAdjustments).mockRejectedValue(new Error('ZIP unavailable'))

    const { db } = makeMockDb()
    const out = await syncFinsDetailsFromEdinet(db, 'edinetdb-key', 'official-key', '72030')

    expect(out.synced).toBe(1)
    expect(out.detailsSource).toBe('edinetdb')
    expect(out.officialErrorCount).toBe(1)
  })
})
