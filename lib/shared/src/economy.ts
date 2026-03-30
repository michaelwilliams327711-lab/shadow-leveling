export { XP_PER_LEVEL } from "./levelUp.js";

export const CATEGORY_STAT_MAP: Record<string, string> = {
  Financial: "intellect",
  Productivity: "intellect",
  Study: "intellect",
  Health: "endurance",
  Creative: "agility",
  Social: "agility",
  Other: "strength",
};

export const RANK_BASE_REWARDS: Record<string, { xp: number; gold: number }> = {
  F:   { xp: 10,  gold: 5   },
  E:   { xp: 25,  gold: 12  },
  D:   { xp: 50,  gold: 25  },
  C:   { xp: 100, gold: 50  },
  B:   { xp: 175, gold: 85  },
  A:   { xp: 275, gold: 135 },
  S:   { xp: 350, gold: 175 },
  SS:  { xp: 425, gold: 210 },
  SSS: { xp: 500, gold: 250 },
};

export const DURATION_BONUS_PER_MINUTE = { xp: 0.3, gold: 0.15 };

export const XP_PENALTY_RATIO = 0.5;
export const GOLD_PENALTY_RATIO = 0.3;

export const STREAK_MULTIPLIER = (streak: number): number => {
  if (streak >= 30) return 3.0;
  if (streak >= 14) return 2.5;
  if (streak >= 7) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
};

export function getStreakStatMultiplier(streak: number): number {
  if (streak >= 60) return 2.0;
  if (streak >= 30) return 1.5;
  if (streak >= 14) return 1.25;
  if (streak >= 7) return 1.1;
  return 1.0;
}

export const MILESTONE_STREAKS: Record<number, { xp: number; gold: number }> = {
  7:   { xp: 200,  gold: 500  },
  14:  { xp: 350,  gold: 750  },
  30:  { xp: 500,  gold: 1000 },
  60:  { xp: 1000, gold: 2000 },
  100: { xp: 2500, gold: 5000 },
};
