import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";

interface EvolutionAnimationProps {
  oldTitle: string;
  newTitle: string;
  onComplete: () => void;
}

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  x: (Math.random() - 0.5) * 2,
  y: (Math.random() - 0.5) * 2,
  scale: 0.5 + Math.random() * 1.5,
  delay: Math.random() * 0.4,
  color: ["#7c3aed", "#a855f7", "#f59e0b", "#fbbf24", "#ec4899"][Math.floor(Math.random() * 5)],
}));

export function EvolutionAnimation({ oldTitle, newTitle, onComplete }: EvolutionAnimationProps) {
  const [phase, setPhase] = useState<"enter" | "reveal" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), 1000);
    const t2 = setTimeout(() => setPhase("exit"), 3500);
    const t3 = setTimeout(() => onComplete(), 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 overflow-hidden"
      onClick={() => {
        setPhase("exit");
        setTimeout(onComplete, 400);
      }}
    >
      {PARTICLES.map((p) => (
        <motion.div
          key={p.id}
          initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
          animate={
            phase !== "enter"
              ? {
                  opacity: [0, 1, 0],
                  scale: [0, p.scale, 0],
                  x: `${p.x * 60}vw`,
                  y: `${p.y * 60}vh`,
                }
              : {}
          }
          transition={{ duration: 2.5, delay: p.delay, ease: "easeOut" }}
          className="absolute w-2 h-2 rounded-full pointer-events-none"
          style={{ background: p.color, left: "50%", top: "50%", marginLeft: -4, marginTop: -4 }}
        />
      ))}

      <div className="relative text-center space-y-8 px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "backOut" }}
          className="space-y-2"
        >
          <p className="text-sm tracking-[0.3em] uppercase text-primary/60">Class Evolution</p>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/50" />
            <Star className="w-5 h-5 text-primary animate-pulse" />
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/50" />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {phase === "enter" && (
            <motion.div
              key="old"
              initial={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="space-y-2"
            >
              <p className="text-sm text-muted-foreground tracking-widest uppercase">Was</p>
              <p
                className="text-4xl md:text-5xl font-display font-black text-zinc-400"
                style={{ textShadow: "0 0 30px rgba(255,255,255,0.1)" }}
              >
                {oldTitle}
              </p>
            </motion.div>
          )}

          {phase === "reveal" && (
            <motion.div
              key="new"
              initial={{ opacity: 0, y: 40, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ duration: 0.6, ease: "backOut" }}
              className="space-y-2"
            >
              <p className="text-sm text-muted-foreground tracking-widest uppercase">Evolved to</p>
              <motion.p
                className="text-5xl md:text-7xl font-display font-black text-white"
                animate={{
                  textShadow: [
                    "0 0 20px rgba(124,58,237,0.5)",
                    "0 0 60px rgba(124,58,237,0.9)",
                    "0 0 20px rgba(124,58,237,0.5)",
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {newTitle}
              </motion.p>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto max-w-xs"
              />
            </motion.div>
          )}

          {phase === "exit" && (
            <motion.div
              key="exit"
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: 0.5 }}
              className="space-y-2"
            >
              <p className="text-5xl md:text-7xl font-display font-black text-white">{newTitle}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === "reveal" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-4 left-0 right-0 text-center"
          >
            <p className="text-xs text-muted-foreground/50">Click anywhere to continue</p>
          </motion.div>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={phase === "reveal" ? { opacity: [0, 0.3, 0] } : { opacity: 0 }}
        transition={{ duration: 1, times: [0, 0.5, 1] }}
        className="absolute inset-0 bg-primary pointer-events-none"
      />
    </motion.div>
  );
}
