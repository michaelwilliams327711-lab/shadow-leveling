import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  animate,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { Sword, Star, ArrowRight, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetCharacter } from "@workspace/api-client-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { triggerHapticThud } from "@/lib/haptics";
import { triggerBoom, triggerGoldTick } from "@/lib/audio";

interface StatDelta {
  name: string;
  value: number;
}

interface AscensionPayload {
  prevLevel: number;
  newLevel: number;
  prevXp: number;
  prevXpToNextLevel: number;
  prevGold: number;
  newGold: number;
  statDeltas: StatDelta[];
}

type Phase = "idle" | "gathering" | "ascended";

// 1.5s gathering window — long enough for the gold "tick" flurry to register.
const GATHERING_MS = 1500;

// Throttle floor: ~33 audio ticks/sec max, so a long XP run still sounds
// like a coin flurry rather than a sample-rate hash.
const MIN_TICK_INTERVAL_MS = 30;

// Match Dashboard XP bar — overshoot easing for the cubic-bezier "snap-fit".
const SURGE_EASE: [number, number, number, number] = [0.34, 1.56, 0.64, 1];

const STAT_KEYS = [
  "strength",
  "spirit",
  "endurance",
  "intellect",
  "discipline",
] as const;

const STAT_COLORS: Record<string, string> = {
  strength: "text-red-400",
  spirit: "text-pink-400",
  endurance: "text-green-400",
  intellect: "text-blue-400",
  discipline: "text-purple-400",
};

const PURPLE = "#a855f7";
const GOLD = "#facc15";

type CharacterShape =
  | {
      level?: number;
      xp?: number;
      xpToNextLevel?: number;
      gold?: number;
      strength?: number;
      spirit?: number;
      endurance?: number;
      intellect?: number;
      discipline?: number;
    }
  | null
  | undefined;

function readNum(c: CharacterShape, key: string): number {
  if (!c) return 0;
  const v = (c as Record<string, unknown>)[key];
  return typeof v === "number" ? v : 0;
}

