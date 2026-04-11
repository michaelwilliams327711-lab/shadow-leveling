# Shadow Leveling - Gamified Habit Tracker

## Overview

A full-stack gamified habit tracker with an intense RPG/Solo Leveling dark theme. The app turns real-life productivity habits into high-stakes dungeon quests with XP, Gold, levels, stats, streaks, and boss fights.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/shadow-leveling)
- **Backend API**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Charts**: Recharts (Radar Chart)
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── shadow-leveling/     # React + Vite frontend (routes at /)
│   └── api-server/          # Express API server (routes at /api)
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod schemas from OpenAPI
│   └── db/                  # Drizzle ORM schema + DB connection
└── scripts/                 # Utility scripts
```

## Features

1. **Planner** - Control room page with 4 views (Daily/Weekly/Monthly/Yearly). Daily shows today's quests, daily orders, bad habit check-ins, XP summary. Weekly shows 7-column grid with drag-to-reschedule. Monthly shows calendar with completion dots and day detail popover. Yearly shows activity heatmap + key events.
2. **Character Dashboard** - Level, XP progress, Gold, streak counter, stats (STR/INT/END/AGI/DIS), Radar chart, GitHub-style activity heatmap, daily check-in button, RNG event banner
3. **Daily Orders** - Lightweight quick-add tasks on Dashboard. Type name, pick stat, press Enter. Awards E-rank XP (25) + 1 stat point. X/5 counter; at 5/5 a Hidden Box triggers with Gold or stat boost reward revealed via Solo Leveling-style animation. Orders vanish at midnight with zero penalty.
4. **Quest System** - CRUD quests with Rank (F-SSS), category, duration. Complete/Fail with XP+Gold rewards/penalties scaled to difficulty. Quest log history.
5. **Streak System** - Daily check-in builds streak, multipliers (1x-3x), milestone bonuses at 7/14/30/60/100 days
6. **RNG Events** - Deterministic daily random events (30% chance): Surge Day, Treasure Surge, Awakening Pulse, Chaos Rift
7. **Rewards Shop** - Spend Gold on custom guilt-free rewards
8. **Boss Arena** - Locked bosses that unlock at XP thresholds. Win/lose with permanent records
9. **The Awakening** - Vision/Anti-Vision journaling page
10. **Archive of Shadows Intel** - Centralized System lore strings power Shadow Intel tooltips on boss HP/enrage logic, locked boss gate fragments, quest fragment drops, Celestial vice thresholds, and Arise extraction authority.

## API Routes

All at `/api`:
- `GET/PATCH /character` - Character stats
- `POST /character/checkin` - Daily check-in (streak tracking)
- `GET /activity` - Heatmap data (364 days, matching frontend window)
- `GET/POST /quests` - List/create quests
- `GET/PATCH/DELETE /quests/:id` - CRUD quest
- `POST /quests/:id/complete` - Complete quest (awards XP/Gold, applies multiplier)
- `POST /quests/:id/fail` - Fail quest (deducts XP/Gold)
- `GET /quest-log` - Quest history
- `GET/POST /shop/rewards` - List/create rewards
- `DELETE /shop/rewards/:id` - Delete reward
- `POST /shop/rewards/:id/purchase` - Purchase with Gold
- `GET /bosses` - List bosses (with unlock status)
- `POST /bosses/:id/challenge` - Challenge a boss
- `GET/PUT /awakening` - Vision journal
- `GET /rng/daily-event` - Daily RNG event
- `GET /daily-orders/today` - Today's daily orders
- `POST /daily-orders` - Create daily order (body: { name, statCategory })
- `POST /daily-orders/:id/complete` - Complete an order (awards XP + stat; checks 5/5 Hidden Box)
- `DELETE /daily-orders/:id` - Delete uncompleted order
- `GET /planner/daily` - Today's quests, daily orders, bad habit check-ins, XP summary
- `GET /planner/weekly` - Week's quest grid with completion counts
- `GET /planner/monthly` - Month calendar with completion dots and milestone deadlines
- `GET /planner/yearly` - Year heatmap + key events (boss defeats, high XP days)
- `PATCH /planner/quest/:id/reschedule` - Reschedule a quest to a new deadline date

## Environment Variables

### API Server (`artifacts/api-server`)
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `API_SECRET_KEY` | Prod only | Static secret enforced on all `/api` routes via `X-Api-Key` header. Omit in local dev to skip auth. |
| `CORS_ORIGIN` | Prod only | Exact origin allowed by CORS (e.g. `https://your-app.replit.app`). Defaults to `*` when unset. |

### Frontend (`artifacts/shadow-leveling`)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_KEY` | Prod only | Must match `API_SECRET_KEY`. Injected as `X-Api-Key` header on every API call. Omit in local dev. |

## Replit Migration Notes

- Registered artifact workflows start the API server on port 8080 and the React frontend on port 3000 with `BASE_PATH=/`.
- Legacy duplicate workflows were removed after artifact registration because they conflicted on ports 8080/3000 and caused the artifact preview to show an unreachable app screen.
- The development PostgreSQL schema has been applied with `pnpm --filter @workspace/db run push`.
- The post-merge setup script installs dependencies with the frozen lockfile and reapplies the Drizzle schema push so future merged work keeps the database schema in sync.

## Database Tables

- `character` - Single row, all player stats
- `quests` - All quests with difficulty/category/rewards
- `quest_log` - Immutable history of completions/failures
- `daily_orders` - UUID PK, daily quick-add tasks (expire at midnight, never appear in failure logs)
- `rewards` - Shop items
- `bosses` - Boss challenges with defeat records
- `awakening` - Single row, vision journal
- `activity` - Daily activity for heatmap

## Difficulty System (Rank F to SSS)

XP/Gold scaled by difficulty multiplier:
F(0.5x) E(0.75x) D(1x) C(1.5x) B(2x) A(3x) S(5x) SS(8x) SSS(15x)

## Audit Hardening (Strikes 4-6)

- **Trust proxy**: `app.set("trust proxy", 1)` configured for correct rate limiter behavior behind proxy
- **Soft-delete guards**: All mutation routes (PATCH/complete/fail) check `deletedAt` before operating on quests, vocations
- **RNG math**: Multiplicative stacking formula `char.multiplier * rngMultiplier * (1 + eventBonus)` applied consistently across quest completion, boss challenges, and daily orders
- **parseInt validation**: All `:id` route params validated with `isNaN()` guard returning 400
- **Overdue processing**: `processOverdueQuestsLogic` filters out soft-deleted quests
- **Accessibility**: All dialogs include `DialogDescription` (sr-only where appropriate)
- **DB indexes**: B-Tree indexes on quest_log(occurred_at), quests(status, deleted_at), daily_orders(date, character_id), activity(date), bad_habits(deleted_at)

## Stat System

Stats gain based on quest category:
- Financial → Discipline
- Productivity/Study → Intellect
- Health → Endurance
- Creative/Social → Agility
- Other → Strength
