import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/client', () => ({
  createDb: vi.fn(),
}))

vi.mock('../src/services/edinetSyncService', () => ({
  syncEdinetBridge: vi.fn().mockResolvedValue(0),
  syncEdinetQualityScores: vi.fn().mockResolvedValue(0),
  syncEdinetTextScores: vi.fn().mockResolvedValue(0),
  syncEdinetTimeline: vi.fn().mockResolvedValue(0),
}))

import { createDb } from '../src/db/client'
import {
  syncEdinetBridge,
  syncEdinetQualityScores,
  syncEdinetTextScores,
  syncEdinetTimeline,
} from '../src/services/edinetSyncService'
import { isoDateJst, main } from './edinet-watch-sync'

// ---------- isoDateJst ----------
describe('isoDateJst', () => {
  it('YYYY-MM-DD 形式を返す', () => {
    const result = isoDateJst()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('deltaDays=0 は今日の日付', () => {
    const result = isoDateJst(0)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // 日付部分が 01〜31 の範囲
    const day = Number(result.slice(8, 10))
    expect(day).toBeGreaterThanOrEqual(1)
    expect(day).toBeLessThanOrEqual(31)
  })

  it('deltaDays=1 は翌日の日付', () => {
    const today = isoDateJst(0)
    const tomorrow = isoDateJst(1)
    expect(tomorrow > today).toBe(true)
  })

  it('deltaDays=-1 は前日の日付', () => {
    const today = isoDateJst(0)
    const yesterday = isoDateJst(-1)
    expect(yesterday < today).toBe(true)
  })

  it('正の差分が日付を進める（複数日）', () => {
    const base = isoDateJst(0)
    const future = isoDateJst(30)
    expect(future > base).toBe(true)
  })
})

// ---------- main ----------

/**
 * db.execute のモック。呼び出し順を想定:
 *   1回目: SELECT FROM stock_memo_meta (watchlist)
 *   2回目: SELECT DISTINCT FROM theme_stocks
 *   3回目以降: bootstrap INSERT など（空を返す）
 */
function makeDb(
  watchlistRows: Array<{ code: string }> = [],
  themeRows: Array<{ code: string }> = [],
) {
  let callCount = 0
  const execute = vi.fn().mockImplementation(() => {
    callCount++
    if (callCount === 1) return Promise.resolve({ rows: watchlistRows })
    if (callCount === 2) return Promise.resolve({ rows: themeRows })
    return Promise.resolve({ rows: [] })
  })
  return { execute }
}

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // sleepMs はモジュールレベル定数のため setTimeout をモックして即時解決させる
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: TimerHandler) => {
      if (typeof fn === 'function') fn()
      return 0 as unknown as ReturnType<typeof setTimeout>
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ウォッチリストもテーマ株も空なら sync 関数を呼ばない', async () => {
    const db = makeDb([], [])
    vi.mocked(createDb).mockReturnValue(db as any)

    await main()

    expect(syncEdinetTimeline).not.toHaveBeenCalled()
    expect(syncEdinetQualityScores).not.toHaveBeenCalled()
    expect(syncEdinetTextScores).not.toHaveBeenCalled()
    expect(syncEdinetBridge).not.toHaveBeenCalled()
  })

  it('ウォッチリストのコードに対して syncEdinetTimeline を呼ぶ', async () => {
    vi.mocked(syncEdinetTimeline).mockResolvedValue(1)
    const db = makeDb([{ code: '72030' }], [])
    vi.mocked(createDb).mockReturnValue(db as any)

    await main()

    expect(syncEdinetTimeline).toHaveBeenCalledTimes(1)
    expect(syncEdinetTimeline.mock.calls[0][2]).toBe('72030')
  })

  it('テーマ株のコードに対しても syncEdinetTimeline を呼ぶ', async () => {
    vi.mocked(syncEdinetTimeline).mockResolvedValue(1)
    // watchlist は空、theme_stocks にコードあり
    const db = makeDb([], [{ code: '67580' }])
    vi.mocked(createDb).mockReturnValue(db as any)

    await main()

    expect(syncEdinetTimeline).toHaveBeenCalledTimes(1)
    expect(syncEdinetTimeline.mock.calls[0][2]).toBe('67580')
  })

  it('ウォッチリストとテーマ株を合算したコードを処理する', async () => {
    vi.mocked(syncEdinetTimeline).mockResolvedValue(1)
    const db = makeDb([{ code: '72030' }], [{ code: '67580' }])
    vi.mocked(createDb).mockReturnValue(db as any)

    await main()

    expect(syncEdinetTimeline).toHaveBeenCalledTimes(2)
    const calledCodes = syncEdinetTimeline.mock.calls.map(c => c[2])
    expect(calledCodes).toContain('72030')
    expect(calledCodes).toContain('67580')
  })

  it('ウォッチリストとテーマ株の重複コードは 1 回だけ処理する', async () => {
    vi.mocked(syncEdinetTimeline).mockResolvedValue(1)
    // 両方に '72030' がある
    const db = makeDb([{ code: '72030' }], [{ code: '72030' }, { code: '67580' }])
    vi.mocked(createDb).mockReturnValue(db as any)

    await main()

    // '72030' は重複排除されて 1 回のみ、計 2 コード
    expect(syncEdinetTimeline).toHaveBeenCalledTimes(2)
    const calledCodes = syncEdinetTimeline.mock.calls.map(c => c[2])
    expect(calledCodes.filter(c => c === '72030')).toHaveLength(1)
  })

  it('timeline で変化ありのコードに対して quality / text / bridge も呼ぶ', async () => {
    vi.mocked(syncEdinetTimeline).mockResolvedValue(1)
    const db = makeDb([{ code: '72030' }], [])
    vi.mocked(createDb).mockReturnValue(db as any)

    await main()

    expect(syncEdinetQualityScores).toHaveBeenCalledTimes(1)
    expect(syncEdinetQualityScores.mock.calls[0][2]).toBe('72030')
    expect(syncEdinetTextScores).toHaveBeenCalledTimes(1)
    expect(syncEdinetBridge).toHaveBeenCalledTimes(1)
  })

  it('timeline で変化なしなら quality / text / bridge を呼ばない', async () => {
    vi.mocked(syncEdinetTimeline).mockResolvedValue(0)
    const db = makeDb([{ code: '72030' }], [])
    vi.mocked(createDb).mockReturnValue(db as any)

    await main()

    expect(syncEdinetQualityScores).not.toHaveBeenCalled()
    expect(syncEdinetTextScores).not.toHaveBeenCalled()
    expect(syncEdinetBridge).not.toHaveBeenCalled()
  })

  it('execute の SQL が stock_memo_meta と theme_stocks を参照する', async () => {
    const executedSqls: string[] = []
    const execute = vi.fn().mockImplementation((sqlObj: any) => {
      const str = (sqlObj?.queryChunks ?? [])
        .map((c: any) => (typeof c === 'string' ? c : (c?.value ?? '')))
        .join('')
      executedSqls.push(str)
      return Promise.resolve({ rows: [] })
    })
    vi.mocked(createDb).mockReturnValue({ execute } as any)

    await main()

    expect(executedSqls[0]).toContain('stock_memo_meta')
    expect(executedSqls[0]).toContain('is_watched')
    expect(executedSqls[1]).toContain('theme_stocks')
  })
})
