/**
 * Phase A0 input audit (read-only).
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/audit-phase-a-inputs.ts
 */

import { sql, type SQL } from 'drizzle-orm'
import { createDb } from '../src/db/client'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is required')
  process.exit(1)
}

const db = createDb(databaseUrl)

function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (typeof value === 'bigint') return [key, Number(value)]
      if (!['code', 'mkt', 'prod_cat'].includes(key) && typeof value === 'string' && /^-?\d+$/.test(value)) {
        return [key, Number(value)]
      }
      return [key, value]
    }),
  ))
}

async function rows(query: SQL): Promise<Record<string, unknown>[]> {
  const result = await db.execute(query)
  return normalizeRows(result.rows as Record<string, unknown>[])
}

const overview = await rows(sql`
  WITH latest_fy AS (
    SELECT DISTINCT ON (code)
      code, cfo, cfi, cur_per_start, cur_per_end, disc_date
    FROM financial_summary
    WHERE cur_per_type = 'FY'
    ORDER BY code, cur_per_end DESC NULLS LAST, disc_date DESC NULLS LAST, disc_no DESC
  ), comparable_codes AS (
    SELECT DISTINCT current_row.code
    FROM financial_summary current_row
    WHERE current_row.cur_per_start IS NOT NULL
      AND current_row.cur_per_end IS NOT NULL
      AND current_row.cur_per_type IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM financial_summary prior_row
        WHERE prior_row.code = current_row.code
          AND prior_row.cur_per_type = current_row.cur_per_type
          AND prior_row.cur_per_start = (current_row.cur_per_start - INTERVAL '1 year')::date
          AND prior_row.cur_per_end = (current_row.cur_per_end - INTERVAL '1 year')::date
      )
  )
  SELECT
    (SELECT COUNT(*) FROM stock_master) AS stock_master_companies,
    (SELECT COUNT(*) FROM financial_summary) AS financial_rows,
    (SELECT COUNT(DISTINCT code) FROM financial_summary) AS financial_companies,
    (SELECT COUNT(*) FROM financial_summary WHERE cur_per_start IS NOT NULL AND cur_per_end IS NOT NULL) AS rows_with_period_dates,
    (SELECT COUNT(*) FROM financial_summary WHERE cfo IS NOT NULL) AS rows_with_cfo,
    (SELECT COUNT(*) FROM financial_summary WHERE cfi IS NOT NULL) AS rows_with_cfi,
    (SELECT COUNT(*) FROM latest_fy) AS companies_with_fy,
    (SELECT COUNT(*) FROM latest_fy WHERE cfo IS NOT NULL AND cfi IS NOT NULL) AS companies_with_latest_fy_fcf,
    (SELECT COUNT(*) FROM comparable_codes) AS companies_with_comparable_period_pair
`)

const invalidPeriods = await rows(sql`
  SELECT
    COUNT(*) FILTER (WHERE cur_per_start IS NOT NULL AND cur_per_end IS NOT NULL AND cur_per_start > cur_per_end) AS period_start_after_end,
    COUNT(*) FILTER (WHERE cur_fy_start IS NOT NULL AND cur_fy_end IS NOT NULL AND cur_fy_start > cur_fy_end) AS fiscal_year_start_after_end,
    COUNT(*) FILTER (
      WHERE cur_per_start IS NOT NULL AND cur_per_end IS NOT NULL
        AND cur_fy_start IS NOT NULL AND cur_fy_end IS NOT NULL
        AND (cur_per_start < cur_fy_start OR cur_per_end > cur_fy_end)
    ) AS period_outside_fiscal_year,
    COUNT(*) FILTER (WHERE code !~ '^[0-9A-Z]{5}$') AS invalid_stock_codes
  FROM financial_summary
`)

const flags = await rows(sql`
  SELECT
    COUNT(*) FILTER (WHERE material_change_subsidiaries IS TRUE) AS material_change_subsidiaries,
    COUNT(*) FILTER (WHERE significant_scope_change IS TRUE) AS significant_scope_change,
    COUNT(*) FILTER (WHERE retro_restatement IS TRUE) AS retro_restatement,
    COUNT(*) FILTER (WHERE changed_by_as_revision IS TRUE) AS changed_by_as_revision,
    COUNT(*) FILTER (WHERE changed_other_than_as_revision IS TRUE) AS changed_other_than_as_revision,
    COUNT(*) FILTER (WHERE changed_accounting_estimate IS TRUE) AS changed_accounting_estimate
  FROM financial_summary
`)

