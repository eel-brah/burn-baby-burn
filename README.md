<p align="center">
  <img src="assets/banner.svg" alt="Burn Baby Burn: a Claude Code mod that nags you, with fire, when your weekly limit is about to go to waste" width="100%">
</p>

# Burn Baby Burn

A Claude Code mod that nags you, with fire, when much of your weekly usage limit is still unspent close to the reset.

<p align="center">
  <img src="assets/tiers.svg" alt="The nags get hotter as the reset nears: one flame every 6 hours from 3 days out, two flames every 2 hours from 1 day out, three flames every 30 minutes in the last 6 hours" width="100%">
</p>

- Status line: `🔥🔥 68% of the week left · resets in 16h 4m`, shown in the last 72 h before the weekly reset when 25%+ is left.
- Toasts that get hotter and more frequent as the reset nears (🔥 every 6 h, 🔥🔥 every 2 h, 🔥🔥🔥 every 30 min), each with a different quote.
- `/burn` shows the status on demand.

## Install

Requires Claude Code 2.1.287 or later and a plan with a weekly limit.

From the Claude plugin directory, where it is listed as "Burn Baby Burn":

```bash
claude plugin install burn-baby-burn@anthropic-plugin-directory --scope user
```

Or run `/plugin` in Claude Code and search for "Burn Baby Burn", or install it from
[claude.ai/directory](https://claude.ai/directory).

Or straight from this repo, which is its own marketplace:

```bash
claude plugin marketplace add eel-brah/burn-baby-burn
claude plugin install burn-baby-burn@burn-baby-burn --scope user
```

To try it without installing: `claude --plugin-dir /path/to/burn-baby-burn`.

## What it does on your machine

It reads Claude Code's own usage data for this session (it uses only the weekly limit) and the clock, re-checking once a minute. It shows a status line and toasts, adds the `/burn` command, and keeps the time and level of its last nag in Claude Code's plugin store. It sends nothing over the network, runs no commands and touches no other files.

Its hooks (`hooks/register.ts`) only observe and always pass the event on unchanged:

- `session.start`: registers `/burn`, takes the first usage reading and starts the one-minute re-check.
- `session.measure`: re-checks when Claude Code reports new rate limits.
- `command.run` (only for `/burn`): answers with the current status; every other command is left alone.

A mod runs inside Claude Code with the same access Claude Code has. Read the code (`hooks/`) before installing.

## Tweak

Change `MIN_LEFT` or the `TIERS` table in `hooks/burn.ts`.

## License

MIT
