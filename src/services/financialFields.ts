export type FinancialBasis = 'consolidated' | 'non_consolidated' | 'unknown'
export type FinancialAccountingStandard = 'JP' | 'IFRS' | 'US' | 'JMIS' | 'Foreign' | 'REIT' | 'unknown'

type Value = string | null | undefined

export interface FinancialFieldInput {
  docType: string | null
  sales: Value
  op: Value
  np: Value
  eps: Value
  bps: Value
  totalAssets: Value
  equity: Value
  shareholdersEquity: Value
  eqAr: Value
  fSales: Value
  fOp: Value
  fNp: Value
  fEps: Value
  ncSales: Value
  ncOp: Value
  ncNp: Value
  ncEps: Value
  ncBps: Value
  ncTotalAssets: Value
  ncEquity: Value
  ncShareholdersEquity: Value
  ncEqAr: Value
  fNcSales: Value
  fNcOp: Value
  fNcNp: Value
  fNcEps: Value
}

export interface ParsedFinancialDocumentType {
  basis: FinancialBasis
  accountingStandard: FinancialAccountingStandard
  isFinancialStatement: boolean
}

export function parseFinancialDocumentType(docType: string | null | undefined): ParsedFinancialDocumentType {
  const value = docType ?? ''
  const basis: FinancialBasis = value.includes('_NonConsolidated_')
    ? 'non_consolidated'
    : value.includes('_Consolidated_')
      ? 'consolidated'
      : 'unknown'

  const accountingStandard: FinancialAccountingStandard = value.endsWith('_IFRS')
    ? 'IFRS'
    : value.endsWith('_US')
      ? 'US'
      : value.endsWith('_JMIS')
        ? 'JMIS'
        : value.endsWith('_Foreign')
          ? 'Foreign'
          : value.endsWith('_REIT')
            ? 'REIT'
            : value.endsWith('_JP')
              ? 'JP'
              : 'unknown'

  return {
    basis,
    accountingStandard,
    isFinancialStatement: value.includes('FinancialStatements_'),
  }
}

export interface CanonicalFinancialFields {
  basis: FinancialBasis
  accountingStandard: FinancialAccountingStandard
  sales: Value
  operatingProfit: Value
  netProfit: Value
  eps: Value
  bps: Value
  totalAssets: Value
  shareholdersEquity: Value
  equityRatio: Value
  forecastSales: Value
  forecastOperatingProfit: Value
  forecastNetProfit: Value
  forecastEps: Value
  sourceFields: Record<string, string>
}

function firstPresent(
  ...candidates: Array<{ name: string; value: Value }>
): { name: string; value: Value } {
  return candidates.find(candidate => candidate.value != null && candidate.value !== '')
    ?? candidates[0]!
}

export function selectCanonicalFinancialFields(row: FinancialFieldInput): CanonicalFinancialFields {
  const parsed = parseFinancialDocumentType(row.docType)
  const isNonConsolidated = parsed.basis === 'non_consolidated'

  const selected = isNonConsolidated
    ? {
        sales: firstPresent(
          { name: 'NCSales', value: row.ncSales },
          { name: 'Sales', value: row.sales },
        ),
        operatingProfit: firstPresent(
          { name: 'NCOP', value: row.ncOp },
          { name: 'OP', value: row.op },
        ),
        netProfit: firstPresent(
          { name: 'NCNP', value: row.ncNp },
          { name: 'NP', value: row.np },
        ),
        eps: firstPresent(
          { name: 'NCEPS', value: row.ncEps },
          { name: 'EPS', value: row.eps },
        ),
        bps: firstPresent(
          { name: 'NCBPS', value: row.ncBps },
          { name: 'BPS', value: row.bps },
        ),
        totalAssets: firstPresent(
          { name: 'NCTA', value: row.ncTotalAssets },
          { name: 'TA', value: row.totalAssets },
        ),
        shareholdersEquity: firstPresent(
          { name: 'NCShEq', value: row.ncShareholdersEquity },
          { name: 'ShEq', value: row.shareholdersEquity },
          { name: 'NCEq', value: row.ncEquity },
          { name: 'Eq', value: row.equity },
        ),
        equityRatio: firstPresent(
          { name: 'NCEqAR', value: row.ncEqAr },
          { name: 'EqAR', value: row.eqAr },
        ),
        forecastSales: firstPresent(
          { name: 'FNCSales', value: row.fNcSales },
          { name: 'FSales', value: row.fSales },
        ),
        forecastOperatingProfit: firstPresent(
          { name: 'FNCOP', value: row.fNcOp },
          { name: 'FOP', value: row.fOp },
        ),
        forecastNetProfit: firstPresent(
          { name: 'FNCNP', value: row.fNcNp },
          { name: 'FNP', value: row.fNp },
        ),
        forecastEps: firstPresent(
          { name: 'FNCEPS', value: row.fNcEps },
          { name: 'FEPS', value: row.fEps },
        ),
      }
    : {
        sales: { name: 'Sales', value: row.sales },
        operatingProfit: { name: 'OP', value: row.op },
        netProfit: { name: 'NP', value: row.np },
        eps: { name: 'EPS', value: row.eps },
        bps: { name: 'BPS', value: row.bps },
        totalAssets: { name: 'TA', value: row.totalAssets },
        shareholdersEquity: firstPresent(
          { name: 'ShEq', value: row.shareholdersEquity },
          { name: 'Eq', value: row.equity },
        ),
        equityRatio: { name: 'EqAR', value: row.eqAr },
        forecastSales: { name: 'FSales', value: row.fSales },
        forecastOperatingProfit: { name: 'FOP', value: row.fOp },
        forecastNetProfit: { name: 'FNP', value: row.fNp },
        forecastEps: { name: 'FEPS', value: row.fEps },
      }

  return {
    basis: parsed.basis,
    accountingStandard: parsed.accountingStandard,
    sales: selected.sales.value,
    operatingProfit: selected.operatingProfit.value,
    netProfit: selected.netProfit.value,
    eps: selected.eps.value,
    bps: selected.bps.value,
    totalAssets: selected.totalAssets.value,
    shareholdersEquity: selected.shareholdersEquity.value,
    equityRatio: selected.equityRatio.value,
    forecastSales: selected.forecastSales.value,
    forecastOperatingProfit: selected.forecastOperatingProfit.value,
    forecastNetProfit: selected.forecastNetProfit.value,
    forecastEps: selected.forecastEps.value,
    sourceFields: Object.fromEntries(
      Object.entries(selected).map(([key, field]) => [key, field.name]),
    ),
  }
}
