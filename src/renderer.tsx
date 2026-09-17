import { jsxRenderer } from 'hono/jsx-renderer'
import { HeaderNavigation } from './components/HeaderNavigation'

declare module 'hono' {
  interface ContextRenderer {
    (content: string | Promise<string>, props?: { wide?: boolean }): Response
  }
}

export const renderer = jsxRenderer(({ children, wide }: { children?: any; wide?: boolean }, c) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>jquants-metrics</title>
        <link href="/static/style.css" rel="stylesheet" />
        <script src="/static/navigation.js" defer></script>
      </head>
      <body>
        <header class="header">
          <div class="header-inner">
            <a href="/" class="logo">jquants<span>-metrics</span></a>
            <HeaderNavigation pathname={c.req.path} />
          </div>
        </header>
        <main class={wide ? 'main main-wide' : 'main'}>
          {children}
        </main>
      </body>
    </html>
  )
})
