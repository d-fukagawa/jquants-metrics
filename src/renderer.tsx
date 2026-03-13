import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children, wide }: { children: any; wide?: boolean }) => {
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
            <nav class="nav">
              <a href="/" class="nav-link">ホーム</a>
              <a href="/screen" class="nav-link">スクリーニング</a>
              <a href="/themes" class="nav-link">テーマ</a>
              <a href="/watchlist" class="nav-link">ウォッチ</a>
              <a href="/timeline" class="nav-link">タイムライン</a>
              <a href="/alpha" class="nav-link">alpha</a>
              <a href="/sync-status" class="nav-link">同期状況</a>
            </nav>
          </div>
        </header>
        <main class={wide ? 'main main-wide' : 'main'}>
          {children}
        </main>
      </body>
    </html>
  )
})
