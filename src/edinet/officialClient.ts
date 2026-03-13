export interface OfficialAdjustmentItem {
  itemKey: string
  amount: string
  direction: 'addback' | 'deduction'
  category: string
}

export interface OfficialStatementExtract {
  taxExpense: string | null
  adjustments: OfficialAdjustmentItem[]
}

const BASE_URL = 'https://disclosure2dl.edinet-fsa.go.jp/api/v2'

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

const TAX_KEYWORDS = ['income tax expense', 'income taxes', 'tax expense', '法人税等', '法人税、住民税及び事業税']

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

function parseCsv(text: string): string[][] {
  return text
    .replace(/\uFEFF/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseCsvLine)
}

function parseNumericCell(cell: string): number | null {
  const normalized = cell.replace(/,/g, '').replace(/\s+/g, '')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function pickRowAmount(cells: string[]): number | null {
  for (let i = cells.length - 1; i >= 0; i--) {
    const n = parseNumericCell(cells[i] ?? '')
    if (n !== null) return n
  }
  return null
}

function matchesAny(text: string, keywords: readonly string[]): boolean {
  const t = normalize(text)
  return keywords.some((k) => t.includes(normalize(k)))
}

function toAmountString(n: number): string {
  return String(Math.abs(n))
}

async function fetchOfficialStatementCsv(apiKey: string, docId: string): Promise<string> {
  const url = new URL(`${BASE_URL}/documents/${encodeURIComponent(docId)}`)
  // EDINET API v2: type=5 は CSV（財務諸表）取得。
  url.searchParams.set('type', '5')

  const res = await fetch(url.toString(), {
    headers: {
      'Ocp-Apim-Subscription-Key': apiKey,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`EDINET Official API error ${res.status}: ${text}`)
  }

  return res.text()
}

export async function fetchOfficialTaxAndAdjustments(apiKey: string, docId: string): Promise<OfficialStatementExtract> {
  const csv = await fetchOfficialStatementCsv(apiKey, docId)
  const rows = parseCsv(csv)

  let taxExpense: string | null = null
  const addbackMap = new Map<string, { category: string; amount: number }>()
  const deductionMap = new Map<string, { category: string; amount: number }>()

  for (const cells of rows) {
    const joined = cells.join(' | ')
    const amount = pickRowAmount(cells)
    if (amount === null || amount === 0) continue

    if (taxExpense === null && matchesAny(joined, TAX_KEYWORDS)) {
      taxExpense = String(amount)
    }

    for (const item of ADDBACK_ITEMS) {
      if (!matchesAny(joined, item.keywords)) continue
      const prev = addbackMap.get(item.key)
      addbackMap.set(item.key, {
        category: item.category,
        amount: (prev?.amount ?? 0) + Math.abs(amount),
      })
    }

    for (const item of DEDUCTION_ITEMS) {
      if (!matchesAny(joined, item.keywords)) continue
      const prev = deductionMap.get(item.key)
      deductionMap.set(item.key, {
        category: item.category,
        amount: (prev?.amount ?? 0) + Math.abs(amount),
      })
    }
  }

  const adjustments: OfficialAdjustmentItem[] = []
  for (const [itemKey, v] of addbackMap.entries()) {
    adjustments.push({
      itemKey,
      amount: toAmountString(v.amount),
      direction: 'addback',
      category: v.category,
    })
  }
  for (const [itemKey, v] of deductionMap.entries()) {
    adjustments.push({
      itemKey,
      amount: toAmountString(v.amount),
      direction: 'deduction',
      category: v.category,
    })
  }

  return { taxExpense, adjustments }
}
