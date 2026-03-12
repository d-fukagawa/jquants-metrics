import type {
  EquitiesMasterResponse,
  EquityMaster,
  DailyBarsResponse,
  DailyBar,
  FinsSummaryResponse,
  FinancialSummary,
  FinsDetailsResponse,
  FinsDetail,
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
  const data = await get<DailyBarsResponse>(apiKey, '/equities/bars/daily', { code, from, to })
  return data.data
}

// 日足株価を取得する（全銘柄 × 1日）— 1リクエストで全銘柄分を取得
// date: YYYY-MM-DD
export async function fetchDailyPricesAll(
  apiKey: string,
  date: string,
): Promise<DailyBar[]> {
  const data = await get<DailyBarsResponse>(apiKey, '/equities/bars/daily', { date })
  return data.data
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
  const data = await get<FinsSummaryResponse>(apiKey, '/fins/summary', params)
  return data.data
}

// 詳細財務情報を取得する（XBRL ベース）
// code: 5桁 (例: "72030")
export async function fetchFinsDetails(
  apiKey: string,
  code: string,
): Promise<FinsDetail[]> {
  const data = await get<FinsDetailsResponse>(apiKey, '/fins/details', { code })
  return data.data
}
