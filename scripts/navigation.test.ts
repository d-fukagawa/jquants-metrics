import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const script = readFileSync(new URL('../public/static/navigation.js', import.meta.url), 'utf8')

// Exercise the enhancement's events without claiming to emulate native details,
// browser focus order or layout. Those still require a real browser check.
function fixture() {
  let activeElement: TestElement | null = null
  class TestElement extends EventTarget {
    open = false
    children: TestElement[] = []
    constructor(readonly selector: string, children: TestElement[] = []) {
      super()
      this.children = children
    }
    contains(target: TestElement | null): boolean {
      return target === this || this.children.some((child) => child.contains(target))
    }
    querySelectorAll(selector: string): TestElement[] {
      return this.children.flatMap((child) => [
        ...(child.selector === selector ? [child] : []), ...child.querySelectorAll(selector),
      ])
    }
    querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null }
    focus() { activeElement = this }
  }
  const home = new TestElement('a')
  const groups = [0, 1].map(() => new TestElement('.nav-group', [new TestElement('summary'), new TestElement('a')]))
  const desktop = new TestElement('.nav-desktop', [home, ...groups])
  const mobile = new TestElement('.nav-menu', [new TestElement('summary'), new TestElement('a')])
  const outside = new TestElement('button')
  const body = new TestElement('body')
  const document = new TestElement('document', [desktop, mobile, outside, body])
  Object.defineProperty(document, 'activeElement', { get: () => activeElement })
  const viewport = { matches: false }
  const window = Object.assign(new EventTarget(), { matchMedia: () => viewport })
  runInNewContext(script, { document, window })

  function fire(target: EventTarget, type: string, properties = {}) {
    const event = new Event(type, { cancelable: true })
    for (const [key, value] of Object.entries(properties)) Object.defineProperty(event, key, { value })
    target.dispatchEvent(event)
    return event
  }
  return { document, window, viewport, desktop, mobile, groups, outside, body, home, fire, active: () => activeElement }
}

describe('navigation enhancement', () => {
  it('closes the previous group when a second group opens, including browsers without details name support', () => {
    const { groups, fire } = fixture()
    groups[0].open = true
    groups[1].open = true
    fire(groups[1], 'toggle')
    expect(groups.map((group) => group.open)).toEqual([false, true])
    fire(groups[0], 'toggle')
    expect(groups[1].open).toBe(true)
  })

  it.each(['desktop', 'mobile'])('Escape closes %s and returns focus to its trigger', (mode) => {
    const f = fixture()
    const disclosure = mode === 'desktop' ? f.groups[0] : f.mobile
    disclosure.open = true
    disclosure.querySelector('a')!.focus()
    expect(f.fire(f.document, 'keydown', { key: 'Escape' }).defaultPrevented).toBe(true)
    expect(disclosure.open).toBe(false)
    expect(f.active()).toBe(disclosure.querySelector('summary'))
    expect(f.fire(f.document, 'keydown', { key: 'Escape' }).defaultPrevented).toBe(false)
  })

  it('does not intercept Tab or close a group while focus moves among its links', () => {
    const f = fixture()
    f.groups[0].open = true
    expect(f.fire(f.document, 'keydown', { key: 'Tab' }).defaultPrevented).toBe(false)
    f.fire(f.desktop, 'focusout', { relatedTarget: f.groups[0].querySelector('a') })
    expect(f.groups[0].open).toBe(true)
  })

  it.each(['desktop', 'mobile'])('closes %s when focus leaves navigation', (mode) => {
    const f = fixture()
    const disclosure = mode === 'desktop' ? f.groups[0] : f.mobile
    disclosure.open = true
    f.outside.focus()
    f.fire(mode === 'desktop' ? f.desktop : f.mobile, 'focusout', { relatedTarget: f.outside })
    expect(disclosure.open).toBe(false)
    expect(f.active()).toBe(f.outside)
  })

  it('preserves inside clicks and closes outside clicks without stealing outside focus', () => {
    const f = fixture()
    f.mobile.open = true
    f.fire(f.document, 'click', { target: f.mobile.querySelector('a') })
    expect(f.mobile.open).toBe(true)
    f.outside.focus()
    f.fire(f.document, 'click', { target: f.outside })
    expect(f.mobile.open).toBe(false)
    expect(f.active()).toBe(f.outside)
  })

  it('returns focus from a hidden link when an outside click does not focus anything', () => {
    const f = fixture()
    f.groups[0].open = true
    f.groups[0].querySelector('a')!.focus()
    f.fire(f.document, 'click', { target: f.outside })
    expect(f.groups[0].open).toBe(false)
    expect(f.active()).toBe(f.groups[0].querySelector('summary'))
  })

  it('resets open menus and moves focus to a visible trigger across the breakpoint', () => {
    const f = fixture()
    f.groups[0].open = true
    f.groups[0].querySelector('a')!.focus()
    f.viewport.matches = true
    f.fire(f.window, 'resize')
    expect(f.groups[0].open).toBe(false)
    expect(f.active()).toBe(f.mobile.querySelector('summary'))
    f.mobile.open = true
    f.mobile.querySelector('a')!.focus()
    f.viewport.matches = false
    f.fire(f.window, 'resize')
    expect(f.mobile.open).toBe(false)
    expect(f.active()).toBe(f.home)
  })

  it('remembers the navigation when CSS hides and blurs its focused link before resize', () => {
    const f = fixture()
    f.viewport.matches = true
    f.mobile.open = true
    f.mobile.querySelector('a')!.focus()
    f.fire(f.mobile, 'focusin')
    f.body.focus()
    f.fire(f.mobile, 'focusout', { relatedTarget: null })
    f.viewport.matches = false
    f.fire(f.window, 'resize')
    expect(f.mobile.open).toBe(false)
    expect(f.active()).toBe(f.home)
  })

  it('keeps focus visible on resize within desktop or mobile mode', () => {
    const f = fixture()
    for (const disclosure of [f.groups[0], f.mobile]) {
      f.viewport.matches = disclosure === f.mobile
      disclosure.open = true
      disclosure.querySelector('a')!.focus()
      f.fire(f.window, 'resize')
      expect(disclosure.open).toBe(false)
      expect(f.active()).toBe(disclosure.querySelector('summary'))
    }
  })
})
