import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { playRankUp } from "@/lib/sounds";
import { ScaleUp } from "@/components/animation-primitives";

interface RankUpNotificationProps {
  open: boolean;
  statName: string;
  statValue: number;
  onDismiss: () => void;
}

const STAT_COLORS: Record<string, { text: string; glow: string }> = {
  strength: { text: "text-red-400", glow: "rgba(248,113,113,0.5)" },
  agility: { text: "text-yellow-400", glow: "rgba(250,204,21,0.5)" },
  endurance: { text: "text-green-400", glow: "rgba(74,222,128,0.5)" },
  intellect: { text: "text-blue-400", glow: "rgba(96,165,250,0.5)" },
  discipline: { text: "text-purple-400", glow: "rgba(192,132,252,0.5)" },
};

export function RankUpNotification({ open, statName, statValue, onDismiss }: RankUpNotificationProps) {
  const reduced = useReducedMotion();
  const colors = STAT_COLORS[statName.toLowerCase()] ?? { text: "text-primary", glow: "rgba(124,58,237,0.5)" };

  useEffect(() => {
    if (!open) return;
    if (!reduced) playRankUp();
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [open, reduced, onDismiss]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="rank-up"
          initial={reduced ? { opacity: 1 } : { opacity: 0, x: 80 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: 80, transition: { duration: 0.3 } }}
          transition={reduced ? {} : { type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
          className="fixed bottom-6 right-6 z-[190] pointer-events-auto"
        >
          <div
            className="flex items-center gap-3 px-5 py-4 rounded-xl border bg-background/90 backdrop-blur-md cursor-pointer"
            style={{ borderColor: colors.glow.replace("0.5", "0.6"), boxShadow: `0 0 24px ${colors.glow}` }}
            onClick={onDismiss}
          >
            <ScaleUp reduced={reduced} delay={0.2}>
              <TrendingUp className={`w-6 h-6 ${colors.text}`} />
            </ScaleUp>
            <div>
              <p className={`font-display font-bold text-sm tracking-widest uppercase ${colors.text}`}>
                RANK UP — {statName}
              </p>
              <p className="text-xs text-white/60 font-sans">{statValue.toLocaleString()} points reached</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
