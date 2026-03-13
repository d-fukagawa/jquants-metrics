const CODE4_RE = /^[0-9A-Z]{4}$/

export function normalizeCode4(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase()
}

export function parseCode4(value: string | null | undefined): string | null {
  const normalized = normalizeCode4(value)
  return CODE4_RE.test(normalized) ? normalized : null
}

export function toCode5(code4: string): string {
  return `${code4}0`
}

export function toCode4(code5: string): string {
  return code5.slice(0, 4)
}
