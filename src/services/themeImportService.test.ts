import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Db } from '../db/client'
import { ThemeImportError, importStockThemes, normalizeStockThemesPayload } from './themeImportService'

const payload = {
  schema_version: 1,
  as_of: '2026-06-15',
  themes_master: [
    {
      theme_id: 'ai-semiconductor',
      name: 'AI半導体',
      description: 'AI向け半導体・製造装置・材料',
      category: 'technology',
    },
  ],
  stock_themes: [
    {
      theme_id: 'ai-semiconductor',
      code: '8035',
      relevance: 'core',
      rationale: '半導体製造装置の主力企業。',
      source_url: 'https://example.com/8035',
    },
    {
      theme_id: 'ai-semiconductor',
      code: '68570',
      relevance: 'related',
      rationale: '検査装置で関連。',
      source_url: 'https://example.com/6857',
    },
  ],
} as const

describe('themeImportService normalizeStockThemesPayload', () => {
  it('normalizes stock codes to 5-digit strings', () => {
    const normalized = normalizeStockThemesPayload(payload)
    expect(normalized.links.map(link => link.code)).toEqual(['80350', '68570'])
  })

  it('rejects themes with more than 6 stock links', () => {
    expect(() => normalizeStockThemesPayload({
      ...payload,
      stock_themes: ['1301', '1332', '1333', '1375', '1376', '1377', '1379'].map(code => ({
        theme_id: 'ai-semiconductor',
        code,
        relevance: 'related',
        rationale: '関連銘柄。',
        source_url: `https://example.com/${code}`,
      })),
    })).toThrow(ThemeImportError)
  })

  it('rejects links to unknown themes', () => {
    expect(() => normalizeStockThemesPayload({
      ...payload,
      stock_themes: [
        {
          theme_id: 'unknown',
          code: '80350',
          relevance: 'core',
          rationale: '関連銘柄。',
          source_url: 'https://example.com/8035',
        },
      ],
    })).toThrow(ThemeImportError)
  })
})

describe('themeImportService importStockThemes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a new imported theme and upserts imported stock links', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('theme-1' as ReturnType<Crypto['randomUUID']>)

    const stockWhere = vi.fn().mockResolvedValue([{ code: '80350' }, { code: '68570' }])
    const themeLimit = vi.fn().mockResolvedValue([])
    const themeWhere = vi.fn().mockReturnValue({ limit: themeLimit })
    const existingLinksWhere = vi.fn().mockResolvedValue([])
    const select = vi.fn()
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: stockWhere }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: themeWhere }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: existingLinksWhere }) })

    const insertThemeValues = vi.fn().mockResolvedValue(undefined)
    const linkOnConflict = vi.fn().mockResolvedValue(undefined)
    const insertLinkValues = vi.fn().mockReturnValue({ onConflictDoUpdate: linkOnConflict })
    const insert = vi.fn()
      .mockReturnValueOnce({ values: insertThemeValues })
      .mockReturnValueOnce({ values: insertLinkValues })

    const deleteWhere = vi.fn().mockResolvedValue(undefined)
    const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere })

    const db = { select, insert, delete: deleteFn } as unknown as Db
    const result = await importStockThemes(db, payload)

    expect(result).toEqual({ themes: 1, links: 2, skippedUserLinks: 0 })
    expect(insertThemeValues).toHaveBeenCalledWith(expect.objectContaining({
      id: 'theme-1',
      externalKey: 'ai-semiconductor',
      sourceType: 'imported',
    }))
    expect(insertLinkValues).toHaveBeenCalledWith([
      expect.objectContaining({ themeId: 'theme-1', code: '80350', relevance: 'core', sourceType: 'imported' }),
      expect.objectContaining({ themeId: 'theme-1', code: '68570', relevance: 'related', sourceType: 'imported' }),
    ])
    expect(linkOnConflict).toHaveBeenCalledTimes(1)
    expect(deleteFn).toHaveBeenCalledTimes(1)
  })

  it('does not overwrite user-managed stock links on reimport', async () => {
    const stockWhere = vi.fn().mockResolvedValue([{ code: '80350' }, { code: '68570' }])
    const themeLimit = vi.fn().mockResolvedValue([{ id: 'theme-1', sourceType: 'mixed' }])
    const themeWhere = vi.fn().mockReturnValue({ limit: themeLimit })
    const existingLinksWhere = vi.fn().mockResolvedValue([
      { code: '80350', sourceType: 'user' },
      { code: '68570', sourceType: 'imported' },
    ])
    const select = vi.fn()
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: stockWhere }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: themeWhere }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: existingLinksWhere }) })

    const updateWhere = vi.fn().mockResolvedValue(undefined)
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere })
    const update = vi.fn().mockReturnValue({ set: updateSet })

    const linkOnConflict = vi.fn().mockResolvedValue(undefined)
    const insertLinkValues = vi.fn().mockReturnValue({ onConflictDoUpdate: linkOnConflict })
    const insert = vi.fn().mockReturnValue({ values: insertLinkValues })

    const deleteWhere = vi.fn().mockResolvedValue(undefined)
    const deleteFn = vi.fn().mockReturnValue({ where: deleteWhere })

    const db = { select, update, insert, delete: deleteFn } as unknown as Db
    const result = await importStockThemes(db, payload)

    expect(result).toEqual({ themes: 1, links: 1, skippedUserLinks: 1 })
    expect(insertLinkValues).toHaveBeenCalledWith([
      expect.objectContaining({ code: '68570', sourceType: 'imported' }),
    ])
  })
})
