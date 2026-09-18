import { unzipSync } from 'fflate'

export interface OfficialAdjustmentItem {
  itemKey: string
  amount: string
  direction: 'addback' | 'deduction'
  category: string
}

export interface OfficialStatementExtract {
  taxExpense: string | null
  adjustments: OfficialAdjustmentItem[]
  warnings?: string[]
}

const BASE_URL = 'https://api.edinet-fsa.go.jp/api/v2'

const ADDBACK_ITEMS = [
  { key: 'Impairment loss', category: 'impairment', keywords: ['impairment loss', '減損損失'] },
  { key: 'Loss on business restructuring', category: 'restructuring', keywords: ['loss on business restructuring', '事業構造改革費用', '構造改革費用'] },
  { key: 'Loss on disposal of non-current assets', category: 'one_off', keywords: ['loss on disposal of non-current assets', '固定資産除売却損'] },
  { key: 'Loss on retirement of non-current assets', category: 'one_off', keywords: ['loss on retirement of non-current assets', '固定資産除却損'] },
  { key: 'Restructuring costs', category: 'restructuring', keywords: ['restructuring costs', '再編費用'] },
] as const

const DEDUCTION_ITEMS = [
  { key: 'Gain on sale of non-current assets', category: 'gain', keywords: ['gain on sale of non-current assets', '固定資産売却益'] },
  { key: 'Gain on disposal of non-current assets', category: 'gain', keywords: ['gain on disposal of non-current assets', '固定資産処分益'] },
  { key: 'Gain on step acquisitions', category: 'gain', keywords: ['gain on step acquisitions', '段階取得に係る差益'] },
  { key: 'Gain on bargain purchase', category: 'gain', keywords: ['gain on bargain purchase', '負ののれん発生益'] },
  { key: 'Gain on sale of shares of subsidiaries and associates', category: 'gain', keywords: ['gain on sale of shares of subsidiaries and associates', '関係会社株式売却益'] },
] as const

const TAX_EXACT_LABELS = new Set([
  'income tax expense',
  'income taxes',
  'tax expense',
  '法人税等',
  '法人税等合計',
])

const TAX_FALLBACK_LABELS = new Set([
  '法人税、住民税及び事業税',
  '法人税、住民税及び事業税等',
])

interface OfficialCsvRow {
  elementId: string
  label: string
  contextId: string
  relativeYear: string
  basis: string
  periodKind: string
  unitId: string
  unit: string
  value: string
}

function normalize(value: string): string {
  return value.replace(/\uFEFF/g, '').trim().toLowerCase()
}

function parseDelimited(text: string, delimiter = '\t'): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === delimiter && !inQuotes) {
      row.push(cell)
      cell = ''
      continue
    }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      if (row.some(value => value.trim() !== '')) rows.push(row)
      row = []
      cell = ''
      continue
    }
    cell += ch
  }

  row.push(cell)
  if (row.some(value => value.trim() !== '')) rows.push(row)
  return rows
}

function parseNumericCell(cell: string): number | null {
  let normalized = cell.replace(/,/g, '').replace(/\s+/g, '').replace(/−/g, '-')
  let negative = false
  if (/^[△▲]/.test(normalized)) {
    negative = true
    normalized = normalized.slice(1)
  }
  if (normalized.startsWith('(') && normalized.endsWith(')')) {
    negative = true
    normalized = normalized.slice(1, -1)
  }
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null
  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return negative ? -Math.abs(n) : n
}

function decodeOfficialCsv(bytes: Uint8Array): string {
  const utf16Le = bytes[0] === 0xff && bytes[1] === 0xfe
    || (bytes.length > 3 && bytes[1] === 0 && bytes[3] === 0)
  return new TextDecoder(utf16Le ? 'utf-16le' : 'utf-8').decode(bytes)
}

function headerIndex(headers: string[], aliases: readonly string[]): number {
  const normalizedAliases = aliases.map(normalize)
  return headers.findIndex(header => normalizedAliases.includes(normalize(header)))
}

function parseOfficialCsv(bytes: Uint8Array): OfficialCsvRow[] {
  const parsed = parseDelimited(decodeOfficialCsv(bytes))
  const headers = parsed[0]
  if (!headers) return []

  const indexes = {
    elementId: headerIndex(headers, ['要素ID', 'Element ID']),
    label: headerIndex(headers, ['項目名', 'Item Name']),
    contextId: headerIndex(headers, ['コンテキストID', 'Context ID']),
    relativeYear: headerIndex(headers, ['相対年度', 'Relative Year']),
    basis: headerIndex(headers, ['連結・個別', 'Consolidated or NonConsolidated']),
    periodKind: headerIndex(headers, ['期間・時点', 'Period or Instant']),
    unitId: headerIndex(headers, ['ユニットID', 'Unit ID']),
    unit: headerIndex(headers, ['単位', 'Unit']),
    value: headerIndex(headers, ['値', 'Value']),
  }

  if (indexes.elementId < 0 || indexes.label < 0 || indexes.contextId < 0 || indexes.value < 0) {
    throw new Error('EDINET Official CSV has an unsupported header layout')
  }

  const cell = (row: string[], index: number) => index < 0 ? '' : (row[index] ?? '')
  return parsed.slice(1).map(row => ({
    elementId: cell(row, indexes.elementId),
    label: cell(row, indexes.label),
    contextId: cell(row, indexes.contextId),
    relativeYear: cell(row, indexes.relativeYear),
    basis: cell(row, indexes.basis),
    periodKind: cell(row, indexes.periodKind),
    unitId: cell(row, indexes.unitId),
    unit: cell(row, indexes.unit),
    value: cell(row, indexes.value),
  }))
}

