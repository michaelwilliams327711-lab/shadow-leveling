export const MAX_LEVELUP_ITERATIONS = 100;

const XP_BASE = 100;
const XP_GROWTH = 1.2;

/**
 * XP required to advance from `level` to `level + 1`.
 *
 * Logarithmic / geometric scaling: 100 * 1.2^(level - 1)
 * Designed so early levels are quick and late levels demand true Monarch effort.
 *
 * Level 1→2: 100 XP | Level 2→3: 120 XP | Level 3→4: 144 XP | Level 10→11: ~516 XP | Level 50→51: ~736,629 XP
 */
export function XP_PER_LEVEL(level: number): number {
  const safeLevel = Math.max(1, level);
  return Math.floor(XP_BASE * Math.pow(XP_GROWTH, safeLevel - 1));
}

/**
 * Total XP accumulated across all completed levels (past levels + current progress).
 *
 * Closed form for the geometric series:
 *   sum_{k=0}^{level-2} 100 * 1.2^k  =  500 * (1.2^(level-1) - 1)
 */
export function totalXpEarned(xp: number, level: number): number {
  const safeLevel = Math.max(1, level);
  const pastLevels = (XP_BASE / (XP_GROWTH - 1)) * (Math.pow(XP_GROWTH, safeLevel - 1) - 1);
  return xp + Math.floor(pastLevels);
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
