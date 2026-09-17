import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { renderer } from './renderer'

function createApp() {
  const app = new Hono()
  app.use(renderer)
  app.get('*', (c) => c.render(<p>content</p>, { wide: c.req.query('wide') === '1' }))
  return app
}

async function navigation(path: string) {
  const html = await (await createApp().request(path)).text()
  return [...html.matchAll(/<nav\b[^>]*>(.*?)<\/nav>/gs)].map((match) => match[1])
}

const destinations = ['/', '/screen', '/rankings/daily', '/themes', '/valuations', '/buy-timing',
  '/timeline', '/alpha', '/watchlist', '/sync-status']

describe('shared navigation', () => {
  it('renders every destination once in each navigation, with the same grouping and labels', async () => {
    const [desktop, mobile] = await navigation('/')
    for (const menu of [desktop, mobile]) {
      expect([...menu.matchAll(/href="([^"]+)"/g)].map((match) => match[1])).toEqual(destinations)
      expect(menu).toContain('開示タイムライン</a>')
      expect(menu).toContain('サプライズ抽出</a>')
      const groups = [...menu.matchAll(/(?:<summary[^>]*>|<div class="nav-group-heading[^"]*">)(.*?)<\/(?:summary|div)><ul class="nav-group-links">(.*?)<\/ul>/gs)]
      expect(groups).toHaveLength(2)
      expect(groups[0][1]).toContain('銘柄を探す')
      expect([...groups[0][2].matchAll(/href="([^"]+)"/g)].map((match) => match[1]))
        .toEqual(['/screen', '/rankings/daily', '/themes'])
      expect(groups[1][1]).toContain('分析・開示')
      expect([...groups[1][2].matchAll(/href="([^"]+)"/g)].map((match) => match[1]))
        .toEqual(['/valuations', '/buy-timing', '/timeline', '/alpha'])
      expect(menu).not.toMatch(/role="menu(?:item)?"/)
    }
    expect(desktop.match(/<details /g)).toHaveLength(2)
    expect(desktop).not.toContain(' open')
    expect(mobile).not.toContain('<details')
    expect(mobile).not.toContain('<summary')
  })

  it.each(destinations)('marks only the exact page for %s, independently of query parameters', async (path) => {
    for (const menu of await navigation(`${path}?filter=example&date=2026-09-17`)) {
      const current = [...menu.matchAll(/<a href="([^"]+)"[^>]*aria-current="page"/g)]
      expect(current.map((match) => match[1])).toEqual([path])
      expect(menu).toContain(`href="${path}" class="nav-link active"`)
    }
  })

  it.each(['/themes/ai', '/themes/ai/edit', '/themes/daily-summary', '/themes/'])
    ('highlights theme membership without declaring the list the current page: %s', async (path) => {
      const [desktop, mobile] = await navigation(path)
      for (const menu of [desktop, mobile]) {
        expect(menu).toContain('href="/themes" class="nav-link active"')
        expect(menu).not.toContain('aria-current=')
      }
      expect(desktop).toContain('class="nav-link nav-group-trigger active">銘柄を探す')
      expect(mobile).toContain('class="nav-group-heading active">銘柄を探す')
      expect(desktop).not.toContain('class="nav-link nav-group-trigger active">分析・開示')
    })

  it('highlights the analysis group for its page', async () => {
    const [desktop, mobile] = await navigation('/alpha')
    expect(desktop).toContain('class="nav-link nav-group-trigger active">分析・開示')
    expect(mobile).toContain('class="nav-group-heading active">分析・開示')
    expect(desktop).not.toContain('class="nav-link nav-group-trigger active">銘柄を探す')
  })

  it.each(['/unknown', '/themes-other', '/screening', '/rankings/daily-other', '/stock/72030'])
    ('does not select a misleading destination for %s', async (path) => {
      for (const menu of await navigation(path)) {
        expect(menu).not.toContain(' active')
        expect(menu).not.toContain('aria-current=')
      }
    })

  it('keeps named navigation landmarks, native mobile disclosure and the renderer wide option', async () => {
    const html = await (await createApp().request('/?wide=1')).text()
    expect(html).toContain('<nav class="nav nav-desktop" aria-label="メインナビゲーション">')
    expect(html).toContain('<details class="nav-menu"><summary class="nav-menu-trigger">')
    expect(html).toContain('<nav class="nav nav-mobile" aria-label="モバイルナビゲーション">')
    expect(html).toContain('<script src="/static/navigation.js" defer=""></script>')
    expect(html).toContain('<main class="main main-wide"><p>content</p></main>')
  })
})
