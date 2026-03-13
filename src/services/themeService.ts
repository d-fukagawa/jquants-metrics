import { and, asc, desc, eq, gte, ilike, inArray, lte, notInArray, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { dailyPrices, stockMaster, themeStocks, themes } from '../db/schema'
import { parseCode4, toCode4, toCode5 } from '../utils/stockCode'

const MAX_THEME_NAME_LEN = 100
const MAX_THEME_MEMO_LEN = 10_000
const MAX_THEME_STOCKS = 6

export type ThemeGranularity = 'd' | 'w' | 'm'

export type ThemeInput = {
  name: string
  memo: string
  codes: string[]
}

export type Theme = {
  id: string
  name: string
  memo: string
  createdAt: Date
  updatedAt: Date
}

export type ThemeStock = {
  themeId: string
  code: string
  code4: string
  sortOrder: number
  coName: string | null
  mktNm: string | null
}

export type ThemeListRow = {
  id: string
  name: string
  memo: string
  stockCount: number
  createdAt: Date
  updatedAt: Date
}

export type OhlcvPoint = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type ThemeSeries = {
  code: string
  code4: string
  name: string
  bars: OhlcvPoint[]
}

export class ThemeInputError extends Error {}

type NormalizedThemeInput = {
  name: string
  memo: string
  codes5: string[]
}

function normalizeCodeTo5(raw: string): string | null {
  const value = raw.trim().toUpperCase()
  if (!value) return null
  if (value.length === 5 && value.endsWith('0')) {
    const code4 = parseCode4(value.slice(0, 4))
    return code4 ? value : null
  }
  const code4 = parseCode4(value)
  return code4 ? toCode5(code4) : null
}

export function normalizeThemeInput(input: ThemeInput): NormalizedThemeInput {
  const name = input.name.trim().slice(0, MAX_THEME_NAME_LEN)
  const memo = input.memo.trim().slice(0, MAX_THEME_MEMO_LEN)

  if (!name) throw new ThemeInputError('テーマ名は必須です')
  if (input.codes.length === 0) throw new ThemeInputError('テーマ銘柄を1件以上指定してください')
  if (input.codes.length > MAX_THEME_STOCKS) throw new ThemeInputError(`テーマ銘柄は最大${MAX_THEME_STOCKS}件です`)

  const codes5: string[] = []
  const seen = new Set<string>()
  for (const codeRaw of input.codes) {
    const code5 = normalizeCodeTo5(codeRaw)
    if (!code5) throw new ThemeInputError(`不正な銘柄コードです: ${codeRaw}`)
    if (seen.has(code5)) throw new ThemeInputError('テーマ銘柄に重複があります')
    seen.add(code5)
    codes5.push(code5)
  }

  return { name, memo, codes5 }
}

async function ensureStocksExist(db: Db, codes5: string[]): Promise<void> {
  const rows = await db
    .select({ code: stockMaster.code })
    .from(stockMaster)
    .where(inArray(stockMaster.code, codes5))
  const found = new Set(rows.map(r => r.code))
  const missing = codes5.filter(code => !found.has(code))
  if (missing.length > 0) {
    throw new ThemeInputError(`銘柄マスタ未登録です: ${missing.map(toCode4).join(', ')}`)
  }
}

export async function listThemes(db: Db): Promise<ThemeListRow[]> {
  const result = await db.execute(sql`
    SELECT
      t.id,
      t.name,
      t.memo,
      t.created_at,
      t.updated_at,
      COUNT(ts.code)::int AS stock_count
    FROM themes t
    LEFT JOIN theme_stocks ts
      ON ts.theme_id = t.id
    GROUP BY t.id
    ORDER BY t.updated_at DESC
  `)
  return (result.rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    memo: String(row.memo ?? ''),
    stockCount: Number(row.stock_count ?? 0),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  }))
}

export async function getThemeById(db: Db, themeId: string): Promise<Theme | null> {
  const [row] = await db
    .select()
    .from(themes)
    .where(eq(themes.id, themeId))
    .limit(1)
  if (!row) return null
  return row
}

export async function listThemeStocks(db: Db, themeId: string): Promise<ThemeStock[]> {
  const rows = await db
    .select({
      themeId: themeStocks.themeId,
      code: themeStocks.code,
      sortOrder: themeStocks.sortOrder,
      coName: stockMaster.coName,
      mktNm: stockMaster.mktNm,
    })
    .from(themeStocks)
    .leftJoin(stockMaster, eq(stockMaster.code, themeStocks.code))
    .where(eq(themeStocks.themeId, themeId))
    .orderBy(asc(themeStocks.sortOrder))

  return rows.map(row => ({
    themeId: row.themeId,
    code: row.code,
    code4: toCode4(row.code),
    sortOrder: row.sortOrder,
    coName: row.coName ?? null,
    mktNm: row.mktNm ?? null,
  }))
}

export async function getThemeDetail(db: Db, themeId: string): Promise<{ theme: Theme; stocks: ThemeStock[] } | null> {
  const theme = await getThemeById(db, themeId)
  if (!theme) return null
  const stocks = await listThemeStocks(db, themeId)
  return { theme, stocks }
}

export async function createTheme(db: Db, input: ThemeInput): Promise<string> {
  const normalized = normalizeThemeInput(input)
  await ensureStocksExist(db, normalized.codes5)

  const now = new Date()
  const themeId = crypto.randomUUID()

  await db.insert(themes).values({
    id: themeId,
    name: normalized.name,
    memo: normalized.memo,
    createdAt: now,
    updatedAt: now,
  })

  try {
    await db.insert(themeStocks).values(
      normalized.codes5.map((code, i) => ({
        themeId,
        code,
        sortOrder: i,
        createdAt: now,
      })),
    )
  } catch (error) {
    // Best-effort rollback for non-transaction drivers (neon-http).
    await db.delete(themes).where(eq(themes.id, themeId))
    throw error
  }

  return themeId
}

