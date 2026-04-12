import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckSquare, Square, ShieldOff, Skull } from "lucide-react";
import { usePenalty } from "@/context/PenaltyContext";

interface PenaltyGoal {
  id: string;
  label: string;
  target: number;
  current: number;
}

const INITIAL_GOALS: PenaltyGoal[] = [
  { id: "backlog",  label: "Clear quest backlog",          target: 5, current: 0 },
  { id: "journal",  label: "Write spirit journal entry",   target: 1, current: 0 },
  { id: "checkin",  label: "Complete daily check-in",      target: 1, current: 0 },
  { id: "order",    label: "Complete a daily order",       target: 1, current: 0 },
];

function CrimsonScanlines() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(180,0,0,0.03) 2px, rgba(180,0,0,0.03) 4px)",
      }}
    />
  );
}

function CorruptionNoise() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundSize: "180px 180px",
      }}
    />
  );
}

function GlitchText({ text }: { text: string }) {
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 120);
    }, 3500 + Math.random() * 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="relative inline-block"
      style={
        glitch
          ? {
              textShadow: "2px 0 #ff0000, -2px 0 #990000",
              transform: "skewX(-2deg) translateX(1px)",
              transition: "none",
            }
          : { transition: "all 0.05s" }
      }
    >
      {text}
    </span>
  );
}

