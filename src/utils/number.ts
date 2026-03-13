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

export function toNullableString(value: string | null | undefined): string | null {
  return value == null || value === '' ? null : value
}
