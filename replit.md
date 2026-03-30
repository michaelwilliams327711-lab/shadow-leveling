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

1. **Character Dashboard** - Level, XP progress, Gold, streak counter, stats (STR/INT/END/AGI/DIS), Radar chart, GitHub-style activity heatmap, daily check-in button, RNG event banner
2. **Daily Orders** - Lightweight quick-add tasks on Dashboard. Type name, pick stat, press Enter. Awards E-rank XP (25) + 1 stat point. X/5 counter; at 5/5 a Hidden Box triggers with Gold or stat boost reward revealed via Solo Leveling-style animation. Orders vanish at midnight with zero penalty.
3. **Quest System** - CRUD quests with Rank (F-SSS), category, duration. Complete/Fail with XP+Gold rewards/penalties scaled to difficulty. Quest log history.
4. **Streak System** - Daily check-in builds streak, multipliers (1x-3x), milestone bonuses at 7/14/30/60/100 days
5. **RNG Events** - Deterministic daily random events (30% chance): Surge Day, Treasure Surge, Awakening Pulse, Chaos Rift
6. **Rewards Shop** - Spend Gold on custom guilt-free rewards
7. **Boss Arena** - Locked bosses that unlock at XP thresholds. Win/lose with permanent records
8. **The Awakening** - Vision/Anti-Vision journaling page

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

## Stat System

Stats gain based on quest category:
- Financial → Discipline
- Productivity/Study → Intellect  
- Health → Endurance
- Creative/Social → Agility
- Other → Strength
