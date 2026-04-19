export { CATEGORY_STAT_MAP } from "./economy.js";

// Shared PostgreSQL advisory lock key — used by both the login route and
// the cron job to serialize character initialization.
export const ADVISORY_LOCK_ID = 9001;

export const STAT_KEYS = ["strength", "spirit", "endurance", "intellect", "discipline"] as const;
export type StatKey = typeof STAT_KEYS[number];

export const STAT_META: Record<StatKey, { label: string; abbr: string; color: string }> = {
  strength:   { label: "Strength",   abbr: "STR", color: "#f87171" },
  spirit:     { label: "Spirit",     abbr: "SPI", color: "#f472b6" },
  endurance:  { label: "Endurance",  abbr: "END", color: "#4ade80" },
  intellect:  { label: "Intellect",  abbr: "INT", color: "#60a5fa" },
  discipline: { label: "Discipline", abbr: "DIS", color: "#c084fc" },
};

export * from "./levelUp.js";
export * from "./economy.js";
export * from "./time.js";
