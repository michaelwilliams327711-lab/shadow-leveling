import { memo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { playSystemWarning } from "@/lib/sounds";

interface AwakeningOverlayProps {
  open: boolean;
  onDismiss: () => void;
}

const GLITCH_CHARS = "!<>-_\\/[]{}—=+*^?#________";

function glitchVariants(reduced: boolean) {
  if (reduced) return {};
  return {
    initial: { opacity: 0, x: -4 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.15 },
  };
}

function AwakeningOverlayBase({ open, onDismiss }: AwakeningOverlayProps) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    if (!reduced) playSystemWarning();
    const timer = setTimeout(onDismiss, 10000);
    return () => clearTimeout(timer);
  }, [open, reduced, onDismiss]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="awakening-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          className="fixed inset-0 z-[300] flex flex-col items-center justify-center pointer-events-auto cursor-pointer"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(88,28,235,0.45) 0%, rgba(0,0,0,0.97) 65%)",
          }}
          onClick={onDismiss}
        >
          {/* Scanline overlay */}
          {!reduced && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)",
              }}
            />
          )}

          {/* Electric border pulse */}
          {!reduced && (
            <motion.div
              className="absolute inset-4 rounded-2xl pointer-events-none"
              animate={{
                boxShadow: [
                  "0 0 0px rgba(139,92,246,0)",
                  "0 0 40px rgba(139,92,246,0.8)",
                  "0 0 80px rgba(139,92,246,0.4)",
                  "0 0 20px rgba(139,92,246,0.6)",
                  "0 0 60px rgba(139,92,246,0.9)",
                ],
              }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}

          <motion.div
            initial={reduced ? {} : { scale: 0.85, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={
              reduced ? {} : { type: "spring", stiffness: 180, damping: 14, delay: 0.1 }
            }
            className="relative flex flex-col items-center gap-8 px-12 py-14 max-w-lg w-full mx-4 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* System notification header */}
            <motion.div
              className="w-full border border-violet-500/60 rounded px-4 py-2 bg-violet-950/60 backdrop-blur-sm"
              animate={
                reduced
                  ? {}
                  : {
                      borderColor: [
                        "rgba(139,92,246,0.4)",
                        "rgba(167,139,250,0.9)",
                        "rgba(139,92,246,0.4)",
                      ],
                    }
              }
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              <p
                className="text-center font-mono text-[10px] tracking-[0.35em] uppercase text-violet-300"
                style={{ textShadow: "0 0 8px rgba(167,139,250,0.8)" }}
              >
                [ SYSTEM NOTIFICATION: VOCATION RANK INCREASED ]
              </p>
            </motion.div>

            {/* Main title */}
            <div className="text-center space-y-3">
              <motion.div
                initial={reduced ? {} : { opacity: 0, letterSpacing: "0.6em" }}
                animate={{ opacity: 1, letterSpacing: "0.2em" }}
                transition={reduced ? {} : { delay: 0.3, duration: 0.6 }}
              >
                <p
                  className="font-display font-black text-sm tracking-[0.2em] text-violet-400 uppercase mb-2"
                  style={{ textShadow: "0 0 12px rgba(139,92,246,0.9)" }}
                >
                  TECH_MONARCH
                </p>
              </motion.div>

              <motion.div
                initial={reduced ? {} : { scale: 2.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduced ? {} : { delay: 0.45, duration: 0.5, ease: "easeOut" }}
              >
                <p
                  className="font-display font-black text-5xl md:text-7xl text-white"
                  style={{
                    textShadow:
                      "0 0 30px rgba(139,92,246,1), 0 0 60px rgba(139,92,246,0.5), 0 0 90px rgba(88,28,235,0.3)",
                  }}
                >
                  RANK I
                </p>
              </motion.div>

              <motion.p
                initial={reduced ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduced ? {} : { delay: 0.65, duration: 0.4 }}
                className="font-mono text-xs tracking-[0.25em] text-violet-300/80 uppercase"
              >
                ACHIEVED
              </motion.p>
            </div>

            {/* Glitch bars */}
            {!reduced && (
              <div className="w-full space-y-1">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="h-px w-full"
                    animate={{
                      scaleX: [0, 1, 0.4, 1, 0],
                      opacity: [0, 1, 0.6, 1, 0],
                      backgroundColor: ["#7c3aed", "#a78bfa", "#7c3aed"],
                    }}
                    transition={{
                      duration: 0.6,
                      delay: 0.7 + i * 0.12,
                      repeat: Infinity,
                      repeatDelay: 1.5 + i * 0.3,
                    }}
                    style={{ transformOrigin: i % 2 === 0 ? "left" : "right" }}
                  />
                ))}
              </div>
            )}

            {/* Stat line */}
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduced ? {} : { delay: 0.8, duration: 0.4 }}
              className="w-full border border-violet-800/50 rounded px-6 py-3 bg-black/40 backdrop-blur-sm"
            >
              <p className="text-center font-mono text-xs text-violet-200/70 tracking-widest">
                VOCATION LEVEL THRESHOLD CROSSED <span className="text-violet-400">→ 1000 VXP</span>
              </p>
            </motion.div>

            <Button
              onClick={onDismiss}
              className="w-full bg-violet-900/40 border border-violet-500/60 text-violet-200 hover:bg-violet-800/50 font-display tracking-[0.25em] uppercase text-sm"
              style={{ boxShadow: "0 0 16px rgba(139,92,246,0.3)" }}
            >
              ACKNOWLEDGE
            </Button>
          </motion.div>

          {/* Random glitch character flash */}
          {!reduced &&
            [...Array(8)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute font-mono text-violet-500/30 text-xs pointer-events-none select-none"
                style={{
                  top: `${10 + i * 10}%`,
                  left: `${5 + ((i * 17) % 90)}%`,
                }}
                animate={{ opacity: [0, 0.6, 0], content: GLITCH_CHARS }}
                transition={{
                  duration: 0.4,
                  delay: i * 0.15,
                  repeat: Infinity,
                  repeatDelay: 1 + i * 0.2,
                }}
              >
                {GLITCH_CHARS[i % GLITCH_CHARS.length]}
              </motion.span>
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const AwakeningOverlay = memo(AwakeningOverlayBase);
