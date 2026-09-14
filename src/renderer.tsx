import { jsxRenderer } from 'hono/jsx-renderer'

const navigationItems = [
  { href: '/', label: 'ホーム' },
  { href: '/screen', label: 'スクリーニング' },
  { href: '/rankings/daily', label: 'ランキング' },
  { href: '/valuations', label: '業績・評価' },
  { href: '/buy-timing', label: '買いタイミング' },
  { href: '/themes', label: 'テーマ' },
  { href: '/watchlist', label: 'ウォッチ' },
  { href: '/timeline', label: 'タイムライン' },
  { href: '/alpha', label: 'alpha' },
  { href: '/sync-status', label: '同期状況' },
] as const

const NavigationLinks = () => (
  <>
    {navigationItems.map(({ href, label }) => (
      <a href={href} class="nav-link" key={href}>{label}</a>
    ))}
  </>
)

declare module 'hono' {
  interface ContextRenderer {
    (content: string | Promise<string>, props?: { wide?: boolean }): Response
  }
}

export const renderer = jsxRenderer(({ children, wide }: { children?: any; wide?: boolean }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>jquants-metrics</title>
        <link href="/static/style.css" rel="stylesheet" />
      </head>
      <body>
        <header class="header">
          <div class="header-inner">
            <a href="/" class="logo">jquants<span>-metrics</span></a>
            <nav class="nav nav-desktop" aria-label="メインナビゲーション">
              <NavigationLinks />
            </nav>
            <details class="nav-menu">
              <summary class="nav-menu-trigger">
                <span class="nav-menu-icon" aria-hidden="true"></span>
                <span>メニュー</span>
              </summary>
              <nav class="nav nav-mobile" aria-label="モバイルナビゲーション">
                <NavigationLinks />
              </nav>
            </details>
          </div>
        </header>
        <main class={wide ? 'main main-wide' : 'main'}>
          {children}
        </main>
      </body>
    </html>
  )
})
