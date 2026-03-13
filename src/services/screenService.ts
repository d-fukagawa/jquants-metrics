import { sql, SQL } from 'drizzle-orm'
import type { Db } from '../db/client'

export interface ScreenFilters {
  perMin?: number; perMax?: number
  pbrMin?: number; pbrMax?: number
  roeMin?: number; roeMax?: number
  divYieldMin?: number; divYieldMax?: number
  eqArMin?: number; eqArMax?: number  // input in % (0–100); stored as decimal
  psrMin?: number; psrMax?: number
  evEbitdaMin?: number; evEbitdaMax?: number
  evAdjustedEbitdaMin?: number; evAdjustedEbitdaMax?: number
  netCashRatioMin?: number; netCashRatioMax?: number
  profitOnly?: boolean
  cfoPositive?: boolean
  mkt?: string[]       // e.g. ['プライム', 'スタンダード']
  sector17?: string
  sort?: 'per_asc' | 'pbr_asc' | 'roe_desc' | 'div_yield_desc' | 'mktcap_desc' | 'ev_ebitda_asc'
  page?: number
}

export interface ScreenRow {
  code: string
  coName: string
  sector17Nm: string
  mktNm: string
  scaleCat: string
  mrgnNm: string
  close: number | null
  per: number | null
  pbr: number | null
  roe: number | null
  divYield: number | null
  eqAr: number | null   // decimal (0–1); multiply by 100 to get %
  psr: number | null
  evEbitda: number | null
  evAdjustedEbitda: number | null
  netCashRatio: number | null
}

export const PAGE_SIZE = 50

const ORDER_MAP: Record<string, string> = {
  per_asc:        'per ASC NULLS LAST',
  pbr_asc:        'pbr ASC NULLS LAST',
  roe_desc:       'roe DESC NULLS LAST',
  div_yield_desc: 'div_yield DESC NULLS LAST',
  mktcap_desc:    'mktcap DESC NULLS LAST',
  ev_ebitda_asc:  'ev_ebitda ASC NULLS LAST',
}

