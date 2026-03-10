import { pgTable, varchar, text, numeric, date, timestamp, primaryKey, index } from 'drizzle-orm/pg-core'

// 銘柄マスタ — /v2/equities/master
export const stockMaster = pgTable('stock_master', {
  code:       varchar('code', { length: 5 }).primaryKey(),  // 5桁 (例: "72030")
  coName:     text('co_name').notNull(),
  coNameEn:   text('co_name_en').notNull(),
  sector17:   text('sector17').notNull(),
  sector17Nm: text('sector17_nm').notNull(),
  sector33:   text('sector33').notNull(),
  sector33Nm: text('sector33_nm').notNull(),
  scaleCat:   text('scale_cat').notNull(),
  mkt:        text('mkt').notNull(),
  mktNm:      text('mkt_nm').notNull(),
  mrgn:       text('mrgn').notNull(),
  mrgnNm:     text('mrgn_nm').notNull(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull(),
})

// 日足株価 — /v2/equities/bars/daily
export const dailyPrices = pgTable('daily_prices', {
  code:      varchar('code', { length: 5 }).notNull(),
  date:      date('date').notNull(),
  open:      numeric('open'),
  high:      numeric('high'),
  low:       numeric('low'),
  close:     numeric('close'),
  volume:    numeric('volume'),      // Vo
  turnover:  numeric('turnover'),    // Va — 売買代金
  adjFactor: numeric('adj_factor'),
  adjOpen:   numeric('adj_open'),
  adjHigh:   numeric('adj_high'),
  adjLow:    numeric('adj_low'),
  adjClose:  numeric('adj_close'),
  adjVolume: numeric('adj_volume'),
}, (t) => [
  primaryKey({ columns: [t.code, t.date] }),
  index('idx_daily_prices_date').on(t.date),
])

// 財務情報 — /v2/fins/summary
export const financialSummary = pgTable('financial_summary', {
  code:        varchar('code', { length: 5 }).notNull(),
  discNo:      text('disc_no').notNull(),       // 開示番号 (DisclosureNumber)
  discDate:    date('disc_date'),
  docType:     text('doc_type'),                // DocType
  curPerType:  text('cur_per_type'),            // 1Q/2Q/3Q/4Q/FY
  sales:       numeric('sales'),
  op:          numeric('op'),                   // 営業利益
  np:          numeric('np'),                   // 当期純利益
  eps:         numeric('eps'),
  bps:         numeric('bps'),                  // NULL許容 (IFRS中間では空)
  equity:      numeric('equity'),               // Eq — 自己資本
  eqAr:        numeric('eq_ar'),                // 自己資本比率 (小数)
  totalAssets: numeric('total_assets'),
  cfo:         numeric('cfo'),                  // 営業CF
  cashEq:      numeric('cash_eq'),
  shOutFy:     numeric('sh_out_fy'),            // 発行済株式数
  trShFy:      numeric('tr_sh_fy'),             // 自己株式数
  divAnn:      numeric('div_ann'),              // 年間配当金 (確定)
  fSales:      numeric('f_sales'),              // 予想売上高
  fOp:         numeric('f_op'),                 // 予想営業利益
  fNp:         numeric('f_np'),                 // 予想当期純利益
  fEps:        numeric('f_eps'),                // 予想EPS
  fDivAnn:     numeric('f_div_ann'),            // 年間配当予想
}, (t) => [
  primaryKey({ columns: [t.code, t.discNo] }),
])
