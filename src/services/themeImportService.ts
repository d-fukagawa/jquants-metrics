import { and, eq, inArray, notInArray, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { stockMaster, themeStocks, themes } from '../db/schema'
import {
  THEME_RELEVANCE_VALUES,
  THEME_SOURCE_IMPORTED,
  THEME_SOURCE_MIXED,
  type ThemeStockRelevance,
  normalizeThemeCodeTo5,
} from './themeService'

const MAX_IMPORTED_THEME_STOCKS = 6
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface StockThemesPayload {
  schema_version: 1
  as_of: string
  themes_master: Array<{
    theme_id: string
    name: string
    description: string
    category: string
  }>
  stock_themes: Array<{
    theme_id: string
    code: string
    relevance: ThemeStockRelevance
    rationale: string
    source_url: string
  }>
}

interface NormalizedThemeMaster {
  themeId: string
  name: string
  description: string
  category: string
}

interface NormalizedStockTheme {
  themeId: string
  code: string
  relevance: ThemeStockRelevance
  rationale: string
  sourceUrl: string
}

interface NormalizedStockThemesPayload {
  asOf: string
  themes: NormalizedThemeMaster[]
  links: NormalizedStockTheme[]
}

export class ThemeImportError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new ThemeImportError(`${field} must be a string`)
  const trimmed = value.trim()
  if (!trimmed) throw new ThemeImportError(`${field} must not be empty`)
  return trimmed
}

function optionalString(value: unknown, field: string): string {
  if (value == null) return ''
  if (typeof value !== 'string') throw new ThemeImportError(`${field} must be a string`)
  return value.trim()
}

function requireHttpsUrl(value: unknown, field: string): string {
  const raw = requireString(value, field)
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new ThemeImportError(`${field} must be a valid URL`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ThemeImportError(`${field} must be an http(s) URL`)
  }
  return raw
}

function normalizeRelevance(value: unknown): ThemeStockRelevance {
  const raw = requireString(value, 'stock_themes[].relevance')
  if (!THEME_RELEVANCE_VALUES.includes(raw as ThemeStockRelevance)) {
    throw new ThemeImportError('stock_themes[].relevance must be core, related, or peripheral')
  }
  return raw as ThemeStockRelevance
}

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function normalizeStockThemesPayload(input: unknown): NormalizedStockThemesPayload {
  if (!isRecord(input)) throw new ThemeImportError('payload must be an object')
  if (input.schema_version !== 1) throw new ThemeImportError('schema_version must be 1')

  const asOf = requireString(input.as_of, 'as_of')
  if (!isValidDate(asOf)) throw new ThemeImportError('as_of must be YYYY-MM-DD')

  if (!Array.isArray(input.themes_master)) throw new ThemeImportError('themes_master must be an array')
  if (!Array.isArray(input.stock_themes)) throw new ThemeImportError('stock_themes must be an array')

  const themesList: NormalizedThemeMaster[] = []
  const themeIds = new Set<string>()
  for (const row of input.themes_master) {
    if (!isRecord(row)) throw new ThemeImportError('themes_master[] must be an object')
    const themeId = requireString(row.theme_id, 'themes_master[].theme_id')
    if (themeIds.has(themeId)) throw new ThemeImportError(`duplicate theme_id: ${themeId}`)
    themeIds.add(themeId)
    themesList.push({
      themeId,
      name: requireString(row.name, 'themes_master[].name'),
      description: optionalString(row.description, 'themes_master[].description'),
      category: optionalString(row.category, 'themes_master[].category'),
    })
  }

  if (themesList.length === 0) throw new ThemeImportError('themes_master must not be empty')

  const links: NormalizedStockTheme[] = []
  const pairKeys = new Set<string>()
  const countsByTheme = new Map<string, number>()

  for (const row of input.stock_themes) {
    if (!isRecord(row)) throw new ThemeImportError('stock_themes[] must be an object')
    const themeId = requireString(row.theme_id, 'stock_themes[].theme_id')
    if (!themeIds.has(themeId)) throw new ThemeImportError(`unknown stock_themes[].theme_id: ${themeId}`)

    const code = normalizeThemeCodeTo5(requireString(row.code, 'stock_themes[].code'))
    if (!code) throw new ThemeImportError(`invalid stock_themes[].code: ${String(row.code)}`)

    const pairKey = `${themeId}:${code}`
    if (pairKeys.has(pairKey)) throw new ThemeImportError(`duplicate stock theme pair: ${pairKey}`)
    pairKeys.add(pairKey)

    countsByTheme.set(themeId, (countsByTheme.get(themeId) ?? 0) + 1)
    links.push({
      themeId,
      code,
      relevance: normalizeRelevance(row.relevance),
      rationale: requireString(row.rationale, 'stock_themes[].rationale'),
      sourceUrl: requireHttpsUrl(row.source_url, 'stock_themes[].source_url'),
    })
  }

  for (const theme of themesList) {
    const count = countsByTheme.get(theme.themeId) ?? 0
    if (count === 0) throw new ThemeImportError(`theme has no stock links: ${theme.themeId}`)
    if (count > MAX_IMPORTED_THEME_STOCKS) {
      throw new ThemeImportError(`theme has more than ${MAX_IMPORTED_THEME_STOCKS} stock links: ${theme.themeId}`)
    }
  }

  return { asOf, themes: themesList, links }
}

