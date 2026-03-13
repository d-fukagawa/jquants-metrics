import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { stockMaster, dailyPrices, financialSummary, finsDetails, financialAdjustments } from '../db/schema'
import type { DailyBar } from '../jquants/types'
import { fetchEquitiesMaster, fetchDailyPrices, fetchDailyPricesAll, fetchFinancialSummary, fetchFinsDetails } from '../jquants/client'
import { fetchCompanyBridgeFacts, searchCompanyByCode } from '../edinet/client'
import { fetchOfficialTaxAndAdjustments } from '../edinet/officialClient'
import { toNullableString } from '../utils/number'
import { enumerateDates } from '../utils/date'

const BATCH_SIZE = 500
export const DEFAULT_PRICE_SYNC_FROM = '2023-11-29'
export const DEFAULT_PRICE_SYNC_TO = '2025-11-29'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export type DetailsSource = 'jquants' | 'edinetdb' | 'edinet+official'

export interface EdinetFallbackResult {
  synced: number
  detailsSource: DetailsSource
  taxExpenseFilledCount: number
  adjustmentsFilledCount: number
}

// XBRL キー名の候補から最初にマッチする値を返す
function firstMatch(stmt: Record<string, string>, keys: readonly string[]): string | null {
  for (const k of keys) {
    const v = stmt[k]
    if (v !== undefined && v !== null && v !== '') return v
  }
  return null
}

const KEYS = {
  debtCurrent:  [
    'Bonds and borrowings - CL (IFRS)',
    'Borrowings - CL (IFRS)',
    'Short-term borrowings',
    'Short-term loans payable',
    'Current portion of bonds and borrowings',
  ],
  debtNonCurr:  [
    'Bonds and borrowings - NCL (IFRS)',
    'Borrowings - NCL (IFRS)',
    'Long-term borrowings',
    'Long-term loans payable',
    'Non-current bonds and borrowings',
  ],
  dna:          [
    'Depreciation and amortization - OpeCF (IFRS)',
    'Depreciation and amortization',
    'DepreciationAndAmortization',
    'Depreciation',
    'Amortization',
    'Depreciation and amortization expense',
  ],
  pretaxProfit: ['Profit (loss) before tax from continuing operations (IFRS)', 'Profit before tax', 'PBT', 'IncomeBeforeIncomeTaxes'],
  taxExpense:   ['Income tax expense (IFRS)', 'Income taxes', 'Tax expense', 'IncomeTaxes'],
  adjustments: {
    addbacks: [
      { key: 'Impairment loss', category: 'impairment' },
      { key: 'Loss on business restructuring', category: 'restructuring' },
      { key: 'Loss on disposal of non-current assets', category: 'one_off' },
      { key: 'Loss on retirement of non-current assets', category: 'one_off' },
      { key: 'Restructuring costs', category: 'restructuring' },
    ],
    deductions: [
      { key: 'Gain on sale of non-current assets', category: 'gain' },
      { key: 'Gain on disposal of non-current assets', category: 'gain' },
      { key: 'Gain on step acquisitions', category: 'gain' },
      { key: 'Gain on bargain purchase', category: 'gain' },
      { key: 'Gain on sale of shares of subsidiaries and associates', category: 'gain' },
    ],
  },
} as const

function pickAdjustmentItems(stmt: Record<string, string>, code: string, discNo: string, discDate: string | null) {
  const rows: Array<{
    code: string
    discNo: string
    discDate: string | null
    itemKey: string
    amount: string
    direction: 'addback' | 'deduction'
    category: string
    source: string
  }> = []

  for (const item of KEYS.adjustments.addbacks) {
    const v = stmt[item.key]
    const n = v == null || v === '' ? null : Number(v)
    if (n == null || Number.isNaN(n) || n === 0) continue
    rows.push({
      code,
      discNo,
      discDate,
      itemKey: item.key,
      amount: String(Math.abs(n)),
      direction: 'addback',
      category: item.category,
      source: 'fins_details.statement',
    })
  }

  for (const item of KEYS.adjustments.deductions) {
    const v = stmt[item.key]
    const n = v == null || v === '' ? null : Number(v)
    if (n == null || Number.isNaN(n) || n === 0) continue
    rows.push({
      code,
      discNo,
      discDate,
      itemKey: item.key,
      amount: String(Math.abs(n)),
      direction: 'deduction',
      category: item.category,
      source: 'fins_details.statement',
    })
  }

  return rows
}

