import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { ShadowIntel } from "@/components/ShadowIntel";
import { SYSTEM_INTEL } from "@/lib/systemLore";

interface AriseRitualProps {
  bossId: number;
  bossName: string;
  onClose: () => void;
  onSuccess: (shadowName: string) => void;
}

interface ExtractResult {
  success: boolean;
  roll: number;
  threshold: number;
  message: string;
  shadow?: {
    id: number;
    name: string;
    rank: string;
    specialAbility: string;
  };
}

type Phase = "idle" | "charging" | "success" | "failure";

export function AriseRitual({ bossId, bossName, onClose, onSuccess }: AriseRitualProps) {
  const [command, setCommand] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const extractMutation = useMutation<ExtractResult, Error, void>({
    mutationFn: async () => {
      const res = await fetch("/api/shadows/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bossId, command }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Extraction failed");
      return data as ExtractResult;
    },
    onMutate: () => {
      setPhase("charging");
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.success) {
        setPhase("success");
        if (data.shadow) {
          setTimeout(() => onSuccess(data.shadow!.name), 3500);
        }
      } else {
        setPhase("failure");
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPhase("idle");
          setCommand("");
        }, 1800);
      }
    },
    onError: (err) => {
      setResult({ success: false, roll: 0, threshold: 0, message: err.message });
      setPhase("failure");
      setShake(true);
      setTimeout(() => {
        setShake(false);
        setPhase("idle");
        setCommand("");
      }, 1800);
    },
  });

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && command.trim().length > 0 && phase === "idle") {
      extractMutation.mutate();
    }
    if (e.key === "Escape") onClose();
  }

  const isCharging = phase === "charging";
  const isSuccess  = phase === "success";
  const isFailure  = phase === "failure";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={[
          "relative w-full max-w-lg mx-4 flex flex-col items-center gap-6 px-8 py-10",
          "rounded-2xl border border-blue-900/60",
          "animate-domain-drift arise-mana",
          shake ? "arise-shake" : "",
          isSuccess ? "arise-success-glow" : "",
        ].filter(Boolean).join(" ")}
        style={{
          background: "linear-gradient(160deg, #050a1a 0%, #0a0f2a 60%, #0d0515 100%)",
          boxShadow: isSuccess
            ? "0 0 80px 20px rgba(96,165,250,0.45), 0 0 160px 40px rgba(99,102,241,0.25)"
            : "0 0 40px 8px rgba(30,58,138,0.4)",
        }}
      >
        {phase !== "success" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-600 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div className="flex flex-col items-center gap-2 text-center z-10">
          <span className="text-xs font-bold tracking-[0.3em] text-blue-400/70 uppercase">
            Extraction Ritual
          </span>
          <h2 className="text-2xl font-black tracking-wide text-white">
            {bossName}
          </h2>
          <p className="text-sm text-zinc-400">
            The defeated shadow lingers. Issue the Monarch's command to claim it.
          </p>
        </div>

        {!isSuccess && (
          <>
            <div className="w-full z-10">
              <div className="mb-3 flex justify-center">
                <ShadowIntel
                  title="Shadow Intel"
                  intel={SYSTEM_INTEL.EXTRACTION_AUTHORITY}
                  detail="Raise Intellect before attempting elite extractions to bend the success threshold in your favor."
                />
              </div>
              <input
                ref={inputRef}
                value={command}
                onChange={(e) => setCommand(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                disabled={isCharging || isFailure}
                placeholder="TYPE YOUR COMMAND..."
                className={[
                  "w-full bg-transparent text-center text-2xl font-black tracking-[0.25em]",
                  "border-b-2 border-blue-700/60 focus:border-blue-400",
                  "text-blue-100 placeholder-blue-900/60",
                  "outline-none transition-all duration-300 pb-2",
                  "focus:shadow-[0_4px_20px_rgba(96,165,250,0.3)]",
                  isCharging ? "opacity-50 cursor-not-allowed" : "",
                  isFailure  ? "border-red-800/80 text-red-400" : "",
                ].filter(Boolean).join(" ")}
                maxLength={10}
                spellCheck={false}
                autoComplete="off"
              />
            </div>

            {isFailure && result && (
              <div className="text-center z-10 animate-pulse">
                <p className="text-red-400 font-bold text-base tracking-wide">
                  {result.message}
                </p>
                <p className="text-xs text-zinc-600 mt-1">
                  Roll: {result.roll} / Threshold: {result.threshold}
                </p>
              </div>
            )}

            {isCharging && (
              <div className="text-center z-10">
                <p className="text-blue-400 font-bold tracking-widest animate-pulse text-sm uppercase">
                  Channeling...
                </p>
              </div>
            )}

            {phase === "idle" && (
              <button
                onClick={() => extractMutation.mutate()}
                disabled={command.trim().length === 0}
                className={[
                  "z-10 px-8 py-3 rounded-lg font-black tracking-[0.2em] text-sm uppercase",
                  "border border-blue-700/60 transition-all duration-300",
                  "disabled:opacity-30 disabled:cursor-not-allowed",
                  command.trim().length > 0
                    ? "bg-blue-900/50 text-blue-200 hover:bg-blue-800/70 hover:border-blue-400 hover:shadow-[0_0_20px_rgba(96,165,250,0.4)]"
                    : "bg-zinc-900/30 text-zinc-600 border-zinc-800/30",
                ].join(" ")}
              >
                Issue Command
              </button>
            )}
          </>
        )}

        {isSuccess && result?.shadow && (
          <div className="flex flex-col items-center gap-5 z-10 text-center">
            <div className="arise-burst" aria-hidden="true" />

            <div className="flex flex-col items-center gap-1">
              <span className="text-xs tracking-[0.3em] text-blue-400/70 uppercase font-bold">
                Shadow Extracted
              </span>
              <h3 className="text-3xl font-black text-white tracking-wide drop-shadow-[0_0_12px_rgba(96,165,250,0.8)]">
                {result.shadow.name}
              </h3>
              <span className={[
                "text-xs font-bold tracking-widest px-3 py-0.5 rounded-full border mt-1",
                result.shadow.rank === "S"
                  ? "border-yellow-500/60 text-yellow-300 bg-yellow-900/20"
                  : "border-blue-700/60 text-blue-300 bg-blue-900/20",
              ].join(" ")}>
                RANK {result.shadow.rank}
              </span>
            </div>

            <div className="border border-blue-900/40 rounded-lg px-5 py-3 bg-blue-950/30 w-full">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Special Ability</p>
              <p className="text-blue-200 font-semibold">{result.shadow.specialAbility}</p>
            </div>

            <p className="text-green-400/80 text-sm font-bold tracking-wide">
              ✦ {result.shadow.name} has joined the Army.
            </p>
          </div>
        )}

        <div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
        </div>
      </div>
    </div>
  );
}
