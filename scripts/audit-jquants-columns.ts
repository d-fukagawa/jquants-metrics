/**
 * Probe a small set of J-Quants v2 responses for the columns used by A-0-2.
 * This is read-only and does not print the API key or response values.
 *
 * Usage:
 *   JQUANTS_API_KEY=... npm run audit:jquants:columns
 */

const apiKey = process.env.JQUANTS_API_KEY
if (!apiKey) {
  console.error('ERROR: JQUANTS_API_KEY is required')
  process.exit(1)
}
const requiredApiKey = apiKey

const baseUrl = 'https://api.jquants.com/v2'

async function probe(name: string, path: string, requiredKeys: string[]) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'x-api-key': requiredApiKey },
  })
  if (!response.ok) {
    return { name, status: response.status, available: false }
  }

  const body = await response.json() as {
    data?: Array<Record<string, unknown>>
    pagination_key?: string
    cursor?: string
  }
  const first = body.data?.[0] ?? null
  const observedKeys = first ? Object.keys(first).sort() : []
  return {
    name,
    status: response.status,
    available: true,
    rowsOnFirstPage: body.data?.length ?? 0,
    hasPaginationKey: Boolean(body.pagination_key),
    hasCursor: Boolean(body.cursor),
    missingRequiredKeys: requiredKeys.filter(key => !observedKeys.includes(key)),
    observedKeys,
  }
}

const results = []
results.push(await probe('master', '/equities/master', ['Date', 'Code', 'ProdCat']))
results.push(await probe(
  'summary',
  '/fins/summary?code=62870',
  [
    'DiscDate', 'DiscTime', 'Code', 'DiscNo', 'DocType', 'CurPerType',
    'Sales', 'OP', 'Eq', 'ShEq', 'NCSales', 'NCOP', 'NCShEq',
    'MatChgSub', 'SigChgInC',
  ],
))
results.push(await probe(
  'details',
  '/fins/details?code=62870',
  ['DiscDate', 'DiscTime', 'Code', 'DiscNo', 'DocType', 'FS'],
))

console.log(JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2))

export {}
