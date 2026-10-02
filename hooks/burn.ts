export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Tier = 'smoulder' | 'blaze' | 'inferno'
export type Burn = { tier: Tier; left: number; msLeft: number }

const HOUR = 60 * 60 * 1000

// Below this share of the week left, there is nothing worth nagging about.
export const MIN_LEFT = 25

// How long before the reset each tier starts, and how often it may nag.
const TIERS: { tier: Tier; within: number; every: number }[] = [
  { tier: 'inferno', within: 6 * HOUR, every: 30 * 60 * 1000 },
  { tier: 'blaze', within: 24 * HOUR, every: 2 * HOUR },
  { tier: 'smoulder', within: 72 * HOUR, every: 6 * HOUR },
]

const QUOTES: Record<Tier, string[]> = {
  smoulder: [
    'Burn, baby, burn. {left} of your week is just sitting there.',
    "Tokens don't roll over. Neither does regret.",
    "Your weekly quota called. It's feeling unloved.",
    'Unused tokens are just compute crying quietly.',
    'Light my fire: {left} left, reset in {time}.',
  ],
  blaze: [
    'Disco inferno: {left} left and under a day to go.',
    "Use it or lose it. And you're about to lose it.",
    'Somewhere a GPU is idle because of you.',
    'We didn\'t start the fire, but {left} of your week says you should.',
    'Ship it like the reset is tomorrow. Because it is.',
  ],
  inferno: [
    'BURN BABY BURN! {left} left, reset in {time}!',
    'Last call at the token bar. Order big.',
    "It's the final countdown: {time} to burn {left}.",
    'Refactor something. Anything. Now.',
    'Great balls of fire! {left} still unspent!',
  ],
}

export function weekly(limits: readonly Limit[]): Limit | undefined {
  return limits.find(l => l.kind === 'seven_day')
}

export function assess(limit: Limit | undefined, now: number): Burn | null {
  if (limit?.resetsAt === undefined) return null
  const msLeft = Date.parse(limit.resetsAt) - now
  const left = Math.round(100 - limit.percentUsed)
  if (Number.isNaN(msLeft) || msLeft <= 0 || left < MIN_LEFT) return null
  // Tiers are ordered tightest first, so the first match is the hottest.
  const match = TIERS.find(t => msLeft <= t.within)
  return match ? { tier: match.tier, left, msLeft } : null
}

export function nagEvery(tier: Tier): number {
  return TIERS.find(t => t.tier === tier)?.every ?? 6 * HOUR
}

// A new, hotter tier always nags; otherwise once per the tier's interval.
export function isNagDue(burn: Burn, now: number, last: { at: number; tier: Tier } | undefined): boolean {
  if (last === undefined || last.tier !== burn.tier) return true
  return now - last.at >= nagEvery(burn.tier)
}

export function formatLeft(ms: number): string {
  const hours = Math.floor(ms / HOUR)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${Math.floor((ms % HOUR) / 60000)}m`
  return `${Math.max(1, Math.floor(ms / 60000))}m`
}

// Picks a quote that changes every minute, so repeat nags don't repeat lines.
export function quote(burn: Burn, now: number): string {
  const lines = QUOTES[burn.tier]
  const line = lines[Math.floor(now / 60000) % lines.length] ?? lines[0] ?? ''
  return line.replaceAll('{left}', `${burn.left}%`).replaceAll('{time}', formatLeft(burn.msLeft))
}

export function statusText(burn: Burn): string {
  const flames = { smoulder: '🔥', blaze: '🔥🔥', inferno: '🔥🔥🔥' }[burn.tier]
  return `${flames} ${burn.left}% of the week left · resets in ${formatLeft(burn.msLeft)}`
}