export async function importStockThemes(
  db: Db,
  payload: StockThemesPayload | unknown,
): Promise<{ themes: number; links: number; skippedUserLinks: number }> {
  const normalized = normalizeStockThemesPayload(payload)
  const now = new Date()
  const uniqueCodes = Array.from(new Set(normalized.links.map(link => link.code)))

  const stockRows = await db
    .select({ code: stockMaster.code })
    .from(stockMaster)
    .where(inArray(stockMaster.code, uniqueCodes))
  const foundCodes = new Set(stockRows.map(row => row.code))
  const missingCodes = uniqueCodes.filter(code => !foundCodes.has(code))
  if (missingCodes.length > 0) {
    throw new ThemeImportError(`stock_master missing codes: ${missingCodes.join(', ')}`)
  }

  let linkUpsertCount = 0
  let skippedUserLinks = 0

  for (const theme of normalized.themes) {
    const [existing] = await db
      .select({
        id: themes.id,
        sourceType: themes.sourceType,
      })
      .from(themes)
      .where(eq(themes.externalKey, theme.themeId))
      .limit(1)

    let themeId = existing?.id
    if (!themeId) {
      themeId = crypto.randomUUID()
      await db.insert(themes).values({
        id: themeId,
        name: theme.name,
        memo: theme.description,
        externalKey: theme.themeId,
        sourceType: THEME_SOURCE_IMPORTED,
        importedAt: now,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      await db
        .update(themes)
        .set({
          ...(existing.sourceType === THEME_SOURCE_IMPORTED ? { name: theme.name } : {}),
          sourceType: existing.sourceType === THEME_SOURCE_IMPORTED ? THEME_SOURCE_IMPORTED : THEME_SOURCE_MIXED,
          importedAt: now,
          updatedAt: now,
        })
        .where(eq(themes.id, themeId))
    }

    const themeLinks = normalized.links.filter(link => link.themeId === theme.themeId)
    const desiredCodes = themeLinks.map(link => link.code)
    const existingLinks = await db
      .select({
        code: themeStocks.code,
        sourceType: themeStocks.sourceType,
      })
      .from(themeStocks)
      .where(and(
        eq(themeStocks.themeId, themeId),
        inArray(themeStocks.code, desiredCodes),
      ))
    const sourceTypeByCode = new Map(existingLinks.map(link => [link.code, link.sourceType]))
    const rowsToUpsert = themeLinks
      .filter(link => {
        const sourceType = sourceTypeByCode.get(link.code)
        if (sourceType && sourceType !== THEME_SOURCE_IMPORTED) {
          skippedUserLinks += 1
          return false
        }
        return true
      })
      .map((link, index) => ({
        themeId,
        code: link.code,
        sortOrder: index,
        relevance: link.relevance,
        rationale: link.rationale,
        sourceUrl: link.sourceUrl,
        sourceType: THEME_SOURCE_IMPORTED,
        createdAt: now,
        updatedAt: now,
      }))

    if (rowsToUpsert.length > 0) {
      await db
        .insert(themeStocks)
        .values(rowsToUpsert)
        .onConflictDoUpdate({
          target: [themeStocks.themeId, themeStocks.code],
          set: {
            sortOrder: sql`excluded.sort_order`,
            relevance: sql`excluded.relevance`,
            rationale: sql`excluded.rationale`,
            sourceUrl: sql`excluded.source_url`,
            sourceType: sql`excluded.source_type`,
            updatedAt: sql`excluded.updated_at`,
          },
        })
      linkUpsertCount += rowsToUpsert.length
    }

    await db
      .delete(themeStocks)
      .where(and(
        eq(themeStocks.themeId, themeId),
        eq(themeStocks.sourceType, THEME_SOURCE_IMPORTED),
        notInArray(themeStocks.code, desiredCodes),
      ))
  }

  return {
    themes: normalized.themes.length,
    links: linkUpsertCount,
    skippedUserLinks,
  }
}
