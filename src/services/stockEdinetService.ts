import { desc, eq, sql, SQL } from 'drizzle-orm'
import type { Db } from '../db/client'
import { parseNumber } from '../utils/number'
import { parseCode4, toCode5 } from '../utils/stockCode'
import {
  edinetBridgeFacts,
  edinetFilings,
  edinetForecasts,
  edinetQualityScores,
  edinetTextScores,
} from '../db/schema'

export async function getDisclosureTimeline(db: Db, code5: string, limit = 20) {
  return db
    .select()
    .from(edinetFilings)
    .where(eq(edinetFilings.code, code5))
    .orderBy(desc(edinetFilings.filingDate), desc(edinetFilings.submittedAt))
    .limit(limit)
}

export async function getLatestForecasts(db: Db, code5: string) {
  const rows = await db
    .select()
    .from(edinetForecasts)
    .where(eq(edinetForecasts.code, code5))
    .orderBy(desc(edinetForecasts.disclosedAt), desc(edinetForecasts.updatedAt))

  const next = rows.find(r => r.horizon === 'next') ?? null
  const next2 = rows.find(r => r.horizon === 'next2') ?? null
  return { next, next2 }
}

export async function getLatestBridgeFact(db: Db, code5: string) {
  const rows = await db
    .select()
    .from(edinetBridgeFacts)
    .where(eq(edinetBridgeFacts.code, code5))
    .orderBy(desc(edinetBridgeFacts.disclosedAt), desc(edinetBridgeFacts.updatedAt))
    .limit(1)
  return rows[0] ?? null
}

export async function getLatestQualityScore(db: Db, code5: string) {
  const rows = await db
    .select()
    .from(edinetQualityScores)
    .where(eq(edinetQualityScores.code, code5))
    .orderBy(desc(edinetQualityScores.asOfDate))
    .limit(1)
  return rows[0] ?? null
}

export async function getLatestTextScore(db: Db, code5: string) {
  const rows = await db
    .select()
    .from(edinetTextScores)
    .where(eq(edinetTextScores.code, code5))
    .orderBy(desc(edinetTextScores.asOfDate))
    .limit(1)
  return rows[0] ?? null
}

export interface TimelineFilters {
  dateFrom?: string
  dateTo?: string
  eventType?: string[]
  code?: string
  page?: number
  pageSize?: number
}

export async function listTimelineEvents(db: Db, filters: TimelineFilters) {
  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.max(1, Math.min(filters.pageSize ?? 50, 100))

  const conds: SQL[] = []
  if (filters.dateFrom) conds.push(sql`${edinetFilings.filingDate} >= ${filters.dateFrom}`)
  if (filters.dateTo) conds.push(sql`${edinetFilings.filingDate} <= ${filters.dateTo}`)
  if (filters.eventType && filters.eventType.length > 0) {
    const vals = sql.join(filters.eventType.map(v => sql`${v}`), sql`, `)
    conds.push(sql`${edinetFilings.eventType} = ANY(ARRAY[${vals}]::text[])`)
  }
  const code4 = parseCode4(filters.code)
  if (code4) conds.push(sql`${edinetFilings.code} = ${toCode5(code4)}`)
  const whereClause = conds.length > 0 ? sql.join(conds, sql` AND `) : sql`TRUE`

  const result = await db.execute(sql`
    SELECT *
    FROM edinet_filings
    WHERE ${whereClause}
    ORDER BY filing_date DESC, submitted_at DESC NULLS LAST
    LIMIT ${pageSize}
    OFFSET ${(page - 1) * pageSize}
  `)
  const raw = result.rows as Record<string, unknown>[]
  return raw.map(r => ({
    edinetCode: String(r.edinet_code ?? ''),
    docId: String(r.doc_id ?? ''),
    code: r.code != null ? String(r.code) : null,
    filingDate: String(r.filing_date ?? ''),
    eventType: String(r.event_type ?? ''),
    title: String(r.title ?? ''),
    isAmendment: Boolean(r.is_amendment),
    submittedAt: r.submitted_at != null ? String(r.submitted_at) : null,
    sourceUpdatedAt: r.source_updated_at != null ? String(r.source_updated_at) : null,
  }))
}

export interface AlphaFilters {
  asOf?: string
  metric?: 'sales' | 'op' | 'np'
  minSurprisePct?: number
  limit?: number
  page?: number
}

export async function listAlphaSurprises(db: Db, filters: AlphaFilters) {
  const metric = filters.metric ?? 'op'
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 100))
  const page = Math.max(1, filters.page ?? 1)
  const rows = await db
    .select()
    .from(edinetForecasts)
    .orderBy(desc(edinetForecasts.disclosedAt))
    .limit(300)

  const mapped = rows.map(r => {
    const forecast = metric === 'sales'
      ? parseNumber(r.salesForecast)
      : metric === 'np'
        ? parseNumber(r.npForecast)
        : parseNumber(r.opForecast)

    // MVP: 実績値は bridge の net/op を代用して差分率を算出
    return { r, forecast }
  })
  const bridge = await db
    .select()
    .from(edinetBridgeFacts)
    .orderBy(desc(edinetBridgeFacts.disclosedAt))
    .limit(500)
  const latestByCode = new Map<string, typeof bridge[number]>()
  for (const b of bridge) {
    if (!latestByCode.has(b.code)) latestByCode.set(b.code, b)
  }

  const out = mapped.map(m => {
    const fact = latestByCode.get(m.r.code)
    const actual = metric === 'sales'
      ? null
      : metric === 'np'
        ? parseNumber(fact?.netProfit ?? null)
        : parseNumber(fact?.operatingProfit ?? null)
    let surprisePct: number | null = null
    if (m.forecast != null && m.forecast !== 0 && actual != null) {
      surprisePct = Math.round(((actual - m.forecast) / Math.abs(m.forecast)) * 1000) / 10
    }
    return {
      code: m.r.code,
      horizon: m.r.horizon,
      disclosedAt: m.r.disclosedAt,
      metric,
      forecast: m.forecast,
      actual,
      surprisePct,
    }
  })
    .filter(r => r.surprisePct != null && (filters.minSurprisePct == null || (r.surprisePct ?? 0) >= filters.minSurprisePct))
    .sort((a, b) => (b.surprisePct ?? -999) - (a.surprisePct ?? -999))

  const start = (page - 1) * limit
  return { rows: out.slice(start, start + limit), total: out.length }
}
