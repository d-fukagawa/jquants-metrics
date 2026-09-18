export function parseNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return Number.isFinite(value) ? value : null
}

export function parseOptionalNumber(value: string | number | null | undefined): number | undefined {
  const n = parseNumber(value)
  return n === null ? undefined : n
}

export function toNullableString(value: string | number | null | undefined): string | null {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
