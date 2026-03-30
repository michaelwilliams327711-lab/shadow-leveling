import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ParticleBurst } from "@/components/animation-primitives";

interface QuestCompleteEffectProps {
  active: boolean;
  onDone?: () => void;
}

export function QuestCompleteEffect({ active, onDone }: QuestCompleteEffectProps) {
  const reduced = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active && onDone) {
      timerRef.current = setTimeout(onDone, 1000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, onDone]);

  if (reduced) return null;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="quest-complete-effect"
          className="absolute inset-0 pointer-events-none overflow-visible z-10 flex items-center justify-center"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ParticleBurst count={14} colors={["#a855f7", "#22d3ee", "#facc15", "#4ade80", "#f472b6"]} spread={120} reduced={false} />
          <motion.div
            className="absolute inset-0 rounded-lg"
            style={{ boxShadow: "inset 0 0 0 2px rgba(168,85,247,0.8)" }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
