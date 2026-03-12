import type { EdinetBridgeFact, EdinetFiling, EdinetForecast, EdinetScore, EdinetSearchCompany } from './types'

const BASE_URL = 'https://edinetdb.jp/v1'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

function pickArray(data: unknown): any[] {
  if (Array.isArray(data)) return data
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  for (const key of ['data', 'results', 'items', 'companies', 'filings', 'forecasts']) {
    const v = obj[key]
    if (Array.isArray(v)) return v as any[]
    if (v && typeof v === 'object') return [v as any]
  }
  return []
}

async function getJson(apiKey: string, path: string, params?: Record<string, string>, retries = 2): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }

  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': apiKey },
  })

  if (res.status === 429 && retries > 0) {
    await sleep(1500)
    return getJson(apiKey, path, params, retries - 1)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`EDINETDB API error ${res.status}: ${text}`)
  }
  return res.json()
}

function toStr(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

export async function searchCompanyByCode(apiKey: string, code4: string): Promise<EdinetSearchCompany[]> {
  const raw = await getJson(apiKey, '/search', { q: code4 })
  const rows = pickArray(raw)
  return rows.map((r: Record<string, unknown>) => ({
    edinetCode: toStr(r.edinetCode ?? r.edinet_code ?? r.EDINETCode) ?? '',
    code: toStr(r.code ?? r.sec_code ?? r.localCode ?? r.LocalCode),
    name: toStr(r.name ?? r.companyName ?? r.CompanyName),
  })).filter(r => r.edinetCode)
}

export async function fetchCompanyFilings(apiKey: string, edinetCode: string, from?: string, to?: string): Promise<EdinetFiling[]> {
  const raw = await getJson(apiKey, `/companies/${edinetCode}/earnings`)
  const outer = pickArray(raw)
  const events = outer.flatMap((x: Record<string, unknown>) =>
    Array.isArray(x.earnings) ? x.earnings as Record<string, unknown>[] : [],
  )

  const rows = events.map((r: Record<string, unknown>, idx) => {
    const dateRaw = toStr(r.disclosure_date ?? r.disclosureDate)
    const filingDate = dateRaw ? new Date(dateRaw).toISOString().slice(0, 10) : ''
    const quarter = toStr(r.quarter) ?? 'N/A'
    const fyEnd = toStr(r.fiscal_year_end ?? r.fiscalYearEnd) ?? ''
    return {
      edinetCode,
      docId: toStr(r.doc_id ?? r.docId ?? r.pdf_url) ?? `${edinetCode}-${filingDate}-${idx}`,
      code: null,
      filingDate,
      eventType: `決算短信(Q${quarter})`,
      title: toStr(r.title) ?? `決算短信 ${fyEnd}`,
      isAmendment: Boolean(r.is_correction ?? r.isCorrection ?? false),
      submittedAt: null,
    }
  }).filter(r => {
    if (!r.filingDate) return false
    if (from && r.filingDate < from) return false
    if (to && r.filingDate > to) return false
    return true
  })
  return rows
}

export async function fetchCompanyForecasts(apiKey: string, edinetCode: string): Promise<EdinetForecast[]> {
  // Current EDINETDB API does not provide structured "next/next2 company forecast" fields.
  // Keep this function stable and return an empty list to avoid false data.
  const raw = await getJson(apiKey, `/companies/${edinetCode}/earnings`)
  const rows = pickArray(raw)
  if (rows.length === 0) return []
  return []
}

export async function fetchCompanyBridgeFacts(apiKey: string, edinetCode: string): Promise<EdinetBridgeFact[]> {
  const raw = await getJson(apiKey, `/companies/${edinetCode}/financials`)
  const rows = pickArray(raw)
  return rows.map((r: Record<string, unknown>) => ({
    edinetCode,
    code: toStr(r.code ?? r.localCode ?? r.LocalCode),
    fiscalYear: toStr(r.fiscalYear ?? r.fiscal_year ?? r.periodEnd) ?? '',
    periodType: toStr(r.periodType ?? r.period_type ?? r.period) ?? 'FY',
    operatingProfit: toStr(r.operatingProfit ?? r.op ?? r.operating_profit ?? r.ordinary_income),
    pretaxProfit: toStr(r.pretaxProfit ?? r.pretax_profit ?? r.profit_before_tax),
    netProfit: toStr(r.netProfit ?? r.np ?? r.net_profit ?? r.net_income),
    cfo: toStr(r.cfo ?? r.cashflowOperating ?? r.operating_cf ?? r.cf_operating),
    depreciation: toStr(r.depreciation ?? r.dna ?? r.depreciation_and_amortization),
    disclosedAt: toStr(r.disclosedAt ?? r.disclosed_at ?? r.filingDate ?? r.fiscal_year),
    sourceDocId: toStr(r.sourceDocId ?? r.source_doc_id ?? r.docId),
    adjustmentItems: (r.adjustmentItems ?? r.adjustment_items ?? null) as Record<string, unknown> | null,
  })).filter(r => r.fiscalYear)
}

function normalizeScore(input: number): number {
  if (Number.isNaN(input)) return 0
  return Math.min(100, Math.max(0, Math.round(input)))
}

export async function fetchQualityScore(apiKey: string, code5: string): Promise<EdinetScore | null> {
  const map = await searchCompanyByCode(apiKey, code5.slice(0, 4))
  const edinetCode = map[0]?.edinetCode
  if (!edinetCode) return null
  const raw = await getJson(apiKey, `/companies/${edinetCode}/analysis`)
  const arr = pickArray(raw)
  const top = arr[0] as Record<string, unknown> | undefined
  if (!top) return null
  const history = Array.isArray(top.history) ? top.history as Record<string, unknown>[] : []
  const latest = history.sort((a, b) => Number(b.fiscal_year ?? 0) - Number(a.fiscal_year ?? 0))[0]
  if (!latest) return null
  const score = Number(latest.credit_score)
  if (Number.isNaN(score)) return null
  const asOfDate = `${String(latest.fiscal_year ?? '')}-03-31`
  return {
    code: code5,
    asOfDate,
    score: normalizeScore(score),
    formulaText: 'quality_score = credit_score (analysis.history latest fiscal year)',
    components: {
      credit_rating: latest.credit_rating ?? null,
      benchmark_strong_count: latest.benchmark_strong_count ?? null,
      benchmark_weak_count: latest.benchmark_weak_count ?? null,
      credit_flag_count: latest.credit_flag_count ?? null,
    },
  }
}

export async function fetchTextAnomalyScore(apiKey: string, code5: string): Promise<EdinetScore | null> {
  const map = await searchCompanyByCode(apiKey, code5.slice(0, 4))
  const edinetCode = map[0]?.edinetCode
  if (!edinetCode) return null
  const raw = await getJson(apiKey, `/companies/${edinetCode}/text-blocks`)
  const blocks = pickArray(raw) as Record<string, unknown>[]
  if (blocks.length === 0) return null
  const keywords = ['減損', '訴訟', '継続企業', '不正', '重要な後発事象', '資金繰り', '債務超過']
  let keywordHits = 0
  let totalLength = 0
  for (const b of blocks) {
    const text = toStr(b.text) ?? ''
    totalLength += text.length
    for (const kw of keywords) {
      if (text.includes(kw)) keywordHits += 1
    }
  }
  const lengthPenalty = Math.min(40, Math.round(totalLength / 5000))
  const keywordPenalty = Math.min(60, keywordHits * 8)
  const score = normalizeScore(lengthPenalty + keywordPenalty)
  const now = new Date().toISOString().slice(0, 10)
  return {
    code: code5,
    asOfDate: now,
    score,
    formulaText: 'anomaly_score = min(100, length_penalty + keyword_penalty)',
    components: {
      total_sections: blocks.length,
      total_length: totalLength,
      keyword_hits: keywordHits,
      length_penalty: lengthPenalty,
      keyword_penalty: keywordPenalty,
      keywords,
    },
  }
}
