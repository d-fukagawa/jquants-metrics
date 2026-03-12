export interface EdinetSearchCompany {
  edinetCode: string
  code?: string | null
  name?: string | null
}

export interface EdinetFiling {
  edinetCode: string
  docId: string
  code?: string | null
  filingDate: string
  eventType: string
  title: string
  isAmendment?: boolean
  submittedAt?: string | null
}

export interface EdinetForecast {
  edinetCode: string
  code?: string | null
  fiscalYear: string
  horizon: 'next' | 'next2'
  salesForecast?: string | null
  opForecast?: string | null
  npForecast?: string | null
  epsForecast?: string | null
  disclosedAt?: string | null
  sourceDocId?: string | null
}

export interface EdinetBridgeFact {
  edinetCode: string
  code?: string | null
  fiscalYear: string
  periodType: string
  operatingProfit?: string | null
  pretaxProfit?: string | null
  netProfit?: string | null
  cfo?: string | null
  depreciation?: string | null
  disclosedAt?: string | null
  sourceDocId?: string | null
  adjustmentItems?: Record<string, unknown> | null
}

export interface EdinetScore {
  code: string
  asOfDate: string
  score: number
  formulaText: string
  components: Record<string, unknown>
}

