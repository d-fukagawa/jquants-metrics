import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { stockMaster, dailyPrices, financialSummary, finsDetails, financialAdjustments } from '../db/schema'
import { fetchEquitiesMaster, fetchDailyPrices, fetchDailyPricesAll, fetchFinancialSummary, fetchFinsDetails } from '../jquants/client'

const BATCH_SIZE = 500

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// 空文字 → null 変換
function toNum(s: string | null | undefined): string | null {
  return s === null || s === undefined || s === '' ? null : s
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
  from = '2023-11-29',
  to   = '2025-11-29',
): Promise<number> {
  const bars = await fetchDailyPrices(apiKey, code, from, to)
  if (bars.length === 0) return 0

  const rows = bars.map(b => ({
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
  }))

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
    sales:       toNum(s.Sales),
    op:          toNum(s.OP),
    np:          toNum(s.NP),
    eps:         toNum(s.EPS),
    bps:         toNum(s.BPS),   // 空文字は NULL
    equity:      toNum(s.Eq),
    eqAr:        toNum(s.EqAR),
    totalAssets: toNum(s.TA),
    cfo:         toNum(s.CFO),
    cashEq:      toNum(s.CashEq),
    shOutFy:     toNum(s.ShOutFY),
    trShFy:      toNum(s.TrShFY),
    divAnn:      toNum(s.DivAnn),
    fSales:      toNum(s.FSales),
    fOp:         toNum(s.FOP),
    fNp:         toNum(s.FNP),
    fEps:        toNum(s.FEPS),
    fDivAnn:     toNum(s.FDivAnn),
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
      debtCurrent:  toNum(firstMatch(stmt, KEYS.debtCurrent)),
      debtNonCurr:  toNum(firstMatch(stmt, KEYS.debtNonCurr)),
      dna:          toNum(firstMatch(stmt, KEYS.dna)),
      pretaxProfit: toNum(firstMatch(stmt, KEYS.pretaxProfit)),
      taxExpense:   toNum(firstMatch(stmt, KEYS.taxExpense)),
    }
  }).filter(r => r.discNo)

  if (rows.length === 0) return 0

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

  if (adjustmentRows.length > 0) {
    await db.insert(financialAdjustments)
      .values(adjustmentRows)
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

  return rows.length
}

// 全銘柄の日足株価を1日分一括同期 — 1リクエストで全銘柄取得
// date: YYYY-MM-DD
export async function syncDailyPricesAll(db: Db, apiKey: string, date: string): Promise<number> {
  const bars = await fetchDailyPricesAll(apiKey, date)
  if (bars.length === 0) return 0

  const rows = bars.map(b => ({
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
  }))

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
  return rows.length
}

// 全銘柄の株価・財務を一括同期（GitHub Actions / Cron ハンドラー用）
// from/to: YYYY-MM-DD
// 株価: 日付単位バルク取得（1日1リクエスト）
// 財務: 銘柄単位（1銘柄1リクエスト）
// Light プラン(60 req/min) 対応: sleep(1000ms) で ~50 req/min
function datesBetween(from: string, to: string): string[] {
  const dates: string[] = []
  const end = new Date(to)
  for (const d = new Date(from); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

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
  const dates = datesBetween(from, to)
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
