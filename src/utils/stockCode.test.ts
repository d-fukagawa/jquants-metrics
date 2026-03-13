import { describe, expect, it } from 'vitest'
import { normalizeCode4, parseCode4, toCode4, toCode5 } from './stockCode'

describe('stockCode utils', () => {
  it('normalizes code4 to uppercase', () => {
    expect(normalizeCode4(' 72a3 ')).toBe('72A3')
  })

  it('parses valid code4', () => {
    expect(parseCode4('485a')).toBe('485A')
  })

  it('returns null for invalid code4', () => {
    expect(parseCode4('7203x')).toBeNull()
  })

  it('converts code4 to code5', () => {
    expect(toCode5('7203')).toBe('72030')
  })

  it('converts code5 to code4', () => {
    expect(toCode4('72030')).toBe('7203')
  })
})
