type NavigationLink = { href: string; label: string }
type NavigationItem = NavigationLink | { label: string; links: readonly NavigationLink[] }

const navigationItems: readonly NavigationItem[] = [
  { href: '/', label: 'ホーム' },
  { label: '銘柄を探す', links: [
    { href: '/screen', label: 'スクリーニング' },
    { href: '/rankings/daily', label: 'ランキング' },
    { href: '/themes', label: 'テーマ' },
  ] },
  { label: '分析・開示', links: [
    { href: '/valuations', label: '業績・評価' },
    { href: '/buy-timing', label: '買いタイミング' },
    { href: '/timeline', label: '開示タイムライン' },
    { href: '/alpha', label: 'サプライズ抽出' },
  ] },
  { href: '/watchlist', label: 'ウォッチ' },
  { href: '/sync-status', label: '同期状況' },
]

function belongsTo(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
}

const PageLink = ({ link, pathname }: { link: NavigationLink; pathname: string }) => (
  <a href={link.href} class={`nav-link${belongsTo(pathname, link.href) ? ' active' : ''}`}
    aria-current={pathname === link.href ? 'page' : undefined}>
    {link.label}
  </a>
)

const NavigationList = ({ pathname, mobile }: { pathname: string; mobile: boolean }) => (
  <ul class="nav-list">
    {navigationItems.map((item) => {
      if ('href' in item) {
        return <li key={item.href} class={item.href === '/sync-status' ? 'nav-auxiliary' : undefined}>
          <PageLink link={item} pathname={pathname} />
        </li>
      }
      const active = item.links.some((link) => belongsTo(pathname, link.href))
      const links = <ul class="nav-group-links">
        {item.links.map((link) => <li key={link.href}><PageLink link={link} pathname={pathname} /></li>)}
      </ul>
      return <li key={item.label}>
        {mobile ? <>
          <div class={`nav-group-heading${active ? ' active' : ''}`}>{item.label}</div>
          {links}
        </> : <details class="nav-group" name="header-navigation">
          <summary class={`nav-link nav-group-trigger${active ? ' active' : ''}`}>
            {item.label}<span class="nav-chevron" aria-hidden="true"></span>
          </summary>
          {links}
        </details>}
      </li>
    })}
  </ul>
)

export const HeaderNavigation = ({ pathname }: { pathname: string }) => (
  <>
    <nav class="nav nav-desktop" aria-label="メインナビゲーション">
      <NavigationList pathname={pathname} mobile={false} />
    </nav>
    <details class="nav-menu">
      <summary class="nav-menu-trigger">
        <span class="nav-menu-icon" aria-hidden="true"></span>
        <span>メニュー</span>
      </summary>
      <nav class="nav nav-mobile" aria-label="モバイルナビゲーション">
        <NavigationList pathname={pathname} mobile={true} />
      </nav>
    </details>
  </>
)