export default function PenaltyZone() {
  const [, navigate] = useLocation();
  const { clearPenalty, activatePenalty } = usePenalty();
  const [goals, setGoals] = useState<PenaltyGoal[]>(INITIAL_GOALS);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pulseRing, setPulseRing] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    activatePenalty();
  }, [activatePenalty]);

  useEffect(() => {
    const id = setInterval(() => {
      setPulseRing((v) => !v);
    }, 800);
    return () => clearInterval(id);
  }, []);

  function toggleGoal(goalId: string) {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? { ...g, current: g.current >= g.target ? 0 : g.current + 1 }
          : g
      )
    );
  }

  const allGoalsMet = goals.every((g) => g.current >= g.target);

  function handleAcknowledge() {
    if (!allGoalsMet) return;
    setAcknowledged(true);
    setCountdown(5);
    intervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(intervalRef.current!);
          clearPenalty();
          navigate("/");
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "#050005" }}>
      <CrimsonScanlines />
      <CorruptionNoise />

      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(160,0,0,0.18) 0%, rgba(80,0,0,0.08) 50%, transparent 100%)",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-start px-4 py-12">

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 flex flex-col items-center gap-3 text-center"
        >
          <motion.div
            animate={{ scale: pulseRing ? 1.12 : 1, opacity: pulseRing ? 1 : 0.7 }}
            transition={{ duration: 0.4 }}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2"
            style={{
              borderColor: "rgba(200,0,0,0.8)",
              boxShadow: "0 0 30px rgba(200,0,0,0.6), inset 0 0 20px rgba(200,0,0,0.15)",
              background: "rgba(80,0,0,0.4)",
            }}
          >
            <Skull className="h-8 w-8" style={{ color: "#cc0000" }} />
          </motion.div>

          <div className="font-mono text-xs tracking-[0.4em]" style={{ color: "rgba(200,0,0,0.6)" }}>
            ── SYSTEM OVERRIDE ──
          </div>

          <h1
            className="font-display text-2xl font-bold tracking-widest sm:text-3xl"
            style={{
              color: "#cc0000",
              textShadow: "0 0 20px rgba(200,0,0,0.8), 0 0 40px rgba(200,0,0,0.4)",
            }}
          >
            <GlitchText text="[ PENALTY QUEST ACTIVE ]" />
          </h1>
          <h2
            className="font-display text-sm font-semibold tracking-[0.3em]"
            style={{ color: "rgba(200,0,0,0.7)" }}
          >
            — TRIAL OF THE UNWORTHY —
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="w-full max-w-xl rounded-lg border p-6 mb-6"
          style={{
            borderColor: "rgba(180,0,0,0.4)",
            background: "rgba(20,0,0,0.7)",
            boxShadow: "0 0 40px rgba(160,0,0,0.2), inset 0 0 30px rgba(100,0,0,0.08)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#cc0000" }} />
            <p className="font-mono text-sm leading-relaxed" style={{ color: "rgba(220,160,160,0.9)" }}>
              Failure to complete the daily quest will result in an appropriate{" "}
              <span className="font-bold" style={{ color: "#cc0000", textShadow: "0 0 8px rgba(200,0,0,0.8)" }}>
                penalty
              </span>
              . The System does not forgive the idle. Extraction is in progress.
            </p>
          </div>

          <div
            className="rounded border px-3 py-2 font-mono text-xs"
            style={{
              borderColor: "rgba(180,0,0,0.25)",
              background: "rgba(60,0,0,0.3)",
              color: "rgba(200,0,0,0.7)",
            }}
          >
            STATUS: <span style={{ color: "#cc0000" }}>PENALTY ZONE ACTIVE</span>
            &nbsp;|&nbsp;SEVERITY: <span style={{ color: "#cc0000" }}>CRITICAL</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="w-full max-w-xl rounded-lg border p-6 mb-6"
          style={{
            borderColor: "rgba(180,0,0,0.35)",
            background: "rgba(15,0,0,0.75)",
            boxShadow: "inset 0 0 20px rgba(100,0,0,0.1)",
          }}
        >
          <div
            className="mb-4 flex items-center gap-2 font-mono text-xs tracking-widest"
            style={{ color: "rgba(200,0,0,0.6)" }}
          >
            <ShieldOff className="h-3.5 w-3.5" />
            CURSED GOAL MANIFEST — CLEAR TO PROCEED
          </div>

          <div className="space-y-3">
            {goals.map((goal, i) => {
              const done = goal.current >= goal.target;
              return (
                <motion.button
                  key={goal.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.08 }}
                  onClick={() => toggleGoal(goal.id)}
                  className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-left transition-all duration-200"
                  style={{
                    background: done ? "rgba(120,0,0,0.25)" : "rgba(40,0,0,0.3)",
                    border: `1px solid ${done ? "rgba(180,0,0,0.5)" : "rgba(120,0,0,0.25)"}`,
                    boxShadow: done ? "0 0 12px rgba(160,0,0,0.2)" : "none",
                  }}
                >
                  <AnimatePresence mode="wait">
                    {done ? (
                      <motion.div
                        key="checked"
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                      >
                        <CheckSquare className="h-4 w-4" style={{ color: "#cc0000" }} />
                      </motion.div>
                    ) : (
                      <motion.div key="unchecked" initial={{ scale: 1 }} animate={{ scale: 1 }}>
                        <Square className="h-4 w-4" style={{ color: "rgba(150,0,0,0.6)" }} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="flex-1 min-w-0">
                    <span
                      className="font-mono text-sm"
                      style={{
                        color: done ? "rgba(220,150,150,0.9)" : "rgba(180,100,100,0.8)",
                        textDecoration: done ? "line-through" : "none",
                      }}
                    >
                      {goal.label}
                    </span>
                  </div>
                  <span
                    className="font-mono text-xs shrink-0"
                    style={{ color: done ? "#cc0000" : "rgba(150,0,0,0.6)" }}
                  >
                    [{goal.current}/{goal.target}]
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="w-full max-w-xl"
        >
          {!acknowledged ? (
            <motion.button
              onClick={handleAcknowledge}
              disabled={!allGoalsMet}
              whileHover={allGoalsMet ? { scale: 1.02 } : {}}
              whileTap={allGoalsMet ? { scale: 0.98 } : {}}
              className="relative w-full overflow-hidden rounded-lg border px-6 py-4 font-mono text-sm font-bold tracking-widest transition-all duration-300"
              style={
                allGoalsMet
                  ? {
                      borderColor: "rgba(200,0,0,0.8)",
                      background: "rgba(120,0,0,0.3)",
                      color: "#cc0000",
                      boxShadow: "0 0 20px rgba(180,0,0,0.4), inset 0 0 20px rgba(100,0,0,0.15)",
                      cursor: "pointer",
                    }
                  : {
                      borderColor: "rgba(100,0,0,0.3)",
                      background: "rgba(20,0,0,0.3)",
                      color: "rgba(120,0,0,0.5)",
                      cursor: "not-allowed",
                    }
              }
            >
              {allGoalsMet ? (
                <>
                  <motion.div
                    className="absolute inset-0"
                    animate={{ opacity: [0, 0.15, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    style={{ background: "rgba(200,0,0,0.3)" }}
                  />
                  <span className="relative">[ ACKNOWLEDGE TRIAL — RELEASE PENALTY ]</span>
                </>
              ) : (
                "[ COMPLETE ALL GOALS TO ACKNOWLEDGE ]"
              )}
            </motion.button>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border px-6 py-4 text-center font-mono text-sm"
              style={{
                borderColor: "rgba(200,0,0,0.5)",
                background: "rgba(60,0,0,0.3)",
                color: "rgba(220,160,160,0.9)",
              }}
            >
              <div style={{ color: "#cc0000" }} className="text-base font-bold mb-1">
                [ TRIAL COMPLETED ]
              </div>
              Returning to System in {countdown}s…
            </motion.div>
          )}

          {!allGoalsMet && (
            <p
              className="mt-3 text-center font-mono text-xs"
              style={{ color: "rgba(150,0,0,0.7)" }}
            >
              Complete all goals above to unlock acknowledgement.
            </p>
          )}
        </motion.div>

      </div>
    </div>
  );
}
