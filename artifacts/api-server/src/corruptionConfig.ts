export const corruptionConfig = {
  corruptionDelta: {
    Low: 5,
    Medium: 15,
    High: 30,
  },

  xpPenalty: {
    Low: 20,
    Medium: 50,
    High: 100,
  },

  purificationStreakDays: 3,

  thresholds: {
    low: 20,
    mid: 50,
    high: 80,
  },
} as const;

export type HabitSeverity = "Low" | "Medium" | "High";
