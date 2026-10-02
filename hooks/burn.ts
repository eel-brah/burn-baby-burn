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
    "{left} of your week is still in the fridge. It expires in {time}.",
    "Your tokens are like gym membership: paid for and unused.",
    "Fun fact: unused tokens don't go to token heaven.",
    "Your context window is looking a bit empty. Feed it.",
    "Somewhere, a backlog is waiting for you. {left} could clear it.",
    "Claude is getting bored. Give it a refactor.",
  ],
  blaze: [
    'Disco inferno: {left} left and under a day to go.',
    "Use it or lose it. And you're about to lose it.",
    'Somewhere a GPU is idle because of you.',
    'We didn\'t start the fire, but {left} of your week says you should.',
    'Ship it like the reset is tomorrow. Because it is.',
    "{left} left and {time} to go. Even your linter is judging you.",
    "That TODO from 2023? Now's the time. {left} says so.",
    "Pretend it's Friday at 5 pm and the demo is Monday.",
    "Your weekly quota is packing its bags. {time} until it leaves.",
    "Write the tests you promised yourself. You have {left} of a week to do it.",
    "Under a day left. Ask Claude something ambitious.",
  ],
  inferno: [
    'BURN BABY BURN! {left} left, reset in {time}!',
    'Last call at the token bar. Order big.',
    "It's the final countdown: {time} to burn {left}.",
    'Refactor something. Anything. Now.',
    'Great balls of fire! {left} still unspent!',
    "{time} left. This is not a drill. {left} still unburned!",
    "Open every repo. Fix everything. GO.",
    "The tokens are melting. {left} gone in {time}.",
    "Spend it like it's the last day of vacation money.",
    "Ask Claude to rewrite it in Rust. You have {left} to spare.",
    "Midnight sale on tokens: everything must go in {time}.",
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

// The warning window: the widest tier's reach before the reset.
export const WINDOW_HOURS = Math.max(...TIERS.map(t => t.within)) / HOUR

export type LastNag = { at: number; tier: Tier }

// Store values are untrusted (older versions, hand edits): anything malformed counts as no nag yet.
export function readLastNag(value: unknown): LastNag | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { at, tier } = value as Record<string, unknown>
  if (typeof at !== 'number' || !Number.isFinite(at)) return undefined
  if (!TIERS.some(t => t.tier === tier)) return undefined
  return { at, tier: tier as Tier }
}

// Tiers only get hotter as the reset nears, so a tier change always nags; otherwise once per the tier's interval.
export function isNagDue(burn: Burn, now: number, last: LastNag | undefined): boolean {
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
