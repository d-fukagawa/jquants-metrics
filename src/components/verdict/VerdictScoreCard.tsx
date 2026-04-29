import type { Judgment } from '../../services/verdict/types'
import { VerdictBadge } from './VerdictBadge'

interface Props {
  title: string
  score: number | null
  judgment: Judgment
  note?: string
}

export function VerdictScoreCard({ title, score, judgment, note }: Props) {
  const formatted = score === null ? '—' : (score >= 0 ? '+' : '') + score.toFixed(2)
  return (
    <div class="verdict-score-card">
      <div class="verdict-score-title">{title}</div>
      <div class={`verdict-score-value verdict-cell--${judgment.color}`}>{formatted}</div>
      <div class="verdict-score-judgment"><VerdictBadge label={judgment.label} color={judgment.color} /></div>
      {note && <div class="verdict-score-note">{note}</div>}
    </div>
  )
}
