// Verdict（バリュエーション判定）— 統計ユーティリティ

function finite(values: number[]): number[] {
  return values.filter((v) => Number.isFinite(v))
}

export function mean(values: number[]): number | null {
  const v = finite(values)
  if (v.length === 0) return null
  let sum = 0
  for (const x of v) sum += x
  return sum / v.length
}

// 線形補間によるサンプル分位点 (p ∈ [0, 1])
export function quantile(values: number[], p: number): number | null {
  const sorted = finite(values).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  if (p <= 0) return sorted[0]
  if (p >= 1) return sorted[sorted.length - 1]
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// 全値を小さい順に並べた時、current より小さい値がいくつあるか（％）
// 仕様: 「現在値 = 最小値」なら 0%、「現在値 > 全ての値」なら 100%
export function percentile(values: number[], current: number): number | null {
  const sorted = finite(values).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  if (!Number.isFinite(current)) return null
  // 二分探索で「current 以上の値が初めて現れる位置」を見つける
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sorted[mid] < current) lo = mid + 1
    else hi = mid
  }
  return (lo / sorted.length) * 100
}
