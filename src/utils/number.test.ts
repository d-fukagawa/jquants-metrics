import { describe, expect, it } from 'vitest'
import { parseNumber, parseOptionalNumber, toNullableString } from './number'

describe('number utils', () => {
  it('parses numeric string', () => {
    expect(parseNumber('12.3')).toBe(12.3)
  })

  it('returns null for empty string', () => {
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('   ')).toBeNull()
  })

  it('returns null for non numeric value', () => {
    expect(parseNumber('abc')).toBeNull()
  })

  it('parses optional number', () => {
    expect(parseOptionalNumber('10')).toBe(10)
    expect(parseOptionalNumber(undefined)).toBeUndefined()
  })

  it('converts empty string to nullable string', () => {
    expect(toNullableString('')).toBeNull()
    expect(toNullableString('1')).toBe('1')
  })
})
