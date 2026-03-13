// Return YYYY-MM-DD list inclusive.
export function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = []
  const end = new Date(to)
  for (const d = new Date(from); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}
