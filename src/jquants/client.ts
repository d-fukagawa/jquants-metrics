import type {
  EquitiesMasterResponse,
  EquityMaster,
  DailyBar,
  FinancialSummary,
  FinsDetail,
  EquityValuation,
} from './types'

const BASE_URL = 'https://api.jquants.com/v2'

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function get<T>(apiKey: string, path: string, params?: Record<string, string>, retries = 3): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': apiKey },
  })
  if (res.status === 429 && retries > 0) {
    const wait = 60_000  // 1 分待機してリトライ
    console.warn(`[jquants] 429 rate limit — waiting ${wait / 1000}s (retries left: ${retries - 1})`)
    await sleep(wait)
    return get<T>(apiKey, path, params, retries - 1)
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`JQuants API error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

async function getPaginated<T>(
  apiKey: string,
  path: string,
  params: Record<string, string>,
): Promise<T[]> {
  const rows: T[] = []
  let paginationKey: string | undefined
  const seenKeys = new Set<string>()

  do {
    if (paginationKey) await sleep(1_100)
    const pageParams = paginationKey
      ? { ...params, pagination_key: paginationKey }
      : params
    const page = await get<{ data: T[]; pagination_key?: string }>(apiKey, path, pageParams)
    rows.push(...page.data)

    paginationKey = page.pagination_key
    if (paginationKey) {
      if (seenKeys.has(paginationKey)) {
        throw new Error('JQuants API returned a repeated pagination_key')
      }
      seenKeys.add(paginationKey)
    }
  } while (paginationKey)

  return rows
}

// 全銘柄マスタを取得する
// date: YYYY-MM-DD (省略時は最新)
export async function fetchEquitiesMaster(
  apiKey: string,
  date?: string,
): Promise<EquityMaster[]> {
  const params = date ? { date } : undefined
  const data = await get<EquitiesMasterResponse>(apiKey, '/equities/master', params)
  return data.data
}

// 日足株価を取得する（1銘柄 × 期間）
// code: 5桁 (例: "72030")
// from/to: YYYY-MM-DD
export async function fetchDailyPrices(
  apiKey: string,
  code: string,
  from: string,
  to: string,
): Promise<DailyBar[]> {
  return getPaginated<DailyBar>(apiKey, '/equities/bars/daily', { code, from, to })
}

// 日足株価を取得する（全銘柄 × 1日）— 1リクエストで全銘柄分を取得
// date: YYYY-MM-DD
export async function fetchDailyPricesAll(
  apiKey: string,
  date: string,
): Promise<DailyBar[]> {
  return getPaginated<DailyBar>(apiKey, '/equities/bars/daily', { date })
}

// 日次バリュエーション指標を取得する（全銘柄 × 1日）
export async function fetchEquityValuationsByDate(
  apiKey: string,
  date: string,
): Promise<EquityValuation[]> {
  return getPaginated<EquityValuation>(apiKey, '/equities/valuation', { date })
}

// 日次バリュエーション指標を取得する（1銘柄 × 期間）
export async function fetchEquityValuationsByCode(
  apiKey: string,
  code: string,
  from?: string,
  to?: string,
): Promise<EquityValuation[]> {
  const params: Record<string, string> = { code }
  if (from) params.from = from
  if (to) params.to = to
  return getPaginated<EquityValuation>(apiKey, '/equities/valuation', params)
}

// 財務情報を取得する
// code: 5桁 (例: "72030")
// date: 開示日 YYYY-MM-DD (省略時は最新)
export async function fetchFinancialSummary(
  apiKey: string,
  code: string,
  date?: string,
): Promise<FinancialSummary[]> {
  const params: Record<string, string> = { code }
  if (date) params.date = date
  return getPaginated<FinancialSummary>(apiKey, '/fins/summary', params)
}

// 財務情報を開示日単位で全銘柄取得する
export async function fetchFinancialSummaryByDate(
  apiKey: string,
  date: string,
): Promise<FinancialSummary[]> {
  return getPaginated<FinancialSummary>(apiKey, '/fins/summary', { date })
}

// 詳細財務情報を取得する（XBRL ベース）
// code: 5桁 (例: "72030")
export async function fetchFinsDetails(
  apiKey: string,
  code: string,
): Promise<FinsDetail[]> {
  return getPaginated<FinsDetail>(apiKey, '/fins/details', { code })
}
