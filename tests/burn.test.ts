import { describe, expect, test } from 'claude-code/testing'

import { WINDOW_HOURS, assess, formatLeft, isNagDue, quote, readLastNag, statusText } from '../hooks/burn'

const HOUR = 3_600_000
const NOW = Date.parse('2026-10-02T12:00:00Z')
const resetIn = (ms: number) => new Date(NOW + ms).toISOString()

describe('burn', () => {
  test('no nag far from the reset, or with little left', async () => {
    expect(assess({ kind: 'seven_day', percentUsed: 10, resetsAt: resetIn(100 * HOUR) }, NOW)).toBe(null)
    expect(assess({ kind: 'seven_day', percentUsed: 80, resetsAt: resetIn(2 * HOUR) }, NOW)).toBe(null)
    expect(assess({ kind: 'seven_day', percentUsed: 10 }, NOW)).toBe(null)
    expect(assess(undefined, NOW)).toBe(null)
  })

  test('tiers heat up toward the reset', async () => {
    expect(assess({ kind: 'seven_day', percentUsed: 40, resetsAt: resetIn(48 * HOUR) }, NOW)?.tier).toBe('smoulder')
    expect(assess({ kind: 'seven_day', percentUsed: 40, resetsAt: resetIn(20 * HOUR) }, NOW)?.tier).toBe('blaze')
    expect(assess({ kind: 'seven_day', percentUsed: 40, resetsAt: resetIn(3 * HOUR) }, NOW)).toEqual({ tier: 'inferno', left: 60, msLeft: 3 * HOUR })
  })

  test('nags once per interval, again at once on a hotter tier', async () => {
    const burn = { tier: 'blaze' as const, left: 60, msLeft: 20 * HOUR }
    expect(isNagDue(burn, NOW, undefined)).toBe(true)
    expect(isNagDue(burn, NOW, { at: NOW - HOUR, tier: 'blaze' })).toBe(false)
    expect(isNagDue(burn, NOW, { at: NOW - 2 * HOUR, tier: 'blaze' })).toBe(true)
    expect(isNagDue(burn, NOW, { at: NOW - 60_000, tier: 'smoulder' })).toBe(true)
  })

  test('quotes and the status line', async () => {
    const burn = { tier: 'inferno' as const, left: 60, msLeft: 3 * HOUR + 15 * 60_000 }
    expect(quote(burn, 0)).toBe('BURN BABY BURN! 60% left, reset in 3h 15m!')
    expect(quote(burn, 60_000)).not.toBe(quote(burn, 0))
    expect(statusText(burn)).toBe('🔥🔥🔥 60% of the week left · resets in 3h 15m')
    expect(formatLeft(28 * HOUR)).toBe('1d 4h')
    expect(formatLeft(30_000)).toBe('1m')
  })

  test('reads only well-formed store values', () => {
    expect(readLastNag({ at: 5, tier: 'blaze' })).toEqual({ at: 5, tier: 'blaze' })
    expect(readLastNag(undefined)).toBeUndefined()
    expect(readLastNag({ at: '5', tier: 'blaze' })).toBeUndefined()
    expect(readLastNag({ at: 5, tier: 'volcano' })).toBeUndefined()
    expect(WINDOW_HOURS).toBe(72)
  })
})