export function GlobalCeremonyWatcher() {
  const { data: character } = useGetCharacter();
  const reduced = useReducedMotion();

  const prevRef = useRef<CharacterShape>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [payload, setPayload] = useState<AscensionPayload | null>(null);

  // Animated values — drive both the displayed numbers and the bar width.
  const xpFill = useMotionValue(0); // 0..100 percent
  const goldVal = useMotionValue(0);
  const [displayGold, setDisplayGold] = useState(0);

  const xpWidth = useTransform(xpFill, (v) =>
    `${Math.min(100, Math.max(0, v))}%`
  );

  // Mirror motion value -> React state so the gold counter can render.
  useEffect(() => {
    return goldVal.on("change", (v) => setDisplayGold(Math.floor(v)));
  }, [goldVal]);

  // Stop any in-flight animation + clear timers.
  const stopActive = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  };

  const handleDismiss = () => {
    stopActive();
    setPhase("idle");
  };

  useEffect(() => {
    if (!character) return;

    if (prevRef.current === null) {
      prevRef.current = character as CharacterShape;
      return;
    }

    const prev = prevRef.current;
    const prevLevel = readNum(prev, "level");
    const newLevel = readNum(character as CharacterShape, "level");

    if (newLevel > prevLevel) {
      const deltas: StatDelta[] = [];
      for (const key of STAT_KEYS) {
        const d =
          readNum(character as CharacterShape, key) - readNum(prev, key);
        if (d > 0) {
          deltas.push({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            value: d,
          });
        }
      }

      const captured: AscensionPayload = {
        prevLevel,
        newLevel,
        prevXp: readNum(prev, "xp"),
        prevXpToNextLevel: readNum(prev, "xpToNextLevel"),
        prevGold: readNum(prev, "gold"),
        newGold: readNum(character as CharacterShape, "gold"),
        statDeltas: deltas,
      };

      stopActive();
      setPayload(captured);
      setPhase("gathering");

      // Initial values — bar starts wherever XP was sitting before the
      // breakthrough; gold counter starts at the previous balance.
      const startPct =
        captured.prevXpToNextLevel > 0
          ? (captured.prevXp / captured.prevXpToNextLevel) * 100
          : 0;
      xpFill.set(startPct);
      goldVal.set(captured.prevGold);
      setDisplayGold(captured.prevGold);

      // Impact haptic at the moment the gathering begins.
      triggerHapticThud();

      // Reduced-motion path: skip the whole gathering animation, jump
      // straight to ASCENDED with no audio ticks.
      if (reduced) {
        xpFill.set(100);
        goldVal.set(captured.newGold);
        setDisplayGold(captured.newGold);
        setPhase("ascended");
        triggerBoom(0.5);
        return;
      }

      // Shared throttle so both XP and Gold can't double-fire on the same
      // animation frame.
      let lastXpInt = Math.floor(startPct);
      let lastGoldInt = captured.prevGold;
      let lastTickAt = 0;

      const tickIfReady = () => {
        const now = performance.now();
        if (now - lastTickAt < MIN_TICK_INTERVAL_MS) return;
        lastTickAt = now;
        triggerGoldTick();
      };

      const xpAnim = animate(xpFill, 100, {
        duration: GATHERING_MS / 1000,
        ease: SURGE_EASE,
        onUpdate: (v) => {
          const intV = Math.floor(v);
          if (intV !== lastXpInt) {
            lastXpInt = intV;
            tickIfReady();
          }
        },
      });

      const goldAnim = animate(goldVal, captured.newGold, {
        duration: GATHERING_MS / 1000,
        ease: SURGE_EASE,
        onUpdate: (v) => {
          const intV = Math.floor(v);
          if (intV !== lastGoldInt) {
            lastGoldInt = intV;
            tickIfReady();
          }
        },
      });

      // Phase shift — 'GATHERING' -> 'ASCENDED' at the level-up threshold.
      const ascendTimer = window.setTimeout(() => {
        // Lock visuals to their final values so the colour swap doesn't
        // catch a mid-bezier overshoot frame.
        xpFill.set(100);
        goldVal.set(captured.newGold);
        setDisplayGold(captured.newGold);
        setPhase("ascended");
        triggerBoom(0.5);
      }, GATHERING_MS);

      cleanupRef.current = () => {
        xpAnim.stop();
        goldAnim.stop();
        window.clearTimeout(ascendTimer);
      };
    }

    prevRef.current = character as CharacterShape;
  }, [character, reduced, xpFill, goldVal]);

  // Always cleanup on unmount.
  useEffect(() => {
    return () => stopActive();
  }, []);

  const visible = phase !== "idle" && payload !== null;
  const isGold = phase === "ascended";
  const themeColor = isGold ? GOLD : PURPLE;
  const themeRgb = isGold ? "250,204,21" : "168,85,247";

  return (
    <AnimatePresence>
      {visible && payload && (
        <motion.div
          key="global-ascension-overlay"
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={
            reduced
              ? { opacity: 0 }
              : { opacity: 0, transition: { duration: 0.4 } }
          }
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center pointer-events-auto backdrop-blur-xl"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={isGold ? handleDismiss : undefined}
          data-testid="global-ascension-overlay"
          data-phase={phase}
        >
          {/* Pulsing radial gradient — purple while gathering, gold once ascended. */}
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0.25 }}
            animate={
              reduced
                ? { opacity: 0.4 }
                : isGold
                ? { opacity: [0.3, 0.6, 0.35, 0.55, 0.3] }
                : { opacity: [0.2, 0.45, 0.25, 0.4, 0.25] }
            }
            transition={
              reduced
                ? { duration: 0.2 }
                : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
            }
            style={{
              background: `radial-gradient(ellipse at center, rgba(${themeRgb},0.45) 0%, rgba(${themeRgb},0.18) 35%, rgba(0,0,0,0) 70%)`,
              transition: "background 600ms ease",
            }}
          />

          {/* 200ms white flash at the moment of ascension. */}
          <AnimatePresence>
            {isGold && !reduced && (
              <motion.div
                aria-hidden
                key="ascension-white-flash"
                className="absolute inset-0 pointer-events-none bg-white"
                initial={{ opacity: 0.95 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>

          <motion.div
            initial={reduced ? {} : { scale: 0.5, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={
              reduced
                ? {}
                : { type: "spring", stiffness: 220, damping: 18 }
            }
            className="relative flex flex-col items-center gap-6 px-8 py-10 rounded-2xl border bg-background/80 backdrop-blur-md max-w-md w-full mx-4"
            style={{
              borderColor: `rgba(${themeRgb},0.55)`,
              boxShadow: `0 0 80px rgba(${themeRgb},0.45), inset 0 0 24px rgba(${themeRgb},0.10)`,
              transition: "border-color 500ms ease, box-shadow 500ms ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sword icon — colour-shifts on the phase change. */}
            <motion.div
              initial={reduced ? {} : { rotate: -20, scale: 0.5 }}
              animate={reduced ? {} : { rotate: 0, scale: 1 }}
              transition={
                reduced
                  ? {}
                  : { type: "spring", stiffness: 300, damping: 12, delay: 0.15 }
              }
            >
              <Sword
                className="w-14 h-14"
                style={{
                  color: themeColor,
                  filter: `drop-shadow(0 0 16px rgba(${themeRgb},0.95))`,
                  transition: "color 500ms ease, filter 500ms ease",
                }}
              />
            </motion.div>

            {/* Phase title — swap the text but keep the slot. */}
            <div className="h-5 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.p
                  key={isGold ? "title-ascended" : "title-gathering"}
                  initial={reduced ? {} : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? {} : { opacity: 0, y: -4 }}
                  transition={reduced ? {} : { duration: 0.25 }}
                  className="font-display font-bold text-xs uppercase tracking-[0.35em]"
                  style={{
                    color: `rgba(${themeRgb},0.9)`,
                    transition: "color 500ms ease",
                  }}
                >
                  {isGold ? "SYSTEM OVERRIDE — RANK UP" : "GATHERING POWER…"}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* LV counter — shows previous level alone while gathering,
                animates to "LV X → LV Y" on ascension. */}
            <div className="flex items-center gap-4 min-h-[80px]">
              <div className="flex flex-col items-center">
                <span className="font-display text-[10px] tracking-[0.3em] text-white/50">
                  LV
                </span>
                <span className="font-stat font-black text-5xl leading-none text-white/60">
                  {payload.prevLevel}
                </span>
              </div>
              <AnimatePresence>
                {isGold && (
                  <>
                    <motion.div
                      key="lv-arrow"
                      initial={reduced ? {} : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={reduced ? {} : { delay: 0.05, duration: 0.3 }}
                    >
                      <ArrowRight
                        className="w-7 h-7"
                        style={{
                          color: GOLD,
                          filter: `drop-shadow(0 0 8px ${GOLD})`,
                        }}
                      />
                    </motion.div>
                    <motion.div
                      key="lv-new"
                      initial={reduced ? {} : { opacity: 0, scale: 1.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={
                        reduced
                          ? {}
                          : {
                              delay: 0.1,
                              type: "spring",
                              stiffness: 280,
                              damping: 14,
                            }
                      }
                      className="flex flex-col items-center"
                    >
                      <span
                        className="font-display text-[10px] tracking-[0.3em]"
                        style={{ color: `rgba(${themeRgb},0.85)` }}
                      >
                        LV
                      </span>
                      <span
                        className="font-stat font-black text-6xl leading-none text-white"
                        style={{
                          textShadow: `0 0 18px rgba(${themeRgb},0.85), 0 0 36px rgba(${themeRgb},0.45)`,
                        }}
                      >
                        {payload.newLevel}
                      </span>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* High-fidelity XP bar — clone of the Dashboard bar. */}
            <div className="w-full">
              <div className="flex justify-between items-baseline mb-2">
                <span className="font-display text-[10px] tracking-[0.3em] text-white/50 uppercase">
                  Experience
                </span>
                <span
                  className="font-stat font-bold text-sm"
                  style={{
                    color: themeColor,
                    transition: "color 500ms ease",
                  }}
                >
                  {isGold
                    ? "BREAKTHROUGH"
                    : `${payload.prevXp.toLocaleString()} / ${payload.prevXpToNextLevel.toLocaleString()}`}
                </span>
              </div>
              <div className="relative h-4 bg-secondary rounded-full overflow-hidden border border-white/5 shadow-inner">
                <motion.div
                  className="absolute top-0 left-0 h-full rounded-full"
                  style={{
                    width: xpWidth,
                    background: isGold
                      ? `linear-gradient(to right, rgba(${themeRgb},0.5), ${GOLD})`
                      : `linear-gradient(to right, rgba(${themeRgb},0.5), ${PURPLE})`,
                    boxShadow: `0 0 10px rgba(${themeRgb},0.8)`,
                    transition:
                      "background 500ms ease, box-shadow 500ms ease",
                  }}
                />
              </div>
            </div>

            {/* Gold counter — animates from prevGold to newGold during gathering. */}
            <div className="w-full flex items-center justify-between border-t border-white/10 pt-4">
              <span className="font-display text-[10px] tracking-[0.3em] text-white/50 uppercase flex items-center gap-2">
                <Coins
                  className="w-3.5 h-3.5"
                  style={{
                    color: themeColor,
                    transition: "color 500ms ease",
                  }}
                />
                Gold
              </span>
              <span
                className="font-stat font-bold text-lg tabular-nums"
                style={{
                  color: themeColor,
                  textShadow: `0 0 12px rgba(${themeRgb},0.6)`,
                  transition: "color 500ms ease, text-shadow 500ms ease",
                }}
                data-testid="ascension-gold-counter"
              >
                {displayGold.toLocaleString()}
              </span>
            </div>

            {/* "ARISE, HUNTER" + 5 stars — only on the ascension shift. */}
            <AnimatePresence>
              {isGold && (
                <motion.div
                  key="arise-block"
                  initial={reduced ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={reduced ? {} : { delay: 0.15, duration: 0.4 }}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="flex items-center gap-1 mb-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={reduced ? {} : { opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={
                          reduced
                            ? {}
                            : { delay: 0.25 + i * 0.07, type: "spring" }
                        }
                      >
                        <Star
                          className="w-4 h-4"
                          style={{ color: GOLD, fill: GOLD }}
                        />
                      </motion.div>
                    ))}
                  </div>
                  <p className="font-display text-lg font-bold text-white/95 tracking-wider">
                    ARISE, HUNTER
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stat deltas — appear AFTER the gold shift, the "rewards of ascension". */}
            <AnimatePresence>
              {isGold && payload.statDeltas.length > 0 && (
                <motion.div
                  key="stat-deltas"
                  initial={reduced ? {} : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={reduced ? {} : { delay: 0.55, duration: 0.4 }}
                  className="w-full border-t border-white/10 pt-4 space-y-1"
                >
                  {payload.statDeltas.map((d, i) => (
                    <motion.div
                      key={d.name}
                      initial={reduced ? {} : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={
                        reduced
                          ? {}
                          : { delay: 0.65 + i * 0.08, duration: 0.3 }
                      }
                      className="flex justify-between text-sm"
                      data-testid={`ascension-stat-${d.name.toLowerCase()}`}
                    >
                      <span
                        className={`font-bold capitalize ${
                          STAT_COLORS[d.name.toLowerCase()] ?? "text-white"
                        }`}
                      >
                        {d.name}
                      </span>
                      <span
                        className="font-stat font-bold"
                        style={{ color: GOLD }}
                      >
                        +{d.value.toLocaleString()}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* CONTINUE — only shown after ascension; locks the modal until clicked. */}
            <AnimatePresence>
              {isGold && (
                <motion.div
                  key="continue-btn"
                  initial={reduced ? {} : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={
                    reduced
                      ? {}
                      : {
                          delay:
                            0.7 +
                            Math.min(payload.statDeltas.length, 5) * 0.08,
                          duration: 0.3,
                        }
                  }
                  className="w-full"
                >
                  <Button
                    onClick={handleDismiss}
                    className="w-full font-display tracking-widest border"
                    style={{
                      background: `rgba(${themeRgb},0.18)`,
                      borderColor: `rgba(${themeRgb},0.55)`,
                      color: GOLD,
                    }}
                    data-testid="ascension-continue"
                  >
                    CONTINUE
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
