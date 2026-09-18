import { beforeEach, describe, expect, it, vi } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import {
  extractOfficialTaxAndAdjustmentsFromZip,
  fetchOfficialTaxAndAdjustments,
} from './officialClient'

const API_KEY = 'official-key'
const HEADERS = ['要素ID', '項目名', 'コンテキストID', '相対年度', '連結・個別', '期間・時点', 'ユニットID', '単位', '値']

function utf16Le(text: string): Uint8Array {
  const bytes = new Uint8Array(2 + text.length * 2)
  bytes[0] = 0xff
  bytes[1] = 0xfe
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    bytes[2 + i * 2] = code & 0xff
    bytes[3 + i * 2] = code >> 8
  }
  return bytes
}

function row(values: string[]): string {
  return values.map(value => `"${value.replace(/"/g, '""')}"`).join('\t')
}

function makeZip(rows: string[]): Uint8Array {
  const tsv = [row(HEADERS), ...rows].join('\r\n')
  return zipSync({
    'XBRL_TO_CSV/jpcrp030000-asr-001.csv': utf16Le(tsv),
    'XBRL_TO_CSV/jpaud-aai-001.csv': strToU8('ignored'),
  })
}

function currentRow(elementId: string, label: string, value: string): string {
  return row([elementId, label, 'CurrentYearDuration', '当期', '連結', '期間', 'JPY', '円', value])
}

describe('officialClient', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('extracts current consolidated tax and adjustments from the official ZIP layout', async () => {
    const zip = makeZip([
      currentRow('ifrs-full:IncomeTaxExpense', '法人税等', '36000000000'),
      currentRow('jppfs_cor:ImpairmentLoss', '減損損失', '10000000000'),
      currentRow('jppfs_cor:GainOnSaleOfNoncurrentAssets', '固定資産売却益', '2000000000'),
      row(['jppfs_cor:ImpairmentLoss', '減損損失', 'Prior1YearDuration', '前期', '連結', '期間', 'JPY', '円', '999']),
      row(['jppfs_cor:ImpairmentLoss', '減損損失', 'CurrentYearDuration_NonConsolidatedMember', '当期', '個別', '期間', 'JPY', '円', '888']),
      row(['jppfs_cor:ImpairmentLoss', '減損損失', 'CurrentYearDuration_SegmentMember', '当期', '連結', '期間', 'JPY', '円', '777']),
    ])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new Uint8Array(zip).buffer, {
      status: 200,
      headers: { 'content-type': 'application/octet-stream' },
    })))

    const out = await fetchOfficialTaxAndAdjustments(API_KEY, 'S100TEST')

    expect(out.taxExpense).toBe('36000000000')
    expect(out.adjustments).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemKey: 'Impairment loss', amount: '10000000000', direction: 'addback' }),
      expect.objectContaining({ itemKey: 'Gain on sale of non-current assets', amount: '2000000000', direction: 'deduction' }),
    ]))
    const requested = new URL(vi.mocked(fetch).mock.calls[0][0] as string)
    expect(requested.origin).toBe('https://api.edinet-fsa.go.jp')
    expect(requested.searchParams.get('type')).toBe('5')
    expect(requested.searchParams.get('Subscription-Key')).toBe(API_KEY)
  })

  it('returns null and an ambiguity warning instead of summing conflicting contexts', () => {
    const zip = makeZip([
      currentRow('ifrs-full:IncomeTaxExpense', '法人税等', '100'),
      currentRow('jppfs_cor:IncomeTaxes', 'Income taxes', '200'),
    ])

    const out = extractOfficialTaxAndAdjustmentsFromZip(zip)

    expect(out.taxExpense).toBeNull()
    expect(out.warnings).toContain('ambiguous:tax_expense')
  })

  it('supports quoted values and Japanese negative markers', () => {
    const zip = makeZip([
      currentRow('jppfs_cor:IncomeTaxes', '法人税等', '12,345'),
      currentRow('jppfs_cor:ImpairmentLoss', '減損損失', '△4,000'),
    ])

    const out = extractOfficialTaxAndAdjustmentsFromZip(zip)

    expect(out.taxExpense).toBe('12345')
    expect(out.adjustments[0]?.amount).toBe('4000')
  })

  it('rejects a successful JSON response that is not a ZIP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"metadata":{"status":"404"}}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })))

    await expect(fetchOfficialTaxAndAdjustments(API_KEY, 'S100NONE'))
      .rejects.toThrow('non-ZIP response')
  })

  it('throws API error on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad request', { status: 400 })))
    await expect(fetchOfficialTaxAndAdjustments(API_KEY, 'S100ERR')).rejects.toThrow('EDINET Official API error 400')
  })
})