const productCategories = await rows(sql`
  SELECT
    COALESCE(prod_cat, '(null)') AS prod_cat,
    COUNT(*) AS companies,
    COUNT(*) FILTER (WHERE source_date IS NOT NULL) AS companies_with_source_date,
    COUNT(*) FILTER (
      WHERE mkt IN ('0111', '0112', '0113')
        AND prod_cat = '011'
        AND scale_cat NOT IN ('TOPIX Core30', 'TOPIX Large70')
    ) AS phase_a_universe_companies
  FROM stock_master
  GROUP BY prod_cat
  ORDER BY companies DESC, prod_cat
`)

const summaryColumnCoverage = await rows(sql`
  WITH classified AS (
    SELECT
      *,
      CASE
        WHEN doc_type LIKE '%NonConsolidated%' THEN 'non_consolidated'
        WHEN doc_type LIKE '%Consolidated%' THEN 'consolidated'
        ELSE 'unknown'
      END AS basis
    FROM financial_summary
  )
  SELECT
    basis,
    COUNT(*) AS rows,
    COUNT(*) FILTER (WHERE sales IS NOT NULL) AS rows_with_sales,
    COUNT(*) FILTER (WHERE nc_sales IS NOT NULL) AS rows_with_nc_sales,
    COUNT(*) FILTER (WHERE op IS NOT NULL) AS rows_with_op,
    COUNT(*) FILTER (WHERE nc_op IS NOT NULL) AS rows_with_nc_op,
    COUNT(*) FILTER (WHERE shareholders_equity IS NOT NULL) AS rows_with_shareholders_equity,
    COUNT(*) FILTER (WHERE nc_shareholders_equity IS NOT NULL) AS rows_with_nc_shareholders_equity,
    COUNT(*) FILTER (
      WHERE CASE WHEN basis = 'non_consolidated' THEN COALESCE(nc_sales, sales) IS NOT NULL ELSE sales IS NOT NULL END
    ) AS rows_with_canonical_sales,
    COUNT(*) FILTER (
      WHERE CASE WHEN basis = 'non_consolidated' THEN COALESCE(nc_op, op) IS NOT NULL ELSE op IS NOT NULL END
    ) AS rows_with_canonical_op,
    COUNT(*) FILTER (
      WHERE CASE
        WHEN basis = 'non_consolidated'
          THEN COALESCE(nc_shareholders_equity, shareholders_equity, nc_equity, equity) IS NOT NULL
        ELSE COALESCE(shareholders_equity, equity) IS NOT NULL
      END
    ) AS rows_with_canonical_shareholders_equity,
    COUNT(*) FILTER (
      WHERE CASE WHEN basis = 'non_consolidated' THEN COALESCE(nc_eq_ar, eq_ar) IS NOT NULL ELSE eq_ar IS NOT NULL END
    ) AS rows_with_canonical_equity_ratio
  FROM classified
  GROUP BY basis
  ORDER BY basis
`)

const equitySemantics = await rows(sql`
  SELECT
    COUNT(*) FILTER (WHERE equity IS NOT NULL) AS rows_with_equity,
    COUNT(*) FILTER (WHERE shareholders_equity IS NOT NULL) AS rows_with_shareholders_equity,
    COUNT(*) FILTER (WHERE equity IS NOT NULL AND shareholders_equity IS NOT NULL) AS rows_with_both,
    COUNT(*) FILTER (
      WHERE equity IS NOT NULL AND shareholders_equity IS NOT NULL
        AND equity <> shareholders_equity
    ) AS differing_rows,
    MIN(ABS(equity - shareholders_equity)) FILTER (
      WHERE equity IS NOT NULL AND shareholders_equity IS NOT NULL
        AND equity <> shareholders_equity
    ) AS minimum_absolute_difference,
    MAX(ABS(equity - shareholders_equity)) FILTER (
      WHERE equity IS NOT NULL AND shareholders_equity IS NOT NULL
        AND equity <> shareholders_equity
    ) AS maximum_absolute_difference
  FROM financial_summary
`)

const detailsCoverage = await rows(sql`
  SELECT
    COUNT(*) AS rows,
    COUNT(*) FILTER (WHERE disc_time IS NOT NULL) AS rows_with_disc_time,
    COUNT(*) FILTER (WHERE cur_per_type IS NOT NULL) AS rows_with_period_type,
    COUNT(*) FILTER (WHERE disc_no NOT LIKE 'EDINET:%') AS jquants_rows,
    COUNT(*) FILTER (WHERE disc_no LIKE 'EDINET:%') AS edinet_rows
  FROM fins_details
`)

