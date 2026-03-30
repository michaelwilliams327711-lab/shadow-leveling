import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Star, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { playStreakMilestone } from "@/lib/sounds";
import { FadeIn, GlowPulse } from "@/components/animation-primitives";

interface StreakMilestoneBannerProps {
  open: boolean;
  streak: number;
  onDismiss: () => void;
}

function getMilestoneInfo(streak: number) {
  if (streak >= 365) return { label: "LEGENDARY", color: "text-yellow-400", glow: "rgba(250,204,21,0.5)", icon: Star, desc: "One full year of discipline. You are untouchable." };
  if (streak >= 100) return { label: "ELITE", color: "text-purple-400", glow: "rgba(168,85,247,0.5)", icon: Zap, desc: "100 days strong. Few ever reach this threshold." };
  if (streak >= 30) return { label: "VETERAN", color: "text-blue-400", glow: "rgba(96,165,250,0.5)", icon: Flame, desc: "One month of unbroken discipline. Impressive." };
  return { label: "HUNTER", color: "text-orange-400", glow: "rgba(251,146,60,0.5)", icon: Flame, desc: "Seven days without breaking. The streak begins." };
}

export function StreakMilestoneBanner({ open, streak, onDismiss }: StreakMilestoneBannerProps) {
  const reduced = useReducedMotion();
  const info = getMilestoneInfo(streak);
  const Icon = info.icon;

  useEffect(() => {
    if (!open) return;
    if (!reduced) playStreakMilestone();
    const timer = setTimeout(onDismiss, 7000);
    return () => clearTimeout(timer);
  }, [open, reduced, onDismiss]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="streak-banner"
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: -80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: -80, transition: { duration: 0.4 } }}
          transition={reduced ? {} : { type: "spring", stiffness: 200, damping: 18 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4 pointer-events-auto"
        >
          <div
            className="relative flex flex-col items-center gap-3 px-8 py-6 rounded-2xl border bg-background/90 backdrop-blur-lg"
            style={{ borderColor: info.glow.replace("0.5", "0.6"), boxShadow: `0 0 40px ${info.glow}` }}
          >
            <motion.div
              initial={reduced ? {} : { scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={reduced ? {} : { delay: 0.2, type: "spring", stiffness: 300 }}
              className="flex items-center gap-2"
            >
              <Icon className={`w-8 h-8 ${info.color}`} style={{ filter: `drop-shadow(0 0 8px ${info.glow})` }} />
              <span className={`font-stat font-black text-3xl ${info.color}`}>{streak}</span>
              <Icon className={`w-8 h-8 ${info.color}`} style={{ filter: `drop-shadow(0 0 8px ${info.glow})` }} />
            </motion.div>

            <FadeIn reduced={reduced} delay={0.35} className="text-center">
              <GlowPulse reduced={reduced} color={info.glow} className="inline-block">
                <p className={`font-display font-black text-xl tracking-widest uppercase ${info.color}`}>
                  {info.label} STREAK
                </p>
              </GlowPulse>
              <p className="text-sm text-white/60 font-sans mt-1">{info.desc}</p>
            </FadeIn>

            <Button
              size="sm"
              onClick={onDismiss}
              className={`border font-display tracking-widest text-xs bg-transparent hover:bg-white/5`}
              style={{ borderColor: info.glow.replace("0.5", "0.4"), color: info.color.replace("text-", "").replace("-400", "") === "yellow" ? "#facc15" : undefined }}
            >
              ACKNOWLEDGED
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
