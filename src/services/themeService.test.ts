import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ThemeInputError,
  aggregateBars,
  createTheme,
  deleteTheme,
  normalizeThemeInput,
  periodStart,
  updateTheme,
} from './themeService'
import type { Db } from '../db/client'

describe('themeService normalizeThemeInput', () => {
  it('converts 4-digit codes into 5-digit codes', () => {
    const normalized = normalizeThemeInput({
      name: '半導体',
      memo: ' test memo ',
      codes: ['7203', '67580'],
    })
    expect(normalized.name).toBe('半導体')
    expect(normalized.memo).toBe('test memo')
    expect(normalized.codes5).toEqual(['72030', '67580'])
  })

  it('rejects duplicate codes', () => {
    expect(() => normalizeThemeInput({
      name: 'テーマA',
      memo: '',
      codes: ['7203', '72030'],
    })).toThrow(ThemeInputError)
  })

  it('rejects when stock count exceeds 6', () => {
    expect(() => normalizeThemeInput({
      name: 'テーマA',
      memo: '',
      codes: ['1301', '1332', '1333', '1375', '1376', '1377', '1379'],
    })).toThrow(ThemeInputError)
  })
})

describe('themeService aggregation', () => {
  const points = [
    { date: '2026-01-05', open: 100, high: 110, low: 95, close: 108, volume: 1000 }, // Mon
    { date: '2026-01-06', open: 108, high: 112, low: 107, close: 109, volume: 900 },  // Tue
    { date: '2026-01-09', open: 109, high: 113, low: 106, close: 111, volume: 1500 }, // Fri
    { date: '2026-01-13', open: 112, high: 115, low: 110, close: 114, volume: 1200 }, // next week
    { date: '2026-02-02', open: 120, high: 121, low: 118, close: 119, volume: 800 },
  ]

  it('uses Monday as week start', () => {
    expect(periodStart('2026-01-09', 'w')).toBe('2026-01-05')
  })

  it('aggregates weekly OHLCV correctly', () => {
    const weekly = aggregateBars(points, 'w')
    expect(weekly).toEqual([
      { date: '2026-01-05', open: 100, high: 113, low: 95, close: 111, volume: 3400 },
      { date: '2026-01-12', open: 112, high: 115, low: 110, close: 114, volume: 1200 },
      { date: '2026-02-02', open: 120, high: 121, low: 118, close: 119, volume: 800 },
    ])
  })

  it('aggregates monthly OHLCV correctly', () => {
    const monthly = aggregateBars(points, 'm')
    expect(monthly).toEqual([
      { date: '2026-01-01', open: 100, high: 115, low: 95, close: 114, volume: 4600 },
      { date: '2026-02-01', open: 120, high: 121, low: 118, close: 119, volume: 800 },
    ])
  })
})

describe('themeService CRUD', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('createTheme inserts theme and theme_stocks', async () => {
    const insertThemeValues = vi.fn().mockResolvedValue(undefined)
    const insertStocksValues = vi.fn().mockResolvedValue(undefined)
    const insert = vi.fn()
      .mockReturnValueOnce({ values: insertThemeValues })
      .mockReturnValueOnce({ values: insertStocksValues })
    const whereForDelete = vi.fn().mockResolvedValue(undefined)
    const deleteFn = vi.fn().mockReturnValue({ where: whereForDelete })

    const where = vi.fn().mockResolvedValue([{ code: '72030' }, { code: '67580' }])
    const from = vi.fn().mockReturnValue({ where })
    const select = vi.fn().mockReturnValue({ from })

    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('theme-1')

    const db = { select, insert, delete: deleteFn } as unknown as Db
    const id = await createTheme(db, {
      name: 'テーマA',
      memo: '',
      codes: ['7203', '6758'],
    })
    expect(id).toBe('theme-1')
    expect(insert).toHaveBeenCalledTimes(2)
  })

  it('createTheme deletes theme when stock insert fails', async () => {
    const insertThemeValues = vi.fn().mockResolvedValue(undefined)
    const insertStocksValues = vi.fn().mockRejectedValue(new Error('insert failed'))
    const insert = vi.fn()
      .mockReturnValueOnce({ values: insertThemeValues })
      .mockReturnValueOnce({ values: insertStocksValues })
    const whereForDelete = vi.fn().mockResolvedValue(undefined)
    const deleteFn = vi.fn().mockReturnValue({ where: whereForDelete })

    const where = vi.fn().mockResolvedValue([{ code: '72030' }])
    const from = vi.fn().mockReturnValue({ where })
    const select = vi.fn().mockReturnValue({ from })

    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('theme-rollback')

    const db = { select, insert, delete: deleteFn } as unknown as Db
    await expect(createTheme(db, {
      name: 'テーマA',
      memo: '',
      codes: ['7203'],
    })).rejects.toThrow('insert failed')

    expect(deleteFn).toHaveBeenCalledTimes(1)
  })

  it('updateTheme returns false when target theme does not exist', async () => {
    const returning = vi.fn().mockResolvedValue([])
    const whereForUpdate = vi.fn().mockReturnValue({ returning })
    const set = vi.fn().mockReturnValue({ where: whereForUpdate })
    const update = vi.fn().mockReturnValue({ set })

    const where = vi.fn().mockResolvedValue([{ code: '72030' }])
    const from = vi.fn().mockReturnValue({ where })
    const select = vi.fn().mockReturnValue({ from })
    const db = { select, update } as unknown as Db

    const ok = await updateTheme(db, 'missing-id', {
      name: 'テーマA',
      memo: '',
      codes: ['7203'],
    })
    expect(ok).toBe(false)
  })

  it('deleteTheme deletes theme stocks then theme', async () => {
    const themeReturning = vi.fn().mockResolvedValue([{ id: 'theme-1' }])
    const themeWhere = vi.fn().mockReturnValue({ returning: themeReturning })
    const del = vi.fn()
      .mockReturnValueOnce({ where: vi.fn().mockResolvedValue(undefined) })
      .mockReturnValueOnce({ where: themeWhere })
    const db = { delete: del } as unknown as Db

    await expect(deleteTheme(db, 'theme-1')).resolves.toBe(true)
    expect(del).toHaveBeenCalledTimes(2)
  })
})
