import { describe, expect, mock, test } from 'claude-code/testing'

const HOUR = 3_600_000
const NOW = Date.parse('2026-10-02T12:00:00Z')
const LIMITS = [{ kind: 'seven_day', percentUsed: 30, resetsAt: new Date(NOW + 5 * HOUR).toISOString() }]
const CONTEXT = { tokens: 1000, window: 200_000 }

describe('register', () => {
  test('toasts a quote once when the week is unspent near the reset, then waits', async ($, on) => {
    const toasts: string[] = []
    const clock = mock.clock(on, { now: NOW })
    mock.store(on)
    on('ui.toast', ($, e) => {
      toasts.push(String(e.text))
      return { value: undefined }
    })
    on('ui.status', () => ({ value: undefined }))
    on('session.measure', ($, e) => ({ changed: e.changed }))

    const measure = () => $.session.measure({ context: CONTEXT, rateLimits: LIMITS, changed: ['rateLimits'] } as never)
    await measure()
    await measure()
    expect(toasts.length).toBe(1)
    expect(toasts[0]).toMatch(/70%|Last call|countdown|Refactor|fire/i)

    await clock.advance(31 * 60_000)
    await measure()
    expect(toasts.length).toBe(2)
  })
})
