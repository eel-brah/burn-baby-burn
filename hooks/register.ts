import type { EngineInterface, Register } from 'claude-code'

import { MIN_LEFT, WINDOW_HOURS, assess, isNagDue, quote, readLastNag, statusText, weekly } from './burn'
import type { Limit } from './burn'

const LAST_NAG = 'lastNag'
// Rate limits only change when usage moves, so a timer keeps the countdown and nags going while idle.
const RECHECK_MS = 60_000

// The latest reading, re-assessed by the timer between measures.
let latest: readonly Limit[] = []

async function check($: EngineInterface, limits: readonly Limit[]) {
  latest = limits
  const now = await $.clock.now()
  const burn = assess(weekly(limits), now)
  $.ui.status(burn ? statusText(burn) : undefined)
  if (burn === null) return

  // Kept in $.store so a nag isn't repeated by every new session.
  const last = readLastNag(await $.store.get(LAST_NAG))
  if (!isNagDue(burn, now, last)) return
  $.ui.toast(quote(burn, now))
  await $.store.set(LAST_NAG, { at: now, tier: burn.tier })
}

// A nag is never worth breaking the session for: a failed check is dropped.
async function safeCheck($: EngineInterface, limits: readonly Limit[]) {
  try {
    await check($, limits)
  } catch {
    // Nothing to recover; the next measure or tick tries again.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'burn', description: 'How much of the weekly limit is left to burn' })
    // Empty until the first API response of the session; session.measure follows.
    await safeCheck($, (await $.session.usage()).rateLimits)
    $.clock.every(RECHECK_MS, () => void safeCheck($, latest))
    return started
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await safeCheck($, e.rateLimits)
    return next(e)
  })

  on('command.run', { command: 'burn' }, async $ => {
    const now = await $.clock.now()
    const limit = weekly((await $.session.usage()).rateLimits)
    if (limit === undefined) return { text: 'No weekly limit reading yet. Send a prompt first, then try /burn again.' }
    const burn = assess(limit, now)
    if (burn === null) {
      const left = Math.round(100 - limit.percentUsed)
      return {
        text: `${left}% of the week left. Nothing to burn yet (nags start ${WINDOW_HOURS} h before the reset with ${MIN_LEFT}%+ left).`,
      }
    }
    return { text: `${statusText(burn)}\n${quote(burn, now)}` }
  })
}
