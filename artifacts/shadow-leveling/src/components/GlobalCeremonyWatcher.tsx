import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sword, Star, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetCharacter } from "@workspace/api-client-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { triggerHapticThud } from "@/lib/haptics";
import { triggerBoom } from "@/lib/audio";

interface StatDelta {
  name: string;
  value: number;
}

interface AscensionPayload {
  prevLevel: number;
  newLevel: number;
  statDeltas: StatDelta[];
}

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

type CharacterShape = {
  level?: number;
  strength?: number;
  spirit?: number;
  endurance?: number;
  intellect?: number;
  discipline?: number;
} | null
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
  const [isAscending, setIsAscending] = useState<boolean>(false);
  const [payload, setPayload] = useState<AscensionPayload | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

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
        const d = readNum(character as CharacterShape, key) - readNum(prev, key);
        if (d > 0) {
          deltas.push({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            value: d,
          });
        }
      }

      setPayload({ prevLevel, newLevel, statDeltas: deltas });
      setIsAscending(true);
      triggerHapticThud();
      triggerBoom(0.6);

      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
      dismissTimerRef.current = window.setTimeout(() => {
        setIsAscending(false);
      }, 8000);
    }

    prevRef.current = character as CharacterShape;
  }, [character]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current !== null) {
        window.clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  const handleDismiss = () => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    setIsAscending(false);
  };

  return (
    <AnimatePresence>
      {isAscending && payload && (
        <motion.div
          key="global-ascension-overlay"
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.4 } }}
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center pointer-events-auto backdrop-blur-xl"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={handleDismiss}
          data-testid="global-ascension-overlay"
        >
          {/* Pulsing golden radial gradient */}
          <motion.div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0.25 }}
            animate={
              reduced
                ? { opacity: 0.4 }
                : { opacity: [0.25, 0.55, 0.3, 0.5, 0.25] }
            }
            transition={
              reduced
                ? { duration: 0.2 }
                : { duration: 3.6, repeat: Infinity, ease: "easeInOut" }
            }
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(250,204,21,0.45) 0%, rgba(250,204,21,0.18) 35%, rgba(0,0,0,0) 70%)",
            }}
          />

          {/* 200ms white flash on impact */}
          {!reduced && (
            <motion.div
              aria-hidden
              key="ascension-white-flash"
              className="absolute inset-0 pointer-events-none bg-white"
              initial={{ opacity: 0.95 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            />
          )}

          <motion.div
            initial={reduced ? {} : { scale: 0.3, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={
              reduced
                ? {}
                : { type: "spring", stiffness: 220, damping: 16, delay: 0.18 }
            }
            className="relative flex flex-col items-center gap-6 px-10 py-12 rounded-2xl border bg-background/80 backdrop-blur-md max-w-sm w-full mx-4"
            style={{
              borderColor: "rgba(250,204,21,0.55)",
              boxShadow:
                "0 0 80px rgba(250,204,21,0.45), inset 0 0 24px rgba(250,204,21,0.10)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={reduced ? {} : { rotate: -20, scale: 0.5 }}
              animate={reduced ? {} : { rotate: 0, scale: 1 }}
              transition={
                reduced
                  ? {}
                  : { type: "spring", stiffness: 300, damping: 12, delay: 0.3 }
              }
            >
              <Sword
                className="w-16 h-16"
                style={{
                  color: "#facc15",
                  filter: "drop-shadow(0 0 16px rgba(250,204,21,0.95))",
                }}
              />
            </motion.div>

            <motion.p
              initial={reduced ? {} : { opacity: 0, letterSpacing: "0.5em" }}
              animate={{ opacity: 1, letterSpacing: "0.3em" }}
              transition={reduced ? {} : { delay: 0.4, duration: 0.6 }}
              className="font-display font-bold text-sm uppercase tracking-[0.3em]"
              style={{ color: "rgba(250,204,21,0.85)" }}
            >
              SYSTEM OVERRIDE — RANK UP
            </motion.p>

            {/* LV X → LV Y */}
            <motion.div
              initial={reduced ? {} : { scale: 1.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduced ? {} : { delay: 0.5, duration: 0.5, ease: "easeOut" }}
              className="flex items-center gap-4"
            >
              <div className="flex flex-col items-center">
                <span className="font-display text-[10px] tracking-[0.3em] text-white/50">
                  LV
                </span>
                <span className="font-stat font-black text-5xl leading-none text-white/60">
                  {payload.prevLevel}
                </span>
              </div>
              <ArrowRight
                className="w-7 h-7"
                style={{ color: "#facc15", filter: "drop-shadow(0 0 8px #facc15)" }}
              />
              <div className="flex flex-col items-center">
                <span
                  className="font-display text-[10px] tracking-[0.3em]"
                  style={{ color: "rgba(250,204,21,0.85)" }}
                >
                  LV
                </span>
                <span
                  className="font-stat font-black text-6xl leading-none text-white"
                  style={{
                    textShadow:
                      "0 0 18px rgba(250,204,21,0.85), 0 0 36px rgba(250,204,21,0.45)",
                  }}
                >
                  {payload.newLevel}
                </span>
              </div>
            </motion.div>

            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? {} : { delay: 0.7, duration: 0.4 }}
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
                        : { delay: 0.8 + i * 0.08, type: "spring" }
                    }
                  >
                    <Star
                      className="w-4 h-4"
                      style={{ color: "#facc15", fill: "#facc15" }}
                    />
                  </motion.div>
                ))}
              </div>
              <p className="font-display text-lg font-bold text-white/95">
                ARISE, HUNTER
              </p>
            </motion.div>

            {payload.statDeltas.length > 0 && (
              <motion.div
                initial={reduced ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? {} : { delay: 0.95, duration: 0.4 }}
                className="w-full border-t border-white/10 pt-4 space-y-1"
              >
                {payload.statDeltas.map((d) => (
                  <div
                    key={d.name}
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
                      style={{ color: "#facc15" }}
                    >
                      +{d.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}

            <Button
              onClick={handleDismiss}
              className="w-full font-display tracking-widest mt-2 border"
              style={{
                background: "rgba(250,204,21,0.18)",
                borderColor: "rgba(250,204,21,0.55)",
                color: "#facc15",
              }}
              data-testid="ascension-continue"
            >
              CONTINUE
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