function isFyPeriodType(periodType: string | null | undefined): boolean {
  if (!periodType) return true
  const p = periodType.toUpperCase()
  return p === 'FY' || p.includes('ANNUAL') || p.includes('FULL') || periodType.includes('通期')
}

function toEdinetDiscNo(fiscalYear: string): string {
  return `EDINET:${fiscalYear.trim()}`
}

async function upsertFinsDetailsRows(
  db: Db,
  rows: Array<{
    code: string
    discNo: string
    discDate: string | null
    docType: string | null
    curPerType: string | null
    debtCurrent: string | null
    debtNonCurr: string | null
    dna: string | null
    pretaxProfit: string | null
    taxExpense: string | null
  }>,
) {
  if (rows.length === 0) return
  await db.insert(finsDetails)
    .values(rows)
    .onConflictDoUpdate({
      target: [finsDetails.code, finsDetails.discNo],
      set: {
        discDate:     sql`excluded.disc_date`,
        docType:      sql`excluded.doc_type`,
        curPerType:   sql`excluded.cur_per_type`,
        debtCurrent:  sql`excluded.debt_current`,
        debtNonCurr:  sql`excluded.debt_non_curr`,
        dna:          sql`excluded.dna`,
        pretaxProfit: sql`excluded.pretax_profit`,
        taxExpense:   sql`excluded.tax_expense`,
      },
    })
}

async function upsertFinancialAdjustmentRows(
  db: Db,
  rows: Array<{
    code: string
    discNo: string
    discDate: string | null
    itemKey: string
    amount: string
    direction: 'addback' | 'deduction'
    category: string
    source: string
  }>,
) {
  if (rows.length === 0) return
  await db.insert(financialAdjustments)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        financialAdjustments.code,
        financialAdjustments.discNo,
        financialAdjustments.itemKey,
        financialAdjustments.direction,
      ],
      set: {
        discDate:  sql`excluded.disc_date`,
        amount:    sql`excluded.amount`,
        category:  sql`excluded.category`,
        source:    sql`excluded.source`,
      },
    })
}

async function resolveEdinetCode(edinetDbApiKey: string, code5: string): Promise<string | null> {
  const code4 = code5.slice(0, 4)
  const rows = await searchCompanyByCode(edinetDbApiKey, code4)
  const match = rows.find(r => (r.code ?? '').slice(0, 4) === code4) ?? rows[0] ?? null
  return match?.edinetCode ?? null
}

function mapDailyPriceRow(b: DailyBar) {
  return {
    code:      b.Code,
    date:      b.Date,
    open:      b.O?.toString()         ?? null,
    high:      b.H?.toString()         ?? null,
    low:       b.L?.toString()         ?? null,
    close:     b.C?.toString()         ?? null,
    volume:    b.Vo?.toString()        ?? null,
    turnover:  b.Va?.toString()        ?? null,
    adjFactor: b.AdjFactor?.toString() ?? null,
    adjOpen:   b.AdjO?.toString()      ?? null,
    adjHigh:   b.AdjH?.toString()      ?? null,
    adjLow:    b.AdjL?.toString()      ?? null,
    adjClose:  b.AdjC?.toString()      ?? null,
    adjVolume: b.AdjVo?.toString()     ?? null,
  }
}

async function upsertDailyPriceRows(db: Db, rows: ReturnType<typeof mapDailyPriceRow>[]) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await db.insert(dailyPrices)
      .values(rows.slice(i, i + BATCH_SIZE))
      .onConflictDoUpdate({
        target: [dailyPrices.code, dailyPrices.date],
        set: {
          open:      sql`excluded.open`,
          high:      sql`excluded.high`,
          low:       sql`excluded.low`,
          close:     sql`excluded.close`,
          volume:    sql`excluded.volume`,
          turnover:  sql`excluded.turnover`,
          adjFactor: sql`excluded.adj_factor`,
          adjOpen:   sql`excluded.adj_open`,
          adjHigh:   sql`excluded.adj_high`,
          adjLow:    sql`excluded.adj_low`,
          adjClose:  sql`excluded.adj_close`,
          adjVolume: sql`excluded.adj_volume`,
        },
      })
  }
}

