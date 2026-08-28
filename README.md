# R-Land Hunt 2.0

A geofenced scavenger-hunt platform for campus clubs. A team walks to a place, taps
one button, and the **database** decides whether they were really there.

> **v1 lives in [`legacy/`](./legacy).** It is kept for reference only — do not run it.
> [`ARCHITECTURE-TEARDOWN.md`](./ARCHITECTURE-TEARDOWN.md) is the forensic read of it and
> [`REBUILD-PLAN.md`](./REBUILD-PLAN.md) is the plan this implements.

---

## The one idea

v1 ran the game in the browser and believed whatever the browser reported. Every clue,
hint and coordinate was in the page source at the start, the score was a `let` you could
edit in the console, and the geofence radius was **10 kilometres** on a campus 1.5 km wide.

In v2 the entire game loop lives in Postgres:

| | Where it happens | Why it matters |
|---|---|---|
| Geofence | `ST_DWithin` in `verify_arrival()` | Metres, on a spheroid, against a radius the organiser set |
| Score | `teams.score`, written only by `SECURITY DEFINER` functions | No client-writable path exists — not hidden, *absent* |
| Clue text | `nodes`, with **no player-facing RLS SELECT policy** | A player's JWT cannot read an unearned clue at all |
| Distance & bearing | computed server-side in `record_ping()` | The device is guided without ever being told where the target is |
| The clock | derived from `started_at − paused_total` | A refresh, a dead phone and a reconnect all produce the same number |

---

## Running it

### 1 · Local, with Docker (everything on your machine, no accounts)

```bash
npm install
npm run db:start          # Postgres + PostGIS + Auth + Realtime, in Docker
```

Copy the **API URL** and **anon key** it prints into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key>
NEXT_PUBLIC_ALLOW_SIM=true
```

```bash
npm run dev               # http://localhost:3000
```

Migrations and demo data apply automatically on first start. `npm run db:reset` wipes and
re-seeds; `npm run db:stop` shuts it down.

### 2 · Hosted, on free tiers

Create a project at supabase.com, then:

```bash
npx supabase link --project-ref <ref>
npm run db:push
```

Put the project URL and anon key in Vercel's environment variables and deploy. Set
`NEXT_PUBLIC_ALLOW_SIM` to `false` in production.

In the Supabase dashboard turn on **Anonymous sign-ins** (Authentication → Providers) —
players never make an account, and the app will not work without it.

---

## Try it in two minutes

The seed ships a published hunt on the IIT Roorkee campus.

**As a player** — open `/`, cipher **`RLAND1`**, any crew name, break the seal.
The hunt is `published`, so start it as an organiser first (below), then come back.

**As an organiser** — `/signin`, `demo@rlandhunt.test` / `huntmaster`.
Open **Monsoon Reckoning** → **START THE HUNT** → **RACE CONTROL**.

**To walk the hunt from your desk** — on the play screen tap **SIM**, then
`+100 M TOWARD` a few times until the compass turns green, and press **MARK THIS SPOT**.
Clue 2 needs the site code `ELEVEN`.

The simulator only changes what coordinates the browser *sends*. The database runs the
same geofence against them either way.

---

## What is here

```
app/
  page.tsx                  join by cipher (anonymous auth)
  play/[teamId]/            the clue screen, hints, leaderboard, recap
  studio/                   hunt list and the corkboard editor
  control/[huntId]/         race control — live map, clock, alerts, interventions
  screen/[huntId]/          public big screen for the venue
  signin/                   organisers (email + password)
components/
  Compass.tsx               tilted brass compass, server-fed bearing
  ChartMap.tsx              schematic SVG chart with true-scale geofences
  play/ organiser/          the two halves of the product
lib/
  sound.ts                  every sound synthesised at play time — no audio files
supabase/
  migrations/               schema · RLS · engine · organiser · realtime
  seed.sql                  demo club, hunt and six clues
  tests/                    pgTAP tests for the rules that matter
design/                     the design canvas these screens came from
```

### Feature coverage against the plan

Built: orgs and roles, join-by-code with anonymous players, the graph-shaped clue model
with branch gates, per-clue geofences and proof policies, the hint ladder, server-verified
arrival, first-blood and finish bonuses, time decay, the authoritative clock with
pause/resume, live team map with trails, stuck-team detection, teleport flags, organiser
interventions with an audit trail, announcements, the public big screen, and the recap.

Not built yet: photo capture and upload, the animated post-hunt replay, hunt templates and
forking, the printable QR pack, offline queueing, and the organiser analytics report.
`gps_photo` currently behaves as plain GPS with the intent recorded on the node.

---

## Honest limits

**GPS spoofing is not solved.** The web platform exposes no reliable "this fix was mocked"
signal, and anything claiming otherwise would be a lie. What the app does instead: a per-clue
**site code** or QR that needs physical presence, continuous position pings so a team's track
is a path rather than a claim, and a `teleport` flag raised at implied speeds above 12 m/s.
Flags go to a human in Race Control — the system never disqualifies anyone.

**Distance and bearing are a deliberate trade.** Together they let a player derive where a
clue is without solving it. That is the price of not getting lost, and it is per hunt:
set `rules.guidance` to `"distance"` (a circle, not a point) or `"none"` (hot/cold only).

**The map is schematic, not a basemap.** The OSM Foundation's tile servers are explicitly
not for production apps and forbid caching an area, and every keyed provider is another
account. `ChartMap` projects lat/lng locally, draws geofences at true metric scale, costs
nothing and works offline. Dropping a Protomaps `.pmtiles` file behind it is the upgrade path.

**Free-tier ceilings that shape the design.** Supabase allows 200 concurrent realtime
connections, so the big screen is *one* connection for the whole venue and pings are batched.
Free projects also pause after 7 days idle — a paused project on event morning is total
failure, so keep something touching the database, and check it 48 hours before any hunt.

**v1's committed credentials are still live.** The Gmail app password and Channel-i OAuth
secret in this repository's git history were public for over two years. Rotating them is
independent of this rebuild and still needs doing.

---

## Development

```bash
npm run typecheck     # tsc --noEmit
npm run build         # production build
npm run db:reset      # re-apply migrations + seed
npm run db:types      # regenerate lib/database.types.ts
```

```bash
npx supabase test db  # 14 pgTAP tests over the scoring and unlocking rules
npm run smoke         # 26 end-to-end checks against the real HTTP API
```

`npm run smoke` expects a freshly seeded database, so run `npm run db:reset` first. It drives
the API exactly as the app does and asserts the negative cases hardest: a player cannot read
the clue table, cannot write their own score, and cannot see a rival crew's state.
