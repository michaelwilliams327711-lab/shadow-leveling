import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ParticleBurst } from "@/components/animation-primitives";
import { KeyRound } from "lucide-react";

interface GateFragmentDropAnimationProps {
  active: boolean;
  fragmentCount: number;
  onDone?: () => void;
}

export function GateFragmentDropAnimation({ active, fragmentCount, onDone }: GateFragmentDropAnimationProps) {
  const reduced = useReducedMotion();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (active && onDone) {
      timerRef.current = setTimeout(onDone, 2200);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, onDone]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="gate-fragment-drop"
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {!reduced && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.18, 0] }}
              transition={{ duration: 1.4, ease: "easeOut" }}
              style={{
                background: "radial-gradient(ellipse at center, rgba(236,72,153,0.45) 0%, transparent 70%)",
              }}
            />
          )}

          <div className="relative flex flex-col items-center gap-3">
            {!reduced && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <ParticleBurst
                  count={18}
                  colors={["#ec4899", "#f472b6", "#fbcfe8", "#db2777", "#f9a8d4"]}
                  spread={100}
                  reduced={false}
                />
              </div>
            )}

            <motion.div
              initial={{ scale: 0, rotate: -30, opacity: 0 }}
              animate={{ scale: [0, 1.3, 1.0], rotate: [- 30, 10, 0], opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18, duration: 0.6 }}
              className="relative"
            >
              {!reduced && (
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  animate={{ opacity: [0.8, 0.3, 0.8], scale: [1, 1.4, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  style={{
                    background: "radial-gradient(ellipse at center, rgba(236,72,153,0.7) 0%, transparent 70%)",
                  }}
                />
              )}
              <div className="bg-pink-950/80 border-2 border-pink-400/70 rounded-2xl p-5 shadow-[0_0_30px_rgba(236,72,153,0.6)]">
                <KeyRound className="w-12 h-12 text-pink-300" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-pink-200 font-display font-bold text-xl tracking-widest uppercase drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">
                Gate Fragment
              </span>
              <span className="text-pink-400 text-sm font-mono tracking-wide">
                Acquired — {fragmentCount} / 3
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