export async function screenStocks(
  db: Db,
  filters: ScreenFilters,
): Promise<{ rows: ScreenRow[]; total: number }> {
  const page   = Math.max(1, filters.page ?? 1)
  const offset = (page - 1) * PAGE_SIZE

  const conds: SQL[] = []

  function addRange(col: string, min?: number, max?: number) {
    const c = sql.raw(col)
    if (min != null) conds.push(sql`${c} >= ${min}`)
    if (max != null) conds.push(sql`${c} <= ${max}`)
  }

  addRange('per',            filters.perMin,          filters.perMax)
  addRange('pbr',            filters.pbrMin,          filters.pbrMax)
  addRange('roe',            filters.roeMin,          filters.roeMax)
  addRange('div_yield',      filters.divYieldMin,     filters.divYieldMax)
  addRange('psr',            filters.psrMin,          filters.psrMax)
  addRange('ev_ebitda',      filters.evEbitdaMin,     filters.evEbitdaMax)
  addRange('ev_adjusted_ebitda', filters.evAdjustedEbitdaMin, filters.evAdjustedEbitdaMax)
  addRange('net_cash_ratio', filters.netCashRatioMin, filters.netCashRatioMax)

  // eq_ar stored as decimal (0–1); convert user-input % to decimal
  if (filters.eqArMin != null) conds.push(sql`eq_ar >= ${filters.eqArMin / 100}`)
  if (filters.eqArMax != null) conds.push(sql`eq_ar <= ${filters.eqArMax / 100}`)

  if (filters.profitOnly)  conds.push(sql`np > 0`)
  if (filters.cfoPositive) conds.push(sql`cfo > 0`)

  if (filters.mkt && filters.mkt.length > 0) {
    const vals = sql.join(filters.mkt.map(m => sql`${m}`), sql`, `)
    conds.push(sql`mkt_nm = ANY(ARRAY[${vals}]::text[])`)
  }

  if (filters.sector17) {
    conds.push(sql`sector17_nm = ${filters.sector17}`)
  }

  const whereClause = conds.length > 0
    ? sql.join(conds, sql` AND `)
    : sql`TRUE`

  const orderClause = sql.raw(ORDER_MAP[filters.sort ?? ''] ?? ORDER_MAP.per_asc)

  const result = await db.execute(sql`
    WITH latest_price AS (
      SELECT DISTINCT ON (code) code, adj_close::float AS close
      FROM daily_prices
      WHERE adj_close IS NOT NULL
      ORDER BY code, date DESC
    ),
    latest_fin AS (
      SELECT DISTINCT ON (code)
        code,
        eps::float,
        bps::float,
        equity::float,
        np::float,
        eq_ar::float,
        div_ann::float,
        sales::float,
        sh_out_fy::float,
        cfo::float,
        op::float,
        cash_eq::float
      FROM financial_summary
      WHERE cur_per_type = 'FY'
      ORDER BY code, disc_date DESC
    ),
    latest_jquants_details AS (
      SELECT DISTINCT ON (code)
        code,
        debt_current::float AS debt_current,
        debt_non_curr::float AS debt_non_curr,
        dna::float
      FROM fins_details
      WHERE disc_no NOT LIKE 'EDINET:%'
      ORDER BY code, (dna IS NOT NULL) DESC, disc_date DESC
    ),
    latest_edinet_details AS (
      SELECT DISTINCT ON (code)
        code,
        debt_current::float AS debt_current,
        debt_non_curr::float AS debt_non_curr,
        dna::float
      FROM fins_details
      WHERE disc_no LIKE 'EDINET:%'
      ORDER BY code, disc_date DESC
    ),
    latest_details AS (
      SELECT
        COALESCE(j.code, e.code) AS code,
        COALESCE(j.debt_current, e.debt_current, 0) AS debt_current,
        COALESCE(j.debt_non_curr, e.debt_non_curr, 0) AS debt_non_curr,
        COALESCE(j.dna, e.dna) AS dna
      FROM latest_jquants_details j
      FULL OUTER JOIN latest_edinet_details e
        ON e.code = j.code
    ),
    latest_adjustment_disc AS (
      SELECT DISTINCT ON (code)
        code,
        disc_no
      FROM financial_adjustments
      ORDER BY
        code,
        (CASE WHEN source = 'fins_details.statement' THEN 0 ELSE 1 END) ASC,
        disc_date DESC
    ),
    adjustment_totals AS (
      SELECT
        fa.code,
        SUM(CASE WHEN fa.direction = 'addback' THEN fa.amount::float ELSE 0 END) AS addback_total,
        SUM(CASE WHEN fa.direction = 'deduction' THEN fa.amount::float ELSE 0 END) AS deduction_total
      FROM financial_adjustments fa
      JOIN latest_adjustment_disc lad
        ON lad.code = fa.code
       AND lad.disc_no = fa.disc_no
      GROUP BY fa.code
    ),
    computed AS (
      SELECT
        sm.code,
        sm.co_name,
        sm.sector17_nm,
        sm.mkt_nm,
        sm.scale_cat,
        sm.mrgn_nm,
        p.close,
        f.np,
        f.cfo,
        f.eq_ar,
        CASE WHEN f.eps > 0
          THEN ROUND((p.close / f.eps)::numeric, 1)::float
          ELSE NULL END AS per,
        CASE WHEN f.bps > 0
          THEN ROUND((p.close / f.bps)::numeric, 2)::float
             WHEN f.equity > 0 AND f.sh_out_fy > 0
          THEN ROUND((p.close / (f.equity / f.sh_out_fy))::numeric, 2)::float
          ELSE NULL END AS pbr,
        CASE WHEN f.equity > 0
          THEN ROUND((f.np / f.equity * 100)::numeric, 1)::float
          ELSE NULL END AS roe,
        CASE WHEN p.close > 0 AND f.div_ann > 0
          THEN ROUND((f.div_ann / p.close * 100)::numeric, 2)::float
          ELSE NULL END AS div_yield,
        CASE WHEN f.sales > 0 AND f.sh_out_fy > 0
          THEN ROUND((p.close * f.sh_out_fy / f.sales)::numeric, 2)::float
          ELSE NULL END AS psr,
        CASE WHEN f.sh_out_fy > 0
          THEN p.close * f.sh_out_fy
          ELSE NULL END AS mktcap,
        -- EV/EBITDA（fins_details が必要）
        CASE WHEN d.dna IS NOT NULL AND f.op IS NOT NULL AND (f.op + d.dna) > 0
              AND f.sh_out_fy > 0 AND f.cash_eq IS NOT NULL
          THEN ROUND((
            (p.close * f.sh_out_fy - (f.cash_eq - d.debt_current - d.debt_non_curr))
            / (f.op + d.dna)
          )::numeric, 1)::float
          ELSE NULL END AS ev_ebitda,
        -- EV/調整後EBITDA（financial_adjustments が必要）
        CASE WHEN d.dna IS NOT NULL AND f.op IS NOT NULL
              AND a.addback_total IS NOT NULL AND a.deduction_total IS NOT NULL
              AND (f.op + d.dna + a.addback_total - a.deduction_total) > 0
              AND f.sh_out_fy > 0 AND f.cash_eq IS NOT NULL
          THEN ROUND((
            (p.close * f.sh_out_fy - (f.cash_eq - d.debt_current - d.debt_non_curr))
            / (f.op + d.dna + a.addback_total - a.deduction_total)
          )::numeric, 1)::float
          ELSE NULL END AS ev_adjusted_ebitda,
        -- ネットキャッシュ比率 = (CashEq - 有利子負債) / 時価総額
        CASE WHEN f.cash_eq IS NOT NULL AND f.sh_out_fy > 0 AND p.close * f.sh_out_fy > 0
          THEN ROUND((
            (f.cash_eq - d.debt_current - d.debt_non_curr)
            / (p.close * f.sh_out_fy)
          )::numeric, 2)::float
          ELSE NULL END AS net_cash_ratio
      FROM stock_master sm
      JOIN latest_price   p ON p.code = sm.code
      JOIN latest_fin     f ON f.code = sm.code
      LEFT JOIN latest_details d ON d.code = sm.code
      LEFT JOIN adjustment_totals a ON a.code = sm.code
    )
    SELECT *, COUNT(*) OVER() AS total_count
    FROM computed
    WHERE ${whereClause}
    ORDER BY ${orderClause}
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `)

  const rawRows = result.rows as Record<string, unknown>[]

  const rows: ScreenRow[] = rawRows.map(r => ({
    code:         String(r.code        ?? ''),
    coName:       String(r.co_name     ?? ''),
    sector17Nm:   String(r.sector17_nm ?? ''),
    mktNm:        String(r.mkt_nm      ?? ''),
    scaleCat:     String(r.scale_cat   ?? ''),
    mrgnNm:       String(r.mrgn_nm     ?? ''),
    close:        r.close          != null ? Number(r.close)          : null,
    per:          r.per            != null ? Number(r.per)            : null,
    pbr:          r.pbr            != null ? Number(r.pbr)            : null,
    roe:          r.roe            != null ? Number(r.roe)            : null,
    divYield:     r.div_yield      != null ? Number(r.div_yield)      : null,
    eqAr:         r.eq_ar          != null ? Number(r.eq_ar)          : null,
    psr:          r.psr            != null ? Number(r.psr)            : null,
    evEbitda:     r.ev_ebitda      != null ? Number(r.ev_ebitda)      : null,
    evAdjustedEbitda: r.ev_adjusted_ebitda != null ? Number(r.ev_adjusted_ebitda) : null,
    netCashRatio: r.net_cash_ratio != null ? Number(r.net_cash_ratio) : null,
  }))

  const total = rawRows.length > 0 ? Number(rawRows[0].total_count ?? 0) : 0

  return { rows, total }
}
