import { describe, expect, it } from 'vitest'
import { mean, percentile, quantile } from './stats'

describe('mean', () => {
  it('returns simple average', () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3)
  })

  it('ignores non-finite values', () => {
    expect(mean([1, NaN, 3, Infinity])).toBe(2)
  })

  it('returns null for empty input', () => {
    expect(mean([])).toBeNull()
  })
})

describe('quantile', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it('returns p50 (median)', () => {
    expect(quantile(xs, 0.5)).toBe(5.5)
  })

  it('returns Q1 (p25)', () => {
    expect(quantile(xs, 0.25)).toBe(3.25)
  })

  it('returns Q3 (p75)', () => {
    expect(quantile(xs, 0.75)).toBe(7.75)
  })

  it('returns min at p=0 and max at p=1', () => {
    expect(quantile(xs, 0)).toBe(1)
    expect(quantile(xs, 1)).toBe(10)
  })

  it('returns null for empty', () => {
    expect(quantile([], 0.5)).toBeNull()
  })
})

describe('percentile', () => {
  it('returns 0 when current is the smallest value', () => {
    expect(percentile([10, 20, 30, 40], 10)).toBe(0)
  })

  it('returns 100 when current is greater than all values', () => {
    expect(percentile([10, 20, 30, 40], 100)).toBe(100)
  })

  it('returns the position of current within the sorted set', () => {
    // 4 values; current=25 → 2 values below → 50%
    expect(percentile([10, 20, 30, 40], 25)).toBe(50)
  })

  it('returns 0 when below the minimum', () => {
    expect(percentile([10, 20, 30], 5)).toBe(0)
  })

  it('returns null on empty input', () => {
    expect(percentile([], 12)).toBeNull()
  })

  it('ignores non-finite values in the sample', () => {
    expect(percentile([NaN, 10, 20, 30], 25)).toBeCloseTo(66.67, 1)
  })
})
