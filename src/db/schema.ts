import { pgTable, varchar, text, numeric, date, timestamp, primaryKey, index, integer, jsonb, boolean } from 'drizzle-orm/pg-core'

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

// 詳細財務情報 — /v2/fins/details（高度指標: EV/EBITDA, ROIC, ネットキャッシュ）
export const finsDetails = pgTable('fins_details', {
  code:         varchar('code', { length: 5 }).notNull(),
  discNo:       text('disc_no').notNull(),       // DisclosureNumber
  discDate:     date('disc_date'),
  docType:      text('doc_type'),
  curPerType:   text('cur_per_type'),
  debtCurrent:  numeric('debt_current'),         // 有利子負債_流動
  debtNonCurr:  numeric('debt_non_curr'),        // 有利子負債_非流動
  dna:          numeric('dna'),                  // 減価償却費・償却費（D&A）
  pretaxProfit: numeric('pretax_profit'),        // 税引前利益
  taxExpense:   numeric('tax_expense'),          // 法人税等
}, (t) => [
  primaryKey({ columns: [t.code, t.discNo] }),
  index('idx_fins_details_disc_date').on(t.discDate),
])

// 調整項目 — 調整後EBITDA（model）算出用の候補項目
export const financialAdjustments = pgTable('financial_adjustments', {
  code:      varchar('code', { length: 5 }).notNull(),
  discNo:    text('disc_no').notNull(),
  discDate:  date('disc_date'),
  itemKey:   text('item_key').notNull(),                 // XBRL Statement key
  amount:    numeric('amount').notNull(),                // 金額（円）
  direction: text('direction').notNull(),                // addback | deduction
  category:  text('category').notNull(),                 // impairment | restructuring | gain | one_off
  source:    text('source').notNull(),                   // fins_details.statement
}, (t) => [
  primaryKey({ columns: [t.code, t.discNo, t.itemKey, t.direction] }),
  index('idx_financial_adjustments_disc_date').on(t.discDate),
  index('idx_financial_adjustments_code').on(t.code),
])

// EDINET 企業コードマッピング
export const edinetCompanyMap = pgTable('edinet_company_map', {
  code:       varchar('code', { length: 5 }).primaryKey(),
  edinetCode: text('edinet_code').notNull(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('idx_edinet_company_map_edinet_code').on(t.edinetCode),
])

// EDINET 開示履歴（タイムライン）
export const edinetFilings = pgTable('edinet_filings', {
  edinetCode:    text('edinet_code').notNull(),
  docId:         text('doc_id').notNull(),
  code:          varchar('code', { length: 5 }),
  filingDate:    date('filing_date').notNull(),
  eventType:     text('event_type').notNull(),
  title:         text('title').notNull(),
  isAmendment:   boolean('is_amendment').notNull().default(false),
  submittedAt:   timestamp('submitted_at', { withTimezone: true }),
  sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
}, (t) => [
  primaryKey({ columns: [t.edinetCode, t.docId] }),
  index('idx_edinet_filings_code_date').on(t.code, t.filingDate),
  index('idx_edinet_filings_date').on(t.filingDate),
  index('idx_edinet_filings_event_type').on(t.eventType),
])

// EDINET 会社予想スナップショット（来期 / 再来期）
export const edinetForecasts = pgTable('edinet_forecasts', {
  code:         varchar('code', { length: 5 }).notNull(),
  edinetCode:   text('edinet_code').notNull(),
  fiscalYear:   text('fiscal_year').notNull(),
  horizon:      text('horizon').notNull(), // next | next2
  salesForecast: numeric('sales_forecast'),
  opForecast:    numeric('op_forecast'),
  npForecast:    numeric('np_forecast'),
  epsForecast:   numeric('eps_forecast'),
  disclosedAt:   date('disclosed_at'),
  sourceDocId:   text('source_doc_id'),
  updatedAt:     timestamp('updated_at', { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.code, t.horizon, t.fiscalYear] }),
  index('idx_edinet_forecasts_code').on(t.code),
  index('idx_edinet_forecasts_disclosed_at').on(t.disclosedAt),
])

