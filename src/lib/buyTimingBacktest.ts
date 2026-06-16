export const TRADING_DAYS_PER_YEAR = 245

export type BuyTimingBar = {
  date: string
  close: number
}

export type BuyTimingParams = {
  threshold: number
  refWindow: number
  cooldown: number
}

export type BuyTimingTrigger = {
  date: string
  price: number
  ref: number
  drawdown: number
}

export type BuyTimingBacktestResult = {
  triggers: BuyTimingTrigger[]
  count: number
  years: number
  perYear: number | null
}

function assertValidParams(params: BuyTimingParams): void {
  if (!Number.isFinite(params.threshold) || params.threshold <= 0) {
    throw new Error('threshold must be > 0')
  }
  if (!Number.isInteger(params.refWindow) || params.refWindow < 1) {
    throw new Error('refWindow must be an integer >= 1')
  }
  if (!Number.isInteger(params.cooldown) || params.cooldown < 0) {
    throw new Error('cooldown must be an integer >= 0')
  }
}

function rollingMaxClose(bars: BuyTimingBar[], endIndex: number, window: number, startIndex: number): number {
  let max = Number.NEGATIVE_INFINITY
  const fromIndex = Math.max(startIndex, endIndex - window + 1)

  for (let i = fromIndex; i <= endIndex; i += 1) {
    max = Math.max(max, bars[i].close)
  }

  return max
}

export function backtestBuyTiming(
  bars: BuyTimingBar[],
  params: BuyTimingParams,
): BuyTimingBacktestResult {
  assertValidParams(params)

  const cleanBars = bars.filter(bar => (
    /^\d{4}-\d{2}-\d{2}$/.test(bar.date) &&
    Number.isFinite(bar.close) &&
    bar.close > 0
  ))
  const triggers: BuyTimingTrigger[] = []
  let ref: number | null = null
  let lastBuyIdx = Number.NEGATIVE_INFINITY
  let resetStartIdx = 0
  let hasNewHighAfterReset = true

  for (let i = 0; i < cleanBars.length; i += 1) {
    const bar = cleanBars[i]
    const rollingMax = rollingMaxClose(cleanBars, i, params.refWindow, resetStartIdx)
    if (ref == null) {
      ref = rollingMax
      hasNewHighAfterReset = true
    } else if (rollingMax > ref) {
      ref = rollingMax
      hasNewHighAfterReset = true
    }

    if (
      hasNewHighAfterReset &&
      i - lastBuyIdx >= params.cooldown &&
      bar.close <= ref * (1 - params.threshold)
    ) {
      triggers.push({
        date: bar.date,
        price: bar.close,
        ref,
        drawdown: bar.close / ref - 1,
      })
      lastBuyIdx = i
      resetStartIdx = i
      ref = bar.close
      hasNewHighAfterReset = false
    }
  }

  const years = cleanBars.length / TRADING_DAYS_PER_YEAR
  const count = triggers.length
  const perYear = years > 0 ? count / years : null

  return { triggers, count, years, perYear }
}
