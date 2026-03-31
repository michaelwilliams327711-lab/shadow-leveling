import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sword, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { playLevelUp } from "@/lib/sounds";
import { ParticleBurst, FadeIn, ScaleUp } from "@/components/animation-primitives";

interface StatDelta {
  name: string;
  value: number;
}

interface LevelUpCeremonyProps {
  open: boolean;
  newLevel: number;
  statDeltas?: StatDelta[];
  onDismiss: () => void;
}

const STAT_COLORS: Record<string, string> = {
  strength: "text-red-400",
  agility: "text-cyan-400",
  endurance: "text-green-400",
  intellect: "text-blue-400",
  discipline: "text-purple-400",
};

export function LevelUpCeremony({ open, newLevel, statDeltas, onDismiss }: LevelUpCeremonyProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    if (!reduced) playLevelUp();
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [open, reduced, onDismiss]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="level-up-overlay"
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.4 } }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center pointer-events-auto"
          style={{ background: "radial-gradient(ellipse at center, rgba(124,58,237,0.35) 0%, rgba(0,0,0,0.92) 70%)" }}
          onClick={onDismiss}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <ParticleBurst count={20} colors={["#a855f7", "#c084fc", "#e879f9", "#facc15"]} spread={300} reduced={reduced} />
          </div>

          <motion.div
            initial={reduced ? {} : { scale: 0.3, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={reduced ? {} : { type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
            className="relative flex flex-col items-center gap-6 px-10 py-12 rounded-2xl border border-primary/60 bg-background/80 backdrop-blur-md shadow-[0_0_80px_rgba(124,58,237,0.6)] max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={reduced ? {} : { rotate: -20, scale: 0.5 }}
              animate={reduced ? {} : { rotate: 0, scale: 1 }}
              transition={reduced ? {} : { type: "spring", stiffness: 300, damping: 12, delay: 0.3 }}
            >
              <Sword className="w-16 h-16 text-primary drop-shadow-[0_0_16px_rgba(124,58,237,0.9)]" />
            </motion.div>

            <motion.p
              initial={reduced ? {} : { opacity: 0, letterSpacing: "0.5em" }}
              animate={{ opacity: 1, letterSpacing: "0.3em" }}
              transition={reduced ? {} : { delay: 0.4, duration: 0.6 }}
              className="font-display font-bold text-sm text-primary/80 uppercase tracking-[0.3em]"
            >
              LEVEL UP
            </motion.p>

            <motion.div
              initial={reduced ? {} : { scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={reduced ? {} : { delay: 0.5, duration: 0.5, ease: "easeOut" }}
              className="text-center"
            >
              <span className="font-stat font-black text-[6rem] leading-none text-white drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
                {newLevel}
              </span>
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
                    transition={reduced ? {} : { delay: 0.8 + i * 0.1, type: "spring" }}
                  >
                    <Star className="w-4 h-4 text-primary fill-primary" />
                  </motion.div>
                ))}
              </div>
              <p className="font-display text-lg font-bold text-white/90">ARISE, HUNTER</p>
            </motion.div>

            {statDeltas && statDeltas.length > 0 && (
              <FadeIn reduced={reduced} delay={0.9} className="w-full border-t border-white/10 pt-4 space-y-1">
                {statDeltas.map((d) => (
                  <div key={d.name} className="flex justify-between text-sm">
                    <span className={`font-bold capitalize ${STAT_COLORS[d.name.toLowerCase()] ?? "text-white"}`}>{d.name}</span>
                    <span className="text-primary font-stat font-bold">+{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </FadeIn>
            )}

            <Button
              onClick={onDismiss}
              className="w-full bg-primary/20 border border-primary/50 text-primary hover:bg-primary/30 font-display tracking-widest mt-2"
            >
              CONTINUE
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
