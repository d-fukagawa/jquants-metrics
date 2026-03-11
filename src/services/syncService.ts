import { sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { stockMaster, dailyPrices, financialSummary } from '../db/schema'
import { fetchEquitiesMaster, fetchDailyPrices, fetchFinancialSummary } from '../jquants/client'

const BATCH_SIZE = 500

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// 空文字 → null 変換
function toNum(s: string | null | undefined): string | null {
  return s === null || s === undefined || s === '' ? null : s
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

// 全銘柄の株価・財務を一括同期（Cron ハンドラー用）
// from/to: YYYY-MM-DD（例: 直近7日間）
// レート制限（5 req/min）対応: 各 API 呼び出しの間に sleep(200)
export async function syncAllStocks(
  db: Db,
  apiKey: string,
  from: string,
  to: string,
): Promise<{ masterCount: number; priceCount: number; finCount: number }> {
  const masterCount = await syncStockMaster(db, apiKey)

  const stocks = await db.select({ code: stockMaster.code }).from(stockMaster)

  let priceCount = 0
  let finCount = 0

  // Light プラン: 60 req/min → 1000ms sleep で ~50 req/min に抑える
  for (const { code } of stocks) {
    priceCount += await syncDailyPrices(db, apiKey, code, from, to)
    await sleep(1000)
    finCount += await syncFinancialSummary(db, apiKey, code)
    await sleep(1000)
  }

  return { masterCount, priceCount, finCount }
}
