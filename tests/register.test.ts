import { describe, expect, mock, test } from 'claude-code/testing'

import { API, CALM, WARMUP } from '../hooks/burn'

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

  test('keeps the countdown and nags going while the user is idle', async ($, on) => {
    const toasts: string[] = []
    const statuses: (string | undefined)[] = []
    const clock = mock.clock(on, { now: NOW })
    mock.store(on)
    on('ui.toast', ($, e) => {
      toasts.push(String(e.text))
      return { value: undefined }
    })
    on('ui.status', ($, e) => {
      statuses.push(e.text as string | undefined)
      return { value: undefined }
    })
    on('command.register', () => ({ value: undefined }) as never)
    on('session.usage', () => ({ value: { context: CONTEXT, rateLimits: LIMITS } }) as never)
    on('session.start', ($, e) => ({ cwd: e.cwd }))

    await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true })
    expect(toasts.length).toBe(1)
    expect(statuses.at(-1)).toMatch(/resets in 5h 0m/)

    // No measure at all: only the timer runs.
    await clock.advance(31 * 60_000)
    expect(statuses.at(-1)).toMatch(/resets in 4h 29m/)
    expect(toasts.length).toBe(2)

    // Past the reset, the status clears.
    await clock.advance(5 * HOUR)
    expect(statuses.at(-1)).toBeUndefined()
  })

  test('/burn jokes before the first answer, on an API key, and far from the reset', async ($, on) => {
    mock.clock(on, { now: NOW })
    let usage: unknown = { context: { window: 200_000 }, rateLimits: [] }
    on('session.usage', () => ({ value: usage }) as never)
    const burn = async () => String((await $.command.run({ command: 'burn' } as never)).text)

    expect(WARMUP).toContain(await burn())

    usage = { context: CONTEXT, rateLimits: [], cost: { usd: 0.42 } }
    expect(API).toContain(await burn())

    const calm = [{ kind: 'seven_day', percentUsed: 0, resetsAt: new Date(NOW + 6 * 24 * HOUR).toISOString() }]
    usage = { context: CONTEXT, rateLimits: calm }
    const text = await burn()
    expect(text.startsWith('100% of the week left. ')).toBe(true)
    expect(CALM.map(l => l.replace('{window}', '72'))).toContain(text.slice('100% of the week left. '.length))
  })
})