// EDINET 会計調整ブリッジ算出用の要素
export const edinetBridgeFacts = pgTable('edinet_bridge_facts', {
  code:         varchar('code', { length: 5 }).notNull(),
  edinetCode:   text('edinet_code').notNull(),
  fiscalYear:   text('fiscal_year').notNull(),
  periodType:   text('period_type').notNull(), // FY / 1Q / ...
  operatingProfit: numeric('operating_profit'),
  pretaxProfit:    numeric('pretax_profit'),
  netProfit:       numeric('net_profit'),
  cfo:             numeric('cfo'),
  depreciation:    numeric('depreciation'),
  adjustmentItemsJson: jsonb('adjustment_items_json'),
  disclosedAt:     date('disclosed_at'),
  sourceDocId:     text('source_doc_id'),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.code, t.fiscalYear, t.periodType] }),
  index('idx_edinet_bridge_facts_code').on(t.code),
  index('idx_edinet_bridge_facts_disclosed_at').on(t.disclosedAt),
])

// EDINET 会計品質スコア
export const edinetQualityScores = pgTable('edinet_quality_scores', {
  code:           varchar('code', { length: 5 }).notNull(),
  asOfDate:       date('as_of_date').notNull(),
  qualityScore:   integer('quality_score').notNull(), // 0..100
  componentsJson: jsonb('components_json').notNull(),
  formulaText:    text('formula_text').notNull(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.code, t.asOfDate] }),
  index('idx_edinet_quality_scores_code').on(t.code),
])

// EDINET テキスト異常スコア
export const edinetTextScores = pgTable('edinet_text_scores', {
  code:           varchar('code', { length: 5 }).notNull(),
  asOfDate:       date('as_of_date').notNull(),
  anomalyScore:   integer('anomaly_score').notNull(), // 0..100
  componentsJson: jsonb('components_json').notNull(),
  formulaText:    text('formula_text').notNull(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.code, t.asOfDate] }),
  index('idx_edinet_text_scores_code').on(t.code),
])

// EDINET 同期実行ログ（監視）
export const edinetSyncRuns = pgTable('edinet_sync_runs', {
  runId:         text('run_id').primaryKey(),
  target:        text('target').notNull(),
  startedAt:     timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt:       timestamp('ended_at', { withTimezone: true }),
  success:       boolean('success').notNull(),
  http429Count:  integer('http_429_count').notNull().default(0),
  http5xxCount:  integer('http_5xx_count').notNull().default(0),
  rowsSynced:    integer('rows_synced').notNull().default(0),
  errorMessage:  text('error_message'),
}, (t) => [
  index('idx_edinet_sync_runs_target_started').on(t.target, t.startedAt),
])

// 銘柄メモメタ（単一ユーザー前提）
export const stockMemoMeta = pgTable('stock_memo_meta', {
  code:      varchar('code', { length: 5 }).primaryKey(),
  isWatched: boolean('is_watched').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('idx_stock_memo_meta_watched').on(t.isWatched),
  index('idx_stock_memo_meta_updated_at').on(t.updatedAt),
])

// 銘柄メモ本体（1銘柄に複数メモ）
export const stockMemos = pgTable('stock_memos', {
  id:        text('id').primaryKey(),
  code:      varchar('code', { length: 5 }).notNull(),
  body:      text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('idx_stock_memos_code').on(t.code),
  index('idx_stock_memos_updated_at').on(t.updatedAt),
])

// テーマ本体（単一ユーザー前提）
export const themes = pgTable('themes', {
  id:        text('id').primaryKey(),
  name:      text('name').notNull(),
  memo:      text('memo').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}, (t) => [
  index('idx_themes_updated_at').on(t.updatedAt),
])

// テーマ内の銘柄（順序あり）
export const themeStocks = pgTable('theme_stocks', {
  themeId:   text('theme_id').notNull(),
  code:      varchar('code', { length: 5 }).notNull(),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.themeId, t.code] }),
  index('idx_theme_stocks_theme_sort').on(t.themeId, t.sortOrder),
  index('idx_theme_stocks_code').on(t.code),
])
