import { describe, expect, it } from 'vitest'
import { enumerateDates } from './date'

describe('date utils', () => {
  it('enumerates inclusive date range', () => {
    expect(enumerateDates('2026-03-10', '2026-03-12')).toEqual([
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
    ])
  })
})