// 銘柄マスタ同期 — /v2/equities/master
export async function syncStockMaster(db: Db, apiKey: string): Promise<number> {
  const masters = await fetchEquitiesMaster(apiKey)

  const rows = masters.map(m => ({
    code:       m.Code,
    coName:     m.CoName,
    coNameEn:   m.CoNameEn,
    sector17:   m.S17,
    sector17Nm: m.S17Nm,
    sector33:   m.S33,
    sector33Nm: m.S33Nm,
    scaleCat:   m.ScaleCat,
    mkt:        m.Mkt,
    mktNm:      m.MktNm,
    mrgn:       m.Mrgn,
    mrgnNm:     m.MrgnNm,
    updatedAt:  new Date(),
  }))

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await db.insert(stockMaster)
      .values(rows.slice(i, i + BATCH_SIZE))
      .onConflictDoUpdate({
        target: stockMaster.code,
        set: {
          coName:     sql`excluded.co_name`,
          coNameEn:   sql`excluded.co_name_en`,
          sector17:   sql`excluded.sector17`,
          sector17Nm: sql`excluded.sector17_nm`,
          sector33:   sql`excluded.sector33`,
          sector33Nm: sql`excluded.sector33_nm`,
          scaleCat:   sql`excluded.scale_cat`,
          mkt:        sql`excluded.mkt`,
          mktNm:      sql`excluded.mkt_nm`,
          mrgn:       sql`excluded.mrgn`,
          mrgnNm:     sql`excluded.mrgn_nm`,
          updatedAt:  sql`excluded.updated_at`,
        },
      })
  }
  return rows.length
}

// 日足株価同期 — /v2/equities/bars/daily
// code: 5桁 (例: "72030")、free プランのデフォルト範囲は 2023-11-29 〜 2025-11-29
export async function syncDailyPrices(
  db: Db,
  apiKey: string,
  code: string,
  from = DEFAULT_PRICE_SYNC_FROM,
  to   = DEFAULT_PRICE_SYNC_TO,
): Promise<number> {
  const bars = await fetchDailyPrices(apiKey, code, from, to)
  if (bars.length === 0) return 0

  const rows = bars.map(mapDailyPriceRow)
  await upsertDailyPriceRows(db, rows)
  return rows.length
}


// 財務情報同期 — /v2/fins/summary
export async function syncFinancialSummary(
  db: Db,
  apiKey: string,
  code: string,
): Promise<number> {
  const summaries = await fetchFinancialSummary(apiKey, code)
  if (summaries.length === 0) return 0

  const rows = summaries.map(s => ({
    code:        s.Code,
    discNo:      s.DiscNo,
    discDate:    s.DiscDate  || null,
    docType:     s.DocType   || null,
    curPerType:  s.CurPerType || null,
    sales:       toNullableString(s.Sales),
    op:          toNullableString(s.OP),
    np:          toNullableString(s.NP),
    eps:         toNullableString(s.EPS),
    bps:         toNullableString(s.BPS),   // 空文字は NULL
    equity:      toNullableString(s.Eq),
    eqAr:        toNullableString(s.EqAR),
    totalAssets: toNullableString(s.TA),
    cfo:         toNullableString(s.CFO),
    cashEq:      toNullableString(s.CashEq),
    shOutFy:     toNullableString(s.ShOutFY),
    trShFy:      toNullableString(s.TrShFY),
    divAnn:      toNullableString(s.DivAnn),
    fSales:      toNullableString(s.FSales),
    fOp:         toNullableString(s.FOP),
    fNp:         toNullableString(s.FNP),
    fEps:        toNullableString(s.FEPS),
    fDivAnn:     toNullableString(s.FDivAnn),
  }))

  await db.insert(financialSummary)
    .values(rows)
    .onConflictDoUpdate({
      target: [financialSummary.code, financialSummary.discNo],
      set: {
        discDate:    sql`excluded.disc_date`,
        docType:     sql`excluded.doc_type`,
        curPerType:  sql`excluded.cur_per_type`,
        sales:       sql`excluded.sales`,
        op:          sql`excluded.op`,
        np:          sql`excluded.np`,
        eps:         sql`excluded.eps`,
        bps:         sql`excluded.bps`,
        equity:      sql`excluded.equity`,
        eqAr:        sql`excluded.eq_ar`,
        totalAssets: sql`excluded.total_assets`,
        cfo:         sql`excluded.cfo`,
        cashEq:      sql`excluded.cash_eq`,
        shOutFy:     sql`excluded.sh_out_fy`,
        trShFy:      sql`excluded.tr_sh_fy`,
        divAnn:      sql`excluded.div_ann`,
        fSales:      sql`excluded.f_sales`,
        fOp:         sql`excluded.f_op`,
        fNp:         sql`excluded.f_np`,
        fEps:        sql`excluded.f_eps`,
        fDivAnn:     sql`excluded.f_div_ann`,
      },
    })

  return rows.length
}

