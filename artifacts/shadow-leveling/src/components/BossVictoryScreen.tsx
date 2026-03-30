import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Skull, Zap, Coins, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { playBossVictory } from "@/lib/sounds";
import { ParticleBurst } from "@/components/animation-primitives";

interface StatDelta {
  name: string;
  value: number;
}

interface BossVictoryScreenProps {
  open: boolean;
  bossName: string;
  xpGained: number;
  goldGained: number;
  statDeltas?: StatDelta[];
  onDismiss: () => void;
}

const STAT_COLORS: Record<string, string> = {
  strength: "text-red-400",
  agility: "text-yellow-400",
  endurance: "text-green-400",
  intellect: "text-blue-400",
  discipline: "text-purple-400",
};

export function BossVictoryScreen({ open, bossName, xpGained, goldGained, statDeltas, onDismiss }: BossVictoryScreenProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    if (!reduced) playBossVictory();
    const timer = setTimeout(onDismiss, 10000);
    return () => clearTimeout(timer);
  }, [open, reduced, onDismiss]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="boss-victory"
          initial={reduced ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, transition: { duration: 0.5 } }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center pointer-events-auto"
          style={{ background: "radial-gradient(ellipse at center, rgba(220,38,38,0.3) 0%, rgba(0,0,0,0.95) 70%)" }}
          onClick={onDismiss}
        >
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <ParticleBurst count={24} colors={["#ef4444", "#facc15", "#a855f7", "#f97316"]} spread={400} reduced={reduced} />
          </div>

          <motion.div
            initial={reduced ? {} : { scale: 0.4, opacity: 0, y: 60 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={reduced ? {} : { type: "spring", stiffness: 180, damping: 14, delay: 0.2 }}
            className="relative flex flex-col items-center gap-6 px-10 py-12 rounded-2xl border border-destructive/60 bg-background/85 backdrop-blur-md shadow-[0_0_80px_rgba(220,38,38,0.5)] max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={reduced ? {} : { rotateY: 180, scale: 0 }}
              animate={{ rotateY: 0, scale: 1 }}
              transition={reduced ? {} : { delay: 0.35, type: "spring", stiffness: 200 }}
            >
              <Skull className="w-16 h-16 text-destructive drop-shadow-[0_0_20px_rgba(220,38,38,0.9)]" />
            </motion.div>

            <motion.div
              initial={reduced ? {} : { opacity: 0, scale: 1.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduced ? {} : { delay: 0.5, duration: 0.5 }}
              className="text-center"
            >
              <p className="font-display font-black text-4xl text-destructive tracking-widest drop-shadow-[0_0_12px_rgba(220,38,38,0.8)] uppercase">
                VICTORY
              </p>
              <p className="text-white/60 text-sm font-sans mt-1 tracking-widest">{bossName} has fallen</p>
            </motion.div>

            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? {} : { delay: 0.7 }}
              className="w-full bg-background/50 border border-white/10 rounded-xl p-4 space-y-3"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold text-center">Rewards Claimed</p>
              <div className="flex justify-around">
                <div className="flex flex-col items-center gap-1">
                  <Zap className="w-5 h-5 text-primary" />
                  <span className="font-stat font-bold text-primary text-xl">+{xpGained.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">XP</span>
                </div>
                <div className="w-px bg-white/10" />
                <div className="flex flex-col items-center gap-1">
                  <Coins className="w-5 h-5 text-yellow-400" />
                  <span className="font-stat font-bold text-yellow-400 text-xl">+{goldGained.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">Gold</span>
                </div>
              </div>
            </motion.div>

            {statDeltas && statDeltas.length > 0 && (
              <motion.div
                initial={reduced ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? {} : { delay: 0.85 }}
                className="w-full border border-white/10 rounded-xl p-3 space-y-1"
              >
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold text-center mb-2">Stats Boosted</p>
                {statDeltas.map((d) => (
                  <div key={d.name} className="flex justify-between text-sm">
                    <span className={`font-bold capitalize ${STAT_COLORS[d.name.toLowerCase()] ?? "text-white"}`}>{d.name}</span>
                    <span className="text-primary font-stat font-bold">+{d.value.toLocaleString()}</span>
                  </div>
                ))}
              </motion.div>
            )}

            <motion.div
              initial={reduced ? {} : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduced ? {} : { delay: 0.9 }}
              className="flex items-center gap-2"
            >
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-xs text-yellow-400/80 font-display tracking-widest">DUNGEON CLEARED</span>
              <Trophy className="w-4 h-4 text-yellow-400" />
            </motion.div>

            <Button
              onClick={onDismiss}
              className="w-full bg-destructive/20 border border-destructive/50 text-destructive hover:bg-destructive/30 font-display tracking-widest"
            >
              CLAIM GLORY
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
