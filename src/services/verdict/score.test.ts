import { describe, expect, it } from 'vitest'
import {
  judgeDeRatio,
  judgeMetric,
  judgePayoutRatio,
  judgePercentile,
  judgeTotalScore,
  scoreHigherBetter,
  scoreLowerBetter,
} from './score'

describe('scoreLowerBetter', () => {
  it('maps p=0 to +6', () => {
    expect(scoreLowerBetter(0)).toBe(6)
  })

  it('maps p=100 to -6', () => {
    expect(scoreLowerBetter(100)).toBe(-6)
  })

  it('maps p=50 to 0', () => {
    expect(scoreLowerBetter(50)).toBe(0)
  })
})

describe('scoreHigherBetter', () => {
  it('maps p=0 to -6 and p=100 to +6', () => {
    expect(scoreHigherBetter(0)).toBe(-6)
    expect(scoreHigherBetter(100)).toBe(6)
  })

  it('maps p=50 to 0', () => {
    expect(scoreHigherBetter(50)).toBe(0)
  })
})

describe('judgePercentile (lower_better)', () => {
  it('marks deeply low percentile as 超割安', () => {
    expect(judgePercentile(5, 'lower_better').label).toBe('超割安')
    expect(judgePercentile(5, 'lower_better').color).toBe('green-strong')
  })

  it('marks 90+ percentile as 歴史的高水準', () => {
    expect(judgePercentile(95, 'lower_better').label).toBe('歴史的高水準')
    expect(judgePercentile(95, 'lower_better').color).toBe('red')
  })
})

describe('judgePercentile (higher_better)', () => {
  it('marks high percentile as 極めて高水準', () => {
    expect(judgePercentile(95, 'higher_better').label).toBe('極めて高水準')
    expect(judgePercentile(95, 'higher_better').color).toBe('green-strong')
  })

  it('marks low percentile as 歴史的低水準', () => {
    expect(judgePercentile(5, 'higher_better').label).toBe('歴史的低水準')
    expect(judgePercentile(5, 'higher_better').color).toBe('red')
  })
})

describe('judgePayoutRatio', () => {
  it('returns +1 for 30-70%', () => {
    expect(judgePayoutRatio(50).score).toBe(1)
    expect(judgePayoutRatio(30).score).toBe(1)
    expect(judgePayoutRatio(70).score).toBe(1)
  })

  it('returns 0 for <30%', () => {
    expect(judgePayoutRatio(20).score).toBe(0)
  })

  it('returns -1 for >70%', () => {
    expect(judgePayoutRatio(85).score).toBe(-1)
  })
})

describe('judgeDeRatio', () => {
  it('returns +2 for ≤0.5', () => {
    expect(judgeDeRatio(0.3).score).toBe(2)
    expect(judgeDeRatio(0.5).score).toBe(2)
  })

  it('returns 0 for 0.5-1.0', () => {
    expect(judgeDeRatio(0.8).score).toBe(0)
    expect(judgeDeRatio(1.0).score).toBe(0)
  })

  it('returns -2 for >1.0', () => {
    expect(judgeDeRatio(1.5).score).toBe(-2)
  })
})

describe('judgeMetric', () => {
  it('uses percentile-based scoring for lower_better metrics', () => {
    const r = judgeMetric('per_actual', 12, 20)
    expect(r.score).toBeCloseTo(scoreLowerBetter(20))
  })

  it('uses higher_better scoring for ROE', () => {
    const r = judgeMetric('roe', 18, 90)
    expect(r.score).toBeCloseTo(scoreHigherBetter(90))
  })

  it('uses band logic for payout_ratio', () => {
    const r = judgeMetric('payout_ratio', 45, 50)
    expect(r.score).toBe(1)
    expect(r.judgment.label).toBe('健全')
  })

  it('returns 0 score and dash label when value is null', () => {
    const r = judgeMetric('per_actual', null, null)
    expect(r.score).toBe(0)
    expect(r.judgment.label).toBe('—')
  })
})

describe('judgeTotalScore', () => {
  it('classifies high positive scores as 顕著に割安', () => {
    expect(judgeTotalScore(2.5).label).toBe('顕著に割安')
  })

  it('classifies neutral scores as 適正水準', () => {
    expect(judgeTotalScore(0.5).label).toBe('適正水準')
    expect(judgeTotalScore(-0.5).label).toBe('適正水準')
  })

  it('classifies highly negative scores as 顕著に割高', () => {
    expect(judgeTotalScore(-3).label).toBe('顕著に割高')
  })

  it('returns データ不足 for null', () => {
    expect(judgeTotalScore(null).label).toBe('データ不足')
  })
})
