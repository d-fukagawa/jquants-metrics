import { beforeEach, describe, expect, it, vi } from 'vitest'
import { themesRoute } from './themes'
import * as themeService from '../services/themeService'

vi.mock('../services/themeService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/themeService')>()
  return {
    ...mod,
    listThemes: vi.fn(),
    createTheme: vi.fn(),
    updateTheme: vi.fn(),
    deleteTheme: vi.fn(),
    updateThemeMemo: vi.fn(),
    getThemeDetail: vi.fn(),
    listThemeSeries: vi.fn(),
    listThemeCandidates: vi.fn(),
  }
})
vi.mock('../db/client', () => ({ createDb: vi.fn().mockReturnValue({}) }))

const ENV = {
  DATABASE_URL: 'postgres://test',
  JQUANTS_API_KEY: 'key',
  EDINETDB_API_KEY: 'edinet-key',
  EDINET_API_KEY: 'official-edinet-key',
  SYNC_SECRET: 'secret',
}

describe('themesRoute', () => {
  beforeEach(() => vi.clearAllMocks())

  it('GET / renders theme list', async () => {
    vi.mocked(themeService.listThemes).mockResolvedValue([
      {
        id: 'theme-1',
        name: '光デバイス',
        memo: '',
        stockCount: 3,
        createdAt: new Date('2026-03-01T00:00:00Z'),
        updatedAt: new Date('2026-03-02T00:00:00Z'),
      },
    ])

    const res = await themesRoute.request('/', { method: 'GET' }, ENV)
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('テーマ一覧')
    expect(html).toContain('光デバイス')
  })

  it('GET /new renders create form', async () => {
    const res = await themesRoute.request('/new', { method: 'GET' }, ENV)
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('テーマ新規作成')
    expect(html).toContain('theme-stock-search-input')
  })

  it('GET /stock-search returns rows', async () => {
    vi.mocked(themeService.listThemeCandidates).mockResolvedValue([
      { code: '72030', code4: '7203', coName: 'トヨタ自動車', mktNm: 'プライム' },
    ])

    const res = await themesRoute.request('/stock-search?q=トヨタ', { method: 'GET' }, ENV)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.rows[0].code4).toBe('7203')
  })

  it('POST / creates and redirects', async () => {
    vi.mocked(themeService.createTheme).mockResolvedValue('theme-1')
    const form = new URLSearchParams({ name: 'テーマA', memo: 'memo', 'codes[]': '7203' })

    const res = await themesRoute.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }, ENV)

    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/themes/theme-1')
  })

  it('GET /:id renders analysis page', async () => {
    vi.mocked(themeService.getThemeDetail).mockResolvedValue({
      theme: {
        id: 'theme-1',
        name: '光デバイス',
        memo: 'メモ',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      stocks: [
        { themeId: 'theme-1', code: '72030', code4: '7203', sortOrder: 0, coName: 'トヨタ自動車', mktNm: 'プライム' },
      ],
    })
    vi.mocked(themeService.listThemeSeries).mockResolvedValue([
      {
        code: '72030',
        code4: '7203',
        name: 'トヨタ自動車',
        bars: [{ date: '2026-03-01', open: 100, high: 110, low: 90, close: 105, volume: 1000 }],
      },
    ])

    const res = await themesRoute.request('/theme-1?g=d&from=2026-01-01&to=2026-03-10', { method: 'GET' }, ENV)
    const html = await res.text()
    expect(res.status).toBe(200)
    expect(html).toContain('テーマ：光デバイス')
    expect(html).toContain('複数銘柄株価チャート')
    expect(html).toContain('/static/theme-analysis.js')
  })

  it('GET /:id returns 400 for invalid date range', async () => {
    const res = await themesRoute.request('/theme-1?from=2026-03-10&to=2026-01-01', { method: 'GET' }, ENV)
    expect(res.status).toBe(400)
  })

  it('GET /:id returns 404 when theme does not exist', async () => {
    vi.mocked(themeService.getThemeDetail).mockResolvedValue(null)
    const res = await themesRoute.request('/missing-theme', { method: 'GET' }, ENV)
    expect(res.status).toBe(404)
  })

  it('POST /:id/memo updates and redirects with query', async () => {
    vi.mocked(themeService.updateThemeMemo).mockResolvedValue(true)
    const form = new URLSearchParams({
      memo: 'updated memo',
      g: 'w',
      from: '2026-01-01',
      to: '2026-03-01',
    })
    const res = await themesRoute.request('/theme-1/memo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    }, ENV)

    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/themes/theme-1?g=w&from=2026-01-01&to=2026-03-01')
  })

  it('POST /:id/delete deletes and redirects', async () => {
    vi.mocked(themeService.deleteTheme).mockResolvedValue(true)
    const res = await themesRoute.request('/theme-1/delete', { method: 'POST' }, ENV)
    expect(res.status).toBe(303)
    expect(res.headers.get('Location')).toBe('/themes')
  })
})