function isCurrentConsolidatedDuration(row: OfficialCsvRow): boolean {
  const context = normalize(row.contextId)
  const relativeYear = normalize(row.relativeYear)
  const basis = normalize(row.basis)
  const periodKind = normalize(row.periodKind)
  const unit = normalize(`${row.unitId} ${row.unit}`)

  const isCurrent = context.includes('currentyearduration')
    || relativeYear === '当期'
    || relativeYear === 'current year'
  const isDuration = context.includes('duration')
    || periodKind === '期間'
    || periodKind === 'duration'
  const isNonConsolidated = context.includes('nonconsolidated') || basis === '個別'
  const isDimensional = context.includes('member') && !context.includes('nonconsolidatedmember')
  const isConsolidated = basis === '連結'
    || (!basis && !isNonConsolidated && !isDimensional)
  const isMoney = !unit || unit.includes('jpy') || unit.includes('円')

  return isCurrent && isDuration && !isNonConsolidated && !isDimensional && isConsolidated && isMoney
}

function matchesAny(value: string, keywords: readonly string[]): boolean {
  const normalized = normalize(value)
  return keywords.some(keyword => normalized.includes(normalize(keyword)))
}

function uniqueAmount(
  rows: OfficialCsvRow[],
  matcher: (row: OfficialCsvRow) => boolean,
  warningKey: string,
  warnings: string[],
): number | null {
  const amounts = new Set<number>()
  for (const row of rows) {
    if (!isCurrentConsolidatedDuration(row) || !matcher(row)) continue
    const amount = parseNumericCell(row.value)
    if (amount !== null && amount !== 0) amounts.add(amount)
  }
  if (amounts.size === 1) return [...amounts][0] ?? null
  if (amounts.size > 1) warnings.push(`ambiguous:${warningKey}`)
  return null
}

function mainStatementFiles(zipBytes: Uint8Array): Uint8Array[] {
  const files = unzipSync(zipBytes, {
    filter: file => {
      const name = file.name.replace(/\\/g, '/')
      const baseName = name.split('/').pop() ?? ''
      return /(^|\/)XBRL_TO_CSV\//i.test(name)
        && /^jpcrp.*\.csv$/i.test(baseName)
    },
  })
  return Object.entries(files)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, bytes]) => bytes)
}

export function extractOfficialTaxAndAdjustmentsFromZip(zipBytes: Uint8Array): OfficialStatementExtract {
  if (zipBytes[0] !== 0x50 || zipBytes[1] !== 0x4b) {
    throw new Error('EDINET Official API returned a non-ZIP response')
  }

  const csvFiles = mainStatementFiles(zipBytes)
  if (csvFiles.length === 0) {
    throw new Error('EDINET Official ZIP does not contain XBRL_TO_CSV/jpcrp*.csv')
  }

  const rows = csvFiles.flatMap(parseOfficialCsv)
  const warnings: string[] = []
  const taxExpense = uniqueAmount(rows, row => {
    const label = normalize(row.label)
    const element = normalize(row.elementId)
    return TAX_EXACT_LABELS.has(label)
      || element.endsWith(':incometaxexpense')
      || element.endsWith(':incometaxes')
  }, 'tax_expense', warnings) ?? uniqueAmount(
    rows,
    row => TAX_FALLBACK_LABELS.has(normalize(row.label)),
    'tax_expense_fallback',
    warnings,
  )

  const adjustments: OfficialAdjustmentItem[] = []
  for (const item of ADDBACK_ITEMS) {
    const amount = uniqueAmount(
      rows,
      row => matchesAny(`${row.elementId} ${row.label}`, item.keywords),
      item.key,
      warnings,
    )
    if (amount !== null) {
      adjustments.push({
        itemKey: item.key,
        amount: String(Math.abs(amount)),
        direction: 'addback',
        category: item.category,
      })
    }
  }
  for (const item of DEDUCTION_ITEMS) {
    const amount = uniqueAmount(
      rows,
      row => matchesAny(`${row.elementId} ${row.label}`, item.keywords),
      item.key,
      warnings,
    )
    if (amount !== null) {
      adjustments.push({
        itemKey: item.key,
        amount: String(Math.abs(amount)),
        direction: 'deduction',
        category: item.category,
      })
    }
  }

  return {
    taxExpense: taxExpense === null ? null : String(taxExpense),
    adjustments,
    warnings,
  }
}

async function fetchOfficialStatementZip(apiKey: string, docId: string): Promise<Uint8Array> {
  const url = new URL(`${BASE_URL}/documents/${encodeURIComponent(docId)}`)
  url.searchParams.set('type', '5')
  url.searchParams.set('Subscription-Key', apiKey)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`EDINET Official API error ${res.status}: ${text}`)
  }

  const contentType = res.headers.get('content-type')?.toLowerCase() ?? ''
  const body = new Uint8Array(await res.arrayBuffer())
  if (contentType.includes('json') || body[0] !== 0x50 || body[1] !== 0x4b) {
    const text = new TextDecoder().decode(body).slice(0, 500)
    throw new Error(`EDINET Official API returned a non-ZIP response: ${text}`)
  }
  return body
}

export async function fetchOfficialTaxAndAdjustments(apiKey: string, docId: string): Promise<OfficialStatementExtract> {
  const zip = await fetchOfficialStatementZip(apiKey, docId)
  return extractOfficialTaxAndAdjustmentsFromZip(zip)
}
