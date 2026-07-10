import type { DailyRankingResult } from './dailyRankingService'

const CSV_HEADERS = [
  '対象日',
  '比較日',
  '表示順位',
  '市場内順位',
  '業種33内順位',
  'コード',
  '銘柄名',
  '市場',
  '業種17分類',
  '業種33分類',
  '規模区分',
  '調整後終値',
  '前日比',
  '騰落率(%)',
  '売買代金(円)',
  '売買代金20日平均(円)',
  '売買代金20日平均比',
  '時価総額(円)',
] as const

function escapeCsvField(value: string | number | null): string {
  if (value == null) return ''

  let text = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function serializeDailyRankingCsv(result: DailyRankingResult): string {
  const rows = result.rows.map(row => [
    result.date,
    result.previousDate,
    row.rank,
    row.marketRank,
    row.sectorRank,
    row.code4,
    row.coName,
    row.market,
    row.sector17Name,
    row.sector33Name,
    row.scaleCategory,
    row.close,
    row.change,
    row.changePct,
    row.turnover,
    row.turnover20dAverage,
    row.turnover20dRatio,
    row.marketCap,
  ])

  return `\uFEFF${[CSV_HEADERS, ...rows]
    .map(row => row.map(escapeCsvField).join(','))
    .join('\r\n')}\r\n`
}
