import { describe, expect, it } from 'vitest'
import { TRADING_DAYS_PER_YEAR, backtestBuyTiming, type BuyTimingBar } from './buyTimingBacktest'

function bars(closes: number[]): BuyTimingBar[] {
  return closes.map((close, index) => {
    const date = new Date('2026-01-01T00:00:00Z')
    date.setUTCDate(date.getUTCDate() + index)
    return {
      date: date.toISOString().slice(0, 10),
      close,
    }
  })
}

describe('backtestBuyTiming', () => {
  it('records a trigger when close falls below the upward-only ref', () => {
    const result = backtestBuyTiming(bars([100, 105, 104, 101]), {
      threshold: 0.03,
      refWindow: 3,
      cooldown: 0,
    })

    expect(result.triggers).toEqual([
      {
        date: '2026-01-04',
        price: 101,
        ref: 105,
        drawdown: 101 / 105 - 1,
      },
    ])
    expect(result.count).toBe(1)
  })

  it('resets ref after a trigger so old highs do not cause immediate retriggers', () => {
    const result = backtestBuyTiming(bars([100, 110, 106, 105, 104, 108, 104]), {
      threshold: 0.03,
      refWindow: 5,
      cooldown: 0,
    })

    expect(result.triggers.map(trigger => trigger.date)).toEqual([
      '2026-01-03',
      '2026-01-07',
    ])
    expect(result.triggers[1].ref).toBe(108)
  })

  it('requires a new high after reset before the next trigger', () => {
    const result = backtestBuyTiming(bars([100, 110, 106, 102, 101, 100]), {
      threshold: 0.03,
      refWindow: 5,
      cooldown: 0,
    })

    expect(result.triggers.map(trigger => trigger.date)).toEqual(['2026-01-03'])
  })

  it('enforces cooldown in trading-day indexes', () => {
    const result = backtestBuyTiming(bars([100, 110, 105, 111, 106, 112, 107]), {
      threshold: 0.03,
      refWindow: 3,
      cooldown: 3,
    })

    expect(result.triggers.map(trigger => trigger.date)).toEqual([
      '2026-01-03',
      '2026-01-07',
    ])
  })

  it('annualizes count by 245 trading days', () => {
    const input = Array.from({ length: TRADING_DAYS_PER_YEAR }, (_, index) => (
      index % 50 === 0 ? 100 : 96
    ))
    const result = backtestBuyTiming(bars(input), {
      threshold: 0.03,
      refWindow: 20,
      cooldown: 50,
    })

    expect(result.years).toBe(1)
    expect(result.perYear).toBe(result.count)
  })

  it('rejects invalid params', () => {
    expect(() => backtestBuyTiming([], { threshold: 0, refWindow: 20, cooldown: 15 })).toThrow(
      'threshold must be > 0',
    )
    expect(() => backtestBuyTiming([], { threshold: 0.03, refWindow: 0, cooldown: 15 })).toThrow(
      'refWindow must be an integer >= 1',
    )
    expect(() => backtestBuyTiming([], { threshold: 0.03, refWindow: 20, cooldown: -1 })).toThrow(
      'cooldown must be an integer >= 0',
    )
  })
})
