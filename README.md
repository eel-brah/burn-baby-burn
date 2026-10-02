# burn-baby-burn

A Claude Code mod that nags you, with fire, when much of your weekly usage limit is still unspent close to the reset.

- Status line: `🔥🔥 68% of the week left · resets in 16h 4m`, shown in the last 3 days before the weekly reset when 25%+ is left.
- Toasts that get hotter and more frequent as the reset nears (🔥 every 6 h, 🔥🔥 every 2 h, 🔥🔥🔥 every 30 min).
- `/burn` shows the status on demand.

## Install

Requires Claude Code 2.1.287 or later and a plan with a weekly limit.

```bash
claude plugin marketplace add <owner>/burn-baby-burn
claude plugin install burn-baby-burn@burn-baby-burn --scope user
```

To try it without installing: `claude --plugin-dir /path/to/burn-baby-burn`.

A mod runs inside Claude Code with the same access Claude Code has. Read the code (`hooks/`) before installing.

## Tweak

Change `MIN_LEFT` or the `TIERS` table in `hooks/burn.ts`.