// 詳細財務情報同期 — /v2/fins/details
export async function syncFinsDetails(
  db: Db,
  apiKey: string,
  code: string,
): Promise<number> {
  const details = await fetchFinsDetails(apiKey, code)
  if (details.length === 0) return 0

  const adjustmentRows: Array<{
    code: string
    discNo: string
    discDate: string | null
    itemKey: string
    amount: string
    direction: 'addback' | 'deduction'
    category: string
    source: string
  }> = []

  const rows = details.map(d => {
    const stmt = d.Statement ?? {}
    const discNo = d.DisclosureNumber
    const code5 = d.LocalCode ?? d.Code ?? code
    const discDate = d.DisclosedDate || null
    adjustmentRows.push(...pickAdjustmentItems(stmt, code5, discNo, discDate))

    return {
      code:         code5,
      discNo:       discNo,
      discDate:     discDate,
      docType:      d.TypeOfDocument   || null,
      curPerType:   d.TypeOfCurrentPeriod || null,
      debtCurrent:  toNullableString(firstMatch(stmt, KEYS.debtCurrent)),
      debtNonCurr:  toNullableString(firstMatch(stmt, KEYS.debtNonCurr)),
      dna:          toNullableString(firstMatch(stmt, KEYS.dna)),
      pretaxProfit: toNullableString(firstMatch(stmt, KEYS.pretaxProfit)),
      taxExpense:   toNullableString(firstMatch(stmt, KEYS.taxExpense)),
    }
  }).filter(r => r.discNo)

  if (rows.length === 0) return 0

  await upsertFinsDetailsRows(db, rows)
  await upsertFinancialAdjustmentRows(db, adjustmentRows)

  return rows.length
}

// 詳細財務情報補完（EDINETDB + 公式EDINET API）
// - FY のみ対象
// - disc_no は EDINET:<fiscal_year>
// - official が取れない場合は tax/adjustment を null 許容
export async function syncFinsDetailsFromEdinet(
  db: Db,
  edinetDbApiKey: string,
  edinetApiKey: string | null,
  code5: string,
): Promise<EdinetFallbackResult> {
  const edinetCode = await resolveEdinetCode(edinetDbApiKey, code5)
  if (!edinetCode) {
    return {
      synced: 0,
      detailsSource: 'edinetdb',
      taxExpenseFilledCount: 0,
      adjustmentsFilledCount: 0,
    }
  }

  const facts = await fetchCompanyBridgeFacts(edinetDbApiKey, edinetCode)
  const fyFacts = facts.filter(f => isFyPeriodType(f.periodType))
  if (fyFacts.length === 0) {
    return {
      synced: 0,
      detailsSource: 'edinetdb',
      taxExpenseFilledCount: 0,
      adjustmentsFilledCount: 0,
    }
  }

  const rows: Array<{
    code: string
    discNo: string
    discDate: string | null
    docType: string | null
    curPerType: string | null
    debtCurrent: string | null
    debtNonCurr: string | null
    dna: string | null
    pretaxProfit: string | null
    taxExpense: string | null
  }> = []

  const adjustmentRows: Array<{
    code: string
    discNo: string
    discDate: string | null
    itemKey: string
    amount: string
    direction: 'addback' | 'deduction'
    category: string
    source: string
  }> = []

  let taxExpenseFilledCount = 0
  let adjustmentsFilledCount = 0
  let usedOfficial = false

  for (const fact of fyFacts) {
    const fiscalYear = fact.fiscalYear?.trim()
    if (!fiscalYear) continue

    const discNo = toEdinetDiscNo(fiscalYear)
    const discDate = fact.disclosedAt ?? null
    let taxExpense = toNullableString(fact.taxExpense)

    if (edinetApiKey && fact.sourceDocId) {
      try {
        const official = await fetchOfficialTaxAndAdjustments(edinetApiKey, fact.sourceDocId)
        usedOfficial = true
        if (taxExpense == null && official.taxExpense != null) {
          taxExpense = toNullableString(official.taxExpense)
        }
        for (const a of official.adjustments) {
          adjustmentRows.push({
            code: code5,
            discNo,
            discDate,
            itemKey: a.itemKey,
            amount: a.amount,
            direction: a.direction,
            category: a.category,
            source: 'edinet.official.statement',
          })
        }
      } catch {
        // 公式EDINETの取得失敗は継続（NULL許容）
      }
    }

    if (taxExpense != null) taxExpenseFilledCount++

    rows.push({
      code: code5,
      discNo,
      discDate,
      docType: 'EDINET_FINANCIALS',
      curPerType: 'FY',
      debtCurrent: toNullableString(fact.debtCurrent),
      debtNonCurr: toNullableString(fact.debtNonCurr),
      dna: toNullableString(fact.depreciation),
      pretaxProfit: toNullableString(fact.pretaxProfit),
      taxExpense,
    })
  }

  adjustmentsFilledCount = adjustmentRows.length
  await upsertFinsDetailsRows(db, rows)
  await upsertFinancialAdjustmentRows(db, adjustmentRows)

  return {
    synced: rows.length,
    detailsSource: usedOfficial ? 'edinet+official' : 'edinetdb',
    taxExpenseFilledCount,
    adjustmentsFilledCount,
  }
}

