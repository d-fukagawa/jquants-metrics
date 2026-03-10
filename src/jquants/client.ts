import type {
  EquitiesMasterResponse,
  EquityMaster,
  DailyBarsResponse,
  DailyBar,
  FinsSummaryResponse,
  FinancialSummary,
} from './types'

const BASE_URL = 'https://api.jquants.com/v2'

async function get<T>(apiKey: string, path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': apiKey },
  })
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

// 日足株価を取得する
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
