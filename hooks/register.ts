import type { EngineInterface, Register } from 'claude-code'

import { MIN_LEFT, assess, isNagDue, quote, statusText, weekly } from './burn'
import type { Limit, Tier } from './burn'

const LAST_NAG = 'lastNag'

async function check($: EngineInterface, limits: readonly Limit[]) {
  const now = await $.clock.now()
  const burn = assess(weekly(limits), now)
  $.ui.status(burn ? statusText(burn) : undefined)
  if (burn === null) return

  // Kept in $.store so a nag isn't repeated by every new session.
  const last = (await $.store.get(LAST_NAG)) as { at: number; tier: Tier } | undefined
  if (!isNagDue(burn, now, last)) return
  $.ui.toast(quote(burn, now))
  await $.store.set(LAST_NAG, { at: now, tier: burn.tier })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: 'burn', description: 'How much of the weekly limit is left to burn' })
    // Empty until the first API response of the session; session.measure follows.
    await check($, (await $.session.usage()).rateLimits)
    return started
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) await check($, e.rateLimits)
    return next(e)
  })

  on('command.run', { command: 'burn' }, async $ => {
    const now = await $.clock.now()
    const limit = weekly((await $.session.usage()).rateLimits)
    if (limit === undefined) return { text: 'No weekly limit reading yet. Send a prompt first, then try /burn again.' }
    const burn = assess(limit, now)
    if (burn === null) {
      const left = Math.round(100 - limit.percentUsed)
      return { text: `${left}% of the week left. Nothing to burn yet (nags start in the last 3 days with ${MIN_LEFT}%+ left).` }
    }
    return { text: `${statusText(burn)}\n${quote(burn, now)}` }
  })
}
