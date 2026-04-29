import type { VerdictResult } from '../../services/verdict/types'

interface Props {
  result: VerdictResult
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

export function VerdictHeader({ result }: Props) {
  const { groupWeights, dataPeriod } = result
  return (
    <div class="verdict-header">
      <div class="verdict-header-row">
        <span class="verdict-header-label">コード</span>
        <span class="verdict-header-value">{result.code4}</span>
        <span class="verdict-header-label">銘柄名</span>
        <span class="verdict-header-value">{result.name}</span>
      </div>
      <div class="verdict-header-row">
        <span class="verdict-header-label">データ期間</span>
        <span class="verdict-header-value">{dataPeriod.from} 〜 {dataPeriod.to}</span>
        <span class="verdict-header-label">基準日</span>
        <span class="verdict-header-value">{result.asOf}</span>
      </div>
      <div class="verdict-header-row">
        <span class="verdict-header-label">モード</span>
        <span class="verdict-header-value">バランス型（総合スコア &gt; 2.0 が理想形）</span>
      </div>
      <div class="verdict-header-row">
        <span class="verdict-header-label">重み配分</span>
        <span class="verdict-header-value">
          基本 {pct(groupWeights.basic)} | 複合 {pct(groupWeights.composite)} | 財務 {pct(groupWeights.financial)}
        </span>
      </div>
    </div>
  )
}
