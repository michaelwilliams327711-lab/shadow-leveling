import { Router, type IRouter } from "express";

const router: IRouter = Router();

const RNG_EVENTS = [
  {
    type: "streak_multiplier_day",
    title: "⚡ SURGE DAY",
    description: "The gates of power have opened. All quest rewards gain a bonus multiplier today.",
    multiplierBonus: 0.5,
  },
  {
    type: "double_gold_day",
    title: "💰 TREASURE SURGE",
    description: "Gold flows freely from the Shadow Realm. Gold rewards are doubled on all quests today.",
    multiplierBonus: 1.0,
  },
  {
    type: "bonus_xp_day",
    title: "🌟 AWAKENING PULSE",
    description: "A surge of power ripples through the system. XP gains are amplified today.",
    multiplierBonus: 0.75,
  },
  {
    type: "chaos_challenge",
    title: "💀 CHAOS RIFT",
    description: "The Shadow Monarch's will manifests. Complete any quest under extreme conditions for triple rewards.",
    multiplierBonus: 2.0,
  },
];

function deterministicRng(date: string): number {
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = (hash << 5) - hash + date.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

router.get("/rng/daily-event", async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const hash = deterministicRng(today);
    const eventChance = hash % 100;
    const hasEvent = eventChance < 30;

    if (!hasEvent) {
      return res.json({ hasEvent: false, event: null });
    }

    const eventIndex = hash % RNG_EVENTS.length;
    const event = RNG_EVENTS[eventIndex];

    res.json({ hasEvent: true, event });
  } catch (err) {
    req.log.error({ err }, "Error getting RNG event");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
