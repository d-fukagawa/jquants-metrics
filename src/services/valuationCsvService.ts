import type {
  ValuationPeriod,
  ValuationRankingResult,
} from './valuationService'

const CSV_HEADERS = [
  '基準日',
  '比較期間',
  '比較日',
  '順位',
  'コード',
  '銘柄名',
  '市場',
  'TTM EPS',
  '会社予想EPS',
  '比較EPS',
  'EPS変化額',
  'EPS変化率(%)',
  '会社予想PER',
  '比較PER',
  'PER変化率(%)',
  '調整後終値',
  '比較終値',
  '株価変化率(%)',
  '選択期間 EPS変化率-株価変化率(pt)',
  '1か月 EPS変化率-株価変化率(pt)',
  '3か月 EPS変化率-株価変化率(pt)',
  '会社予想EPS対TTM(%)',
  'TTM ROE',
  '会社予想ROE',
  'ROE差(pt)',
  '時価総額(百万円)',
  '判定',
  '期間内決算開示',
  '株式分割等の可能性',
] as const

function escapeCsvField(value: string | number | boolean | null): string {
  if (value == null) return ''

  let text = typeof value === 'boolean' ? (value ? 'あり' : '') : String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`
  return text
}

export function serializeValuationRankingCsv(
  result: ValuationRankingResult,
  period: ValuationPeriod,
): string {
  const rows = result.rows.map(row => [
    result.date,
    period,
    row.comparisonDate,
    row.rank,
    row.code4,
    row.coName,
    row.market,
    row.epsTtm,
    row.epsCompanyForecast,
    row.previousEpsCompanyForecast,
    row.epsChange,
    row.epsChangePct,
    row.perCompanyForecast,
    row.previousPerCompanyForecast,
    row.perChangePct,
    row.close,
    row.previousClose,
    row.priceChangePct,
    row.epsPriceGapPct,
    row.epsPriceGap1mPct,
    row.epsPriceGap3mPct,
    row.forecastVsTtmEpsPct,
    row.roeTtm,
    row.roeCompanyForecast,
    row.roeImprovementPoint,
    row.marketCapMillion,
    row.judgment,
    row.hasFinancialDisclosure,
    row.corporateActionSuspected,
  ])

  return `\uFEFF${[CSV_HEADERS, ...rows]
    .map(row => row.map(escapeCsvField).join(','))
    .join('\r\n')}\r\n`
}
