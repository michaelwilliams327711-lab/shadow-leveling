export const MAX_LEVELUP_ITERATIONS = 100;

/**
 * XP required to advance from `level` to `level + 1`.
 * Derived from the spec formula: Level = floor(sqrt(TotalXP / 10)) + 1
 * which gives XP_PER_LEVEL(n) = (2n - 1) * 10  (arithmetic progression).
 *
 * Level 1→2: 10 XP | Level 2→3: 30 XP | Level 3→4: 50 XP | Level n→n+1: (2n-1)*10 XP
 */
export function XP_PER_LEVEL(level: number): number {
  return (2 * Math.max(1, level) - 1) * 10;
}

/**
 * Total XP accumulated across all levels (past levels + current progress).
 * O(1) closed form: totalXp = xp + 10 * (level - 1)^2
 */
export function totalXpEarned(xp: number, level: number): number {
  return xp + 10 * Math.pow(Math.max(1, level) - 1, 2);
}

export function processLevelUp(xp: number, level: number): { xp: number; level: number } {
  let newXp = xp;
  let newLevel = level;
  let iterations = 0;
  while (newXp >= XP_PER_LEVEL(newLevel)) {
    if (iterations >= MAX_LEVELUP_ITERATIONS) {
      console.warn(`[processLevelUp] Level-up loop hit MAX_ITERATIONS cap (${MAX_LEVELUP_ITERATIONS}). Breaking.`);
      break;
    }
    newXp -= XP_PER_LEVEL(newLevel);
    newLevel++;
    iterations++;
  }
  return { xp: newXp, level: newLevel };
}