// 全銘柄の日足株価を1日分一括同期 — 1リクエストで全銘柄取得
// date: YYYY-MM-DD
export async function syncDailyPricesAll(db: Db, apiKey: string, date: string): Promise<number> {
  const bars = await fetchDailyPricesAll(apiKey, date)
  if (bars.length === 0) return 0

  const rows = bars.map(mapDailyPriceRow)
  await upsertDailyPriceRows(db, rows)
  return rows.length
}

// 全銘柄の株価・財務を一括同期（GitHub Actions / Cron ハンドラー用）
// from/to: YYYY-MM-DD
// 株価: 日付単位バルク取得（1日1リクエスト）
// 財務: 銘柄単位（1銘柄1リクエスト）
// Light プラン(60 req/min) 対応: sleep(1000ms) で ~50 req/min

export async function syncAllStocks(
  db: Db,
  apiKey: string,
  from: string,
  to: string,
): Promise<{ masterCount: number; priceCount: number; finCount: number; finDetailsCount: number }> {
  // 銘柄マスタ
  console.log('[sync] master: start')
  const masterCount = await syncStockMaster(db, apiKey)
  console.log(`[sync] master: done  count=${masterCount}`)
  await sleep(1000)

  // 株価: 日付ごとに全銘柄一括取得（N日分 = N リクエスト）
  const dates = enumerateDates(from, to)
  console.log(`[sync] prices: start  dates=${dates.join(',')}`)
  let priceCount = 0
  for (const date of dates) {
    const n = await syncDailyPricesAll(db, apiKey, date)
    priceCount += n
    console.log(`[sync] prices: date=${date}  rows=${n}`)
    await sleep(1000)
  }
  console.log(`[sync] prices: done  total=${priceCount}`)

  // 財務サマリー + 詳細財務: 銘柄ごとに取得（各 ~4400 リクエスト）
  const stocks = await db.select({ code: stockMaster.code }).from(stockMaster)
  console.log(`[sync] financials: start  stocks=${stocks.length}`)
  let finCount = 0
  let finDetailsCount = 0
  let finDone = 0
  for (const { code } of stocks) {
    const n = await syncFinancialSummary(db, apiKey, code)
    finCount += n
    await sleep(1000)

    const nd = await syncFinsDetails(db, apiKey, code)
    finDetailsCount += nd
    finDone++
    if (finDone % 100 === 0) {
      console.log(`[sync] financials: progress  ${finDone}/${stocks.length}  fins=${finCount}  details=${finDetailsCount}`)
    }
    await sleep(1000)
  }
  console.log(`[sync] financials: done  fins=${finCount}  details=${finDetailsCount}`)

  return { masterCount, priceCount, finCount, finDetailsCount }
}
