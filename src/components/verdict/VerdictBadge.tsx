import type { VerdictColor } from '../../services/verdict/types'

interface Props {
  label: string
  color: VerdictColor
}

export function VerdictBadge({ label, color }: Props) {
  return (
    <span class={`verdict-badge verdict-cell--${color}`}>{label}</span>
  )
}
