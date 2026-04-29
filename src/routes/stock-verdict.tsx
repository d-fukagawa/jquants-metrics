import { Hono } from 'hono'
import type { Bindings } from '../types'
import { createDb } from '../db/client'
import { computeVerdict } from '../services/verdict/result'
import type { MetricId } from '../services/verdict/types'
import { METRIC_GROUPS } from '../services/verdict/types'
import { PHASE1_METRIC_IDS } from '../services/verdict/weights'
import { VerdictHeader } from '../components/verdict/VerdictHeader'
import { VerdictScoreCard } from '../components/verdict/VerdictScoreCard'
import { VerdictTable } from '../components/verdict/VerdictTable'
import { parseCode4, toCode4, toCode5 } from '../utils/stockCode'

export const stockVerdictRoute = new Hono<{ Bindings: Bindings }>()

const PHASE1_BASIC = PHASE1_METRIC_IDS.filter((id) => METRIC_GROUPS[id] === 'basic') as ReadonlyArray<MetricId>
const PHASE1_COMPOSITE = PHASE1_METRIC_IDS.filter((id) => METRIC_GROUPS[id] === 'composite') as ReadonlyArray<MetricId>
const PHASE1_FINANCIAL = PHASE1_METRIC_IDS.filter((id) => METRIC_GROUPS[id] === 'financial') as ReadonlyArray<MetricId>

stockVerdictRoute.get('/:code/verdict', async (c) => {
  const code4 = parseCode4(c.req.param('code'))
  if (!code4) {
    return c.html('<p>不正なコードです。4桁の英数字を指定してください。</p>', 400)
  }
  const code5 = toCode5(code4)
  const db = createDb(c.env.DATABASE_URL)

  const result = await computeVerdict(db, code5)
  if (!result) {
    return c.html('<p>銘柄が見つかりません。先に /api/sync で master データを同期してください。</p>', 404)
  }

  const code4display = toCode4(result.code)

  return c.render(
    <div class="verdict-page">
      <nav class="breadcrumb">
        <a href="/">ホーム</a>
        <span>/</span>
        <a href={`/stock/${code4display}`}>{code4display} {result.name}</a>
        <span>/</span>
        <span>バリュエーション判定</span>
      </nav>

      <div class="verdict-tabs">
        <a class="btn-sm" href={`/stock/${code4display}`}>概要</a>
        <a class="btn-sm active" href={`/stock/${code4display}/verdict`}>バリュエーション判定</a>
      </div>

      <h1 class="verdict-page-title">バリュエーション判定 <span class="verdict-subtitle">時系列パーセンタイル × 加重平均</span></h1>

      <VerdictHeader result={result} />

      {PHASE1_BASIC.length > 0 && (
        <VerdictTable title="① 基本指標" metricIds={PHASE1_BASIC} result={result} />
      )}
      {PHASE1_COMPOSITE.length > 0 && (
        <VerdictTable title="② 複合指標" metricIds={PHASE1_COMPOSITE} result={result} />
      )}
      {PHASE1_FINANCIAL.length > 0 && (
        <VerdictTable title="③ 財務指標" metricIds={PHASE1_FINANCIAL} result={result} />
      )}

      <div class="section-title">④ 総合評価</div>
      <div class="verdict-score-grid">
        <VerdictScoreCard
          title="バリュエーションスコア（実績）"
          score={result.totalScore.actual}
          judgment={result.totalJudgment.actual}
          note="Phase 1: 利用可能な指標で重みを再正規化"
        />
        <VerdictScoreCard
          title="バリュエーションスコア（予想込み）"
          score={result.totalScore.forecast}
          judgment={result.totalJudgment.forecast}
          note="Phase 3 で `edinet_forecasts` から自動取得予定"
        />
      </div>

      <footer class="verdict-footnotes">
        <div class="verdict-footnote-title">注釈</div>
        <ul>
          <li>※1 ネットキャッシュ比率 = (流動資産 + 投資有価証券×0.7 − 負債) / 時価総額</li>
          <li>※2 クアドラ配当係数：配当利回りを考慮した割安指標</li>
          <li>※3 BPSは IFRS 中間で空のとき自己資本/(発行済 − 自己株) で代替</li>
          <li>※4 手入力 or 自動 Forward PER／配当利回り（Phase 3 で対応）</li>
          <li>※5 現在 or 3年前のEPSが赤字の場合は「NaN」</li>
          <li>※6 バリュエーションスコア = 各指標スコアの加重平均（−6〜＋6）</li>
          <li>※7 パーセンタイル：全ての値を小さい順に並べた際に「現在値」が下から何パーセントの位置にあるかを示す</li>
        </ul>
      </footer>
    </div>,
    { wide: true },
  )
})
