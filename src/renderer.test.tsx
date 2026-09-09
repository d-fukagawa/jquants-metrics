import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { renderer } from './renderer'

function createApp() {
  const app = new Hono()
  app.use(renderer)
  app.get('/', (c) => c.render(<p>content</p>))
  return app
}

describe('shared navigation', () => {
  it('renders an accessible disclosure containing every navigation destination', async () => {
    const html = await (await createApp().request('/')).text()

    expect(html).toContain('<nav class="nav nav-desktop" aria-label="メインナビゲーション">')
    expect(html).toContain('<details class="nav-menu">')
    expect(html).toContain('<summary class="nav-menu-trigger">')
    expect(html).toContain('<nav class="nav nav-mobile" aria-label="モバイルナビゲーション">')

    const destinations = [
      '/',
      '/screen',
      '/rankings/daily',
      '/buy-timing',
      '/themes',
      '/watchlist',
      '/timeline',
      '/alpha',
      '/sync-status',
    ]

    for (const destination of destinations) {
      expect(html).toContain(`href="${destination}"`)
    }
  })
})
