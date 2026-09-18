import { describe, expect, it } from 'vitest'
import { parseFinancialDocumentType, selectCanonicalFinancialFields } from './financialFields'

const base = {
  docType: 'FYFinancialStatements_Consolidated_JP',
  sales: '100', op: '10', np: '8', eps: '4', bps: '50', totalAssets: '200',
  equity: '90', shareholdersEquity: '80', eqAr: '0.4',
  fSales: '110', fOp: '11', fNp: '9', fEps: '4.5',
  ncSales: '70', ncOp: '7', ncNp: '5', ncEps: '2.5', ncBps: '30',
  ncTotalAssets: '120', ncEquity: '55', ncShareholdersEquity: '50', ncEqAr: '0.42',
  fNcSales: '75', fNcOp: '8', fNcNp: '6', fNcEps: '3',
}

describe('parseFinancialDocumentType', () => {
  it('parses basis and accounting standard without confusing NonConsolidated with Consolidated', () => {
    expect(parseFinancialDocumentType('FYFinancialStatements_NonConsolidated_IFRS')).toEqual({
      basis: 'non_consolidated',
      accountingStandard: 'IFRS',
      isFinancialStatement: true,
    })
  })

  it('keeps revision documents basis unknown', () => {
    expect(parseFinancialDocumentType('EarnForecastRevision').basis).toBe('unknown')
  })
})

describe('selectCanonicalFinancialFields', () => {
  it('selects consolidated values and prefers ShEq over Eq', () => {
    const selected = selectCanonicalFinancialFields(base)
    expect(selected.sales).toBe('100')
    expect(selected.shareholdersEquity).toBe('80')
    expect(selected.sourceFields.shareholdersEquity).toBe('ShEq')
  })

  it('prefers NC values for a non-consolidated statement when supplied', () => {
    const selected = selectCanonicalFinancialFields({
      ...base,
      docType: 'FYFinancialStatements_NonConsolidated_JP',
      ncSales: null,
    })
    expect(selected.sales).toBe('100')
    expect(selected.operatingProfit).toBe('7')
    expect(selected.shareholdersEquity).toBe('50')
    expect(selected.sourceFields.sales).toBe('Sales')
  })

  it('uses the document primary values when NC supplemental fields are absent', () => {
    const selected = selectCanonicalFinancialFields({
      ...base,
      docType: 'FYFinancialStatements_NonConsolidated_JP',
      ncSales: null,
      ncOp: null,
      ncNp: null,
      ncEps: null,
      ncBps: null,
      ncTotalAssets: null,
      ncEquity: null,
      ncShareholdersEquity: null,
      ncEqAr: null,
      fNcSales: null,
      fNcOp: null,
      fNcNp: null,
      fNcEps: null,
    })
    expect(selected.sales).toBe('100')
    expect(selected.operatingProfit).toBe('10')
    expect(selected.shareholdersEquity).toBe('80')
    expect(selected.sourceFields.shareholdersEquity).toBe('ShEq')
  })

  it('falls back from ShEq to Eq within the same basis', () => {
    const selected = selectCanonicalFinancialFields({ ...base, shareholdersEquity: null })
    expect(selected.shareholdersEquity).toBe('90')
    expect(selected.sourceFields.shareholdersEquity).toBe('Eq')
  })
})
