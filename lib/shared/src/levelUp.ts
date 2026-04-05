export const MAX_LEVELUP_ITERATIONS = 100;

export function XP_PER_LEVEL(level: number): number {
  return Math.floor(100 * Math.pow(Math.max(1, level), 1.5));
}

export function totalXpEarned(xp: number, level: number): number {
  let sum = xp;
  for (let n = 1; n <= level - 1; n++) {
    sum += Math.floor(100 * Math.pow(n, 1.5));
  }
  return sum;
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
