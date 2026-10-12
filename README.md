# Keeping Up with the Joneses

A cartoon life sim about rent, résumés and getting ahead of the family next door. Set your life goals, spend your 60 hours a week, and outpace the Joneses.

Play solo against CPU rivals, pass-and-play on one device, or online with friends using an invite code. No accounts needed.

## How it's built

- Plain HTML, CSS and JavaScript. No framework, no build tools beyond `python3 build.py`.
- `site/` is the website that GitHub Pages serves. The workflow in `.github/workflows/pages.yml` rebuilds and deploys it on every push to `main`.
- Online play uses [Supabase](https://supabase.com): anonymous sign-in, one `games` table, and server-side functions that only accept a move from the player whose turn it is.

| File | What it holds |
|---|---|
| `core.js` | Game rules: town, jobs, school, housing, stocks, events, the weekly cycle |
| `ai.js` | CPU rivals (the Grinder, the Party Animal, the Investor, the Scholar) |
| `art.js` | Town map drawing and character portraits |
| `casino.js` | Slots, blackjack and the Wheel of Somebody Else's Life |
| `net.js` | Online backends: Supabase, plus a same-browser test double |
| `online.js` | Online hub, lobby, turn sync and the turn timer |
| `ui.js` | Screens, panels and turn flow |
| `head.html`, `body.html` | Styles and page markup |
| `supabase/schema.sql` | Database tables, security rules and functions |
| `site/config.js` | Your Supabase URL and anon key |

## Setting up online play

1. Create a Supabase project (the free plan is fine).
2. In **Authentication → Sign In / Providers**, turn on **Allow anonymous sign-ins**.
3. In **SQL Editor**, paste all of `supabase/schema.sql` and run it.
4. Put the **Project URL** and **anon / publishable key** in `site/config.js`. The anon key is designed to be public. Never put the service-role key here.

## Testing online play without Supabase

Open the site with `?backend=local`. Each browser tab becomes a different player, and games are stored in that browser only. Open two tabs to play against yourself.

## First-time GitHub Pages setup

In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**. After that, every push deploys automatically.