export async function updateTheme(db: Db, themeId: string, input: ThemeInput): Promise<boolean> {
  const normalized = normalizeThemeInput(input)
  await ensureStocksExist(db, normalized.codes5)
  const now = new Date()

  const updated = await db
    .update(themes)
    .set({
      name: normalized.name,
      memo: normalized.memo,
      updatedAt: now,
    })
    .where(eq(themes.id, themeId))
    .returning({ id: themes.id })
  if (updated.length === 0) return false

  await db
    .insert(themeStocks)
    .values(
      normalized.codes5.map((code, i) => ({
        themeId,
        code,
        sortOrder: i,
        createdAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [themeStocks.themeId, themeStocks.code],
      set: {
        sortOrder: sql`excluded.sort_order`,
      },
    })

  await db
    .delete(themeStocks)
    .where(and(
      eq(themeStocks.themeId, themeId),
      notInArray(themeStocks.code, normalized.codes5),
    ))

  return true
}

export async function updateThemeMemo(db: Db, themeId: string, memo: string): Promise<boolean> {
  const normalizedMemo = memo.trim().slice(0, MAX_THEME_MEMO_LEN)
  const updated = await db
    .update(themes)
    .set({
      memo: normalizedMemo,
      updatedAt: new Date(),
    })
    .where(eq(themes.id, themeId))
    .returning({ id: themes.id })
  return updated.length > 0
}

export async function deleteTheme(db: Db, themeId: string): Promise<boolean> {
  await db.delete(themeStocks).where(eq(themeStocks.themeId, themeId))
  const deleted = await db
    .delete(themes)
    .where(eq(themes.id, themeId))
    .returning({ id: themes.id })
  return deleted.length > 0
}

function weekStartMonday(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function periodStart(date: string, granularity: ThemeGranularity): string {
  if (granularity === 'w') return weekStartMonday(date)
  if (granularity === 'm') return monthStart(date)
  return date
}

export function aggregateBars(points: OhlcvPoint[], granularity: ThemeGranularity): OhlcvPoint[] {
  if (granularity === 'd') return points.map(p => ({ ...p }))

  const out: OhlcvPoint[] = []
  let currentKey = ''

  for (const p of points) {
    const key = periodStart(p.date, granularity)
    if (key !== currentKey) {
      out.push({
        date: key,
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
        volume: p.volume,
      })
      currentKey = key
      continue
    }

    const last = out[out.length - 1]
    last.high = Math.max(last.high, p.high)
    last.low = Math.min(last.low, p.low)
    last.close = p.close
    last.volume += p.volume
  }

  return out
}

export async function listThemeSeries(
  db: Db,
  stocks: ThemeStock[],
  from: string,
  to: string,
  granularity: ThemeGranularity,
): Promise<ThemeSeries[]> {
  if (stocks.length === 0) return []
  const codes = stocks.map(s => s.code)

  const rows = await db
    .select({
      code: dailyPrices.code,
      date: dailyPrices.date,
      adjOpen: dailyPrices.adjOpen,
      adjHigh: dailyPrices.adjHigh,
      adjLow: dailyPrices.adjLow,
      adjClose: dailyPrices.adjClose,
      volume: dailyPrices.volume,
    })
    .from(dailyPrices)
    .where(and(
      inArray(dailyPrices.code, codes),
      gte(dailyPrices.date, from),
      lte(dailyPrices.date, to),
    ))
    .orderBy(asc(dailyPrices.date), asc(dailyPrices.code))

  const byCode = new Map<string, OhlcvPoint[]>()
  for (const code of codes) byCode.set(code, [])

  for (const row of rows) {
    const open = row.adjOpen != null ? Number(row.adjOpen) : null
    const high = row.adjHigh != null ? Number(row.adjHigh) : null
    const low = row.adjLow != null ? Number(row.adjLow) : null
    const close = row.adjClose != null ? Number(row.adjClose) : null
    if (
      open == null || high == null || low == null || close == null ||
      !Number.isFinite(open) || !Number.isFinite(high) ||
      !Number.isFinite(low) || !Number.isFinite(close)
    ) {
      continue
    }
    const volume = row.volume != null && Number.isFinite(Number(row.volume)) ? Number(row.volume) : 0
    byCode.get(row.code)?.push({
      date: row.date,
      open,
      high,
      low,
      close,
      volume,
    })
  }

  return stocks.map((stock) => ({
    code: stock.code,
    code4: stock.code4,
    name: stock.coName ?? stock.code4,
    bars: aggregateBars(byCode.get(stock.code) ?? [], granularity),
  }))
}

export async function listThemeCandidates(db: Db, q: string): Promise<Array<{ code: string; code4: string; coName: string; mktNm: string }>> {
  const pattern = `%${q}%`
  const rows = await db
    .select({
      code: stockMaster.code,
      coName: stockMaster.coName,
      mktNm: stockMaster.mktNm,
    })
    .from(stockMaster)
    .where(or(
      ilike(stockMaster.code, pattern),
      ilike(stockMaster.coName, pattern),
      ilike(stockMaster.coNameEn, pattern),
    ))
    .orderBy(desc(stockMaster.updatedAt))
    .limit(20)

  return rows.map(row => ({
    code: row.code,
    code4: toCode4(row.code),
    coName: row.coName,
    mktNm: row.mktNm,
  }))
}