const pilotCompanies = await rows(sql`
  SELECT
    code,
    COUNT(*) AS rows,
    COUNT(*) FILTER (WHERE cur_per_start IS NOT NULL AND cur_per_end IS NOT NULL) AS rows_with_period_dates,
    COUNT(*) FILTER (WHERE cfo IS NOT NULL) AS rows_with_cfo,
    COUNT(*) FILTER (WHERE cfi IS NOT NULL) AS rows_with_cfi,
    COUNT(*) FILTER (WHERE cff IS NOT NULL) AS rows_with_cff,
    COUNT(*) FILTER (WHERE retro_restatement IS NOT NULL) AS rows_with_restatement_flag,
    MAX(disc_date) AS latest_disclosure_date
  FROM financial_summary
  WHERE code IN ('70650', '62870')
  GROUP BY code
  ORDER BY code
`)

const byMarket = await rows(sql`
  WITH financial_codes AS (
    SELECT
      code,
      BOOL_OR(cur_per_start IS NOT NULL AND cur_per_end IS NOT NULL) AS has_period_dates,
      BOOL_OR(cur_per_type = 'FY' AND cfo IS NOT NULL AND cfi IS NOT NULL) AS has_fy_fcf
    FROM financial_summary
    GROUP BY code
  )
  SELECT
    stock_master.mkt,
    stock_master.mkt_nm,
    stock_master.scale_cat,
    COUNT(*) AS companies,
    COUNT(financial_codes.code) AS companies_with_financials,
    COUNT(*) FILTER (WHERE financial_codes.has_period_dates) AS companies_with_period_dates,
    COUNT(*) FILTER (WHERE financial_codes.has_fy_fcf) AS companies_with_fy_fcf
  FROM stock_master
  LEFT JOIN financial_codes ON financial_codes.code = stock_master.code
  GROUP BY stock_master.mkt, stock_master.mkt_nm, stock_master.scale_cat
  ORDER BY stock_master.mkt, stock_master.scale_cat
`)

const byDocumentType = await rows(sql`
  SELECT
    COALESCE(doc_type, '(null)') AS doc_type,
    COALESCE(cur_per_type, '(null)') AS cur_per_type,
    COUNT(*) AS rows,
    COUNT(*) FILTER (WHERE cur_per_start IS NOT NULL AND cur_per_end IS NOT NULL) AS rows_with_period_dates,
    COUNT(*) FILTER (WHERE cfo IS NOT NULL) AS rows_with_cfo,
    COUNT(*) FILTER (WHERE cfi IS NOT NULL) AS rows_with_cfi
  FROM financial_summary
  GROUP BY doc_type, cur_per_type
  ORDER BY rows DESC, doc_type, cur_per_type
`)

const edinetBridge = await rows(sql`
  SELECT
    COALESCE(accounting_standard, '(null)') AS accounting_standard,
    COALESCE(basis, '(null)') AS basis,
    COUNT(*) AS rows,
    COUNT(DISTINCT code) AS companies,
    COUNT(*) FILTER (WHERE operating_profit IS NOT NULL) AS rows_with_operating_profit,
    COUNT(*) FILTER (WHERE cfo IS NOT NULL) AS rows_with_cfo,
    COUNT(*) FILTER (WHERE cfi IS NOT NULL) AS rows_with_cfi,
    COUNT(*) FILTER (WHERE capex IS NOT NULL) AS rows_with_capex,
    COUNT(*) FILTER (WHERE submitted_at IS NOT NULL) AS rows_with_submitted_at
  FROM edinet_bridge_facts
  GROUP BY accounting_standard, basis
  ORDER BY rows DESC, accounting_standard, basis
`)

