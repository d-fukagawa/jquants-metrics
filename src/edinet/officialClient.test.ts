import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchOfficialTaxAndAdjustments } from './officialClient'

const API_KEY = 'official-key'

function mockFetch(body: string, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status })))
}

describe('officialClient', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('extracts tax expense and adjustment items from csv', async () => {
    mockFetch([
      'label,value',
      '"Income tax expense (IFRS)","36000000000"',
      '"Impairment loss","10000000000"',
      '"Gain on sale of non-current assets","2000000000"',
    ].join('\n'))

    const out = await fetchOfficialTaxAndAdjustments(API_KEY, 'S100TEST')
    expect(out.taxExpense).toBe('36000000000')
    expect(out.adjustments).toHaveLength(2)
    expect(out.adjustments.find(a => a.direction === 'addback')?.itemKey).toBe('Impairment loss')
    expect(out.adjustments.find(a => a.direction === 'deduction')?.itemKey).toBe('Gain on sale of non-current assets')
  })

  it('supports japanese labels and quoted values', async () => {
    mockFetch([
      '項目,金額',
      '"法人税等","12,345"',
      '"減損損失","4,000"',
      '"固定資産売却益","1,200"',
    ].join('\n'))

    const out = await fetchOfficialTaxAndAdjustments(API_KEY, 'S100JP')
    expect(out.taxExpense).toBe('12345')
    expect(out.adjustments.find(a => a.direction === 'addback')?.amount).toBe('4000')
    expect(out.adjustments.find(a => a.direction === 'deduction')?.amount).toBe('1200')
  })

  it('throws API error on non-ok response', async () => {
    mockFetch('bad request', 400)
    await expect(fetchOfficialTaxAndAdjustments(API_KEY, 'S100ERR')).rejects.toThrow('EDINET Official API error 400')
  })
})
