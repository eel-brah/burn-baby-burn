import type { EngineInterface, Register } from 'claude-code'

import { API, CALM, WARMUP, WINDOW_HOURS, assess, isNagDue, pick, quote, readLastNag, statusText, weekly } from './burn'
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
    const usage = await $.session.usage()
    const limit = weekly(usage.rateLimits)
    if (limit === undefined) {
      // Subscriptions report the weekly window with the first answer; still none after one means an API key.
      const hasAnswered = (usage.context.tokens ?? 0) > 0 || (usage.cost?.usd ?? 0) > 0
      return { text: pick(hasAnswered ? API : WARMUP, now) }
    }
    const burn = assess(limit, now)
    if (burn === null) return { text: `${Math.round(100 - limit.percentUsed)}% of the week left. ${pick(CALM, now).replaceAll('{window}', String(WINDOW_HOURS))}` }
    return { text: `${statusText(burn)}\n${quote(burn, now)}` }
  })
}