const crossSourceComparison = await rows(sql`
  WITH latest_jquants_fy AS (
    SELECT DISTINCT ON (code, EXTRACT(YEAR FROM cur_fy_end))
      code,
      EXTRACT(YEAR FROM cur_fy_end)::text AS fiscal_year,
      doc_type,
      cfo,
      cfi
    FROM financial_summary
    WHERE cur_per_type = 'FY'
      AND cur_fy_end IS NOT NULL
      AND doc_type LIKE 'FYFinancialStatements%'
    ORDER BY code, EXTRACT(YEAR FROM cur_fy_end), disc_date DESC NULLS LAST, disc_no DESC
  ), compared AS (
    SELECT
      edinet_bridge_facts.code,
      edinet_bridge_facts.fiscal_year,
      edinet_bridge_facts.cfo AS edinet_cfo,
      edinet_bridge_facts.cfi AS edinet_cfi,
      latest_jquants_fy.cfo AS jquants_cfo,
      latest_jquants_fy.cfi AS jquants_cfi
    FROM edinet_bridge_facts
    LEFT JOIN latest_jquants_fy
      ON latest_jquants_fy.code = edinet_bridge_facts.code
      AND latest_jquants_fy.fiscal_year = LEFT(edinet_bridge_facts.fiscal_year, 4)
      AND (
        (edinet_bridge_facts.basis = 'consolidated'
          AND latest_jquants_fy.doc_type LIKE '%Consolidated%'
          AND latest_jquants_fy.doc_type NOT LIKE '%NonConsolidated%')
        OR (edinet_bridge_facts.basis = 'standalone' AND latest_jquants_fy.doc_type LIKE '%NonConsolidated%')
        OR edinet_bridge_facts.basis IS NULL
      )
    WHERE edinet_bridge_facts.cfo IS NOT NULL OR edinet_bridge_facts.cfi IS NOT NULL
  )
  SELECT
    COUNT(*) AS edinet_rows,
    COUNT(*) FILTER (WHERE jquants_cfo IS NOT NULL OR jquants_cfi IS NOT NULL) AS matched_rows,
    COUNT(*) FILTER (
      WHERE edinet_cfo IS NOT NULL AND jquants_cfo IS NOT NULL AND edinet_cfo = jquants_cfo
    ) AS exact_cfo_rows,
    COUNT(*) FILTER (
      WHERE edinet_cfi IS NOT NULL AND jquants_cfi IS NOT NULL AND edinet_cfi = jquants_cfi
    ) AS exact_cfi_rows,
    COUNT(*) FILTER (
      WHERE edinet_cfo IS NOT NULL AND jquants_cfo IS NOT NULL
        AND ABS(edinet_cfo - jquants_cfo) <= GREATEST(1000000, ABS(edinet_cfo) * 0.001)
    ) AS within_tolerance_cfo_rows,
    COUNT(*) FILTER (
      WHERE edinet_cfi IS NOT NULL AND jquants_cfi IS NOT NULL
        AND ABS(edinet_cfi - jquants_cfi) <= GREATEST(1000000, ABS(edinet_cfi) * 0.001)
    ) AS within_tolerance_cfi_rows,
    COUNT(*) FILTER (
      WHERE jquants_cfo IS NOT NULL AND edinet_cfo IS NOT NULL AND jquants_cfo <> edinet_cfo
    ) AS differing_cfo_rows,
    COUNT(*) FILTER (
      WHERE jquants_cfi IS NOT NULL AND edinet_cfi IS NOT NULL AND jquants_cfi <> edinet_cfi
    ) AS differing_cfi_rows
  FROM compared
`)

const recentSyncErrors = await rows(sql`
  SELECT
    target,
    COUNT(*) FILTER (WHERE success IS FALSE) AS failed_runs,
    COUNT(*) FILTER (
      WHERE http_429_count > 0 OR error_message LIKE '%error 429%'
    ) AS rate_limited_runs,
    COUNT(*) FILTER (
      WHERE http_5xx_count > 0 OR error_message ~ 'error 5[0-9][0-9]'
    ) AS server_error_runs,
    MAX(started_at) AS latest_started_at
  FROM edinet_sync_runs
  WHERE started_at >= NOW() - INTERVAL '30 days'
  GROUP BY target
  ORDER BY target
`)

const recentSyncErrorReasons = await rows(sql`
  SELECT
    target,
    COALESCE(NULLIF(error_message, ''), '(unknown)') AS error_message,
    COUNT(*) AS failed_runs,
    MAX(started_at) AS latest_started_at
  FROM edinet_sync_runs
  WHERE started_at >= NOW() - INTERVAL '30 days'
    AND success IS FALSE
  GROUP BY target, COALESCE(NULLIF(error_message, ''), '(unknown)')
  ORDER BY failed_runs DESC, target, error_message
`)

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  overview: overview[0] ?? {},
  invalidPeriods: invalidPeriods[0] ?? {},
  flags: flags[0] ?? {},
  productCategories,
  summaryColumnCoverage,
  equitySemantics: equitySemantics[0] ?? {},
  detailsCoverage: detailsCoverage[0] ?? {},
  pilotCompanies,
  byMarket,
  byDocumentType,
  edinetBridge,
  crossSourceComparison: crossSourceComparison[0] ?? {},
  recentSyncErrors,
  recentSyncErrorReasons,
}, null, 2))
