import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface CelestialPower {
  id: number;
  characterId: number;
  domainPair: string;
  viceScore: number;
  virtueScore: number;
  isAscended: boolean;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const DOMAIN_PAIRS = [
  {
    pair: "sloth_diligence",
    vice: "Sloth",
    virtue: "Diligence",
    sinColor: "#6b21a8",
    virtueColor: "#a16207",
    taunt: "Sloth grows heavy. Arise and practice Diligence before your momentum is crushed.",
    sage: "Diligence shines. The Archive recognizes your ceaseless motion.",
  },
  {
    pair: "gluttony_temperance",
    vice: "Gluttony",
    virtue: "Temperance",
    sinColor: "#7f1d1d",
    virtueColor: "#065f46",
    taunt: "Excess devours your growth. Temperance is the blade that cuts through desire.",
    sage: "Temperance guides your hand. Restraint is the armour of the strong.",
  },
  {
    pair: "greed_charity",
    vice: "Greed",
    virtue: "Charity",
    sinColor: "#78350f",
    virtueColor: "#1e3a5f",
    taunt: "Greed hollows the soul. Give freely before the Shadow claims your gold.",
    sage: "Charity flows through you. The cosmos rewards those who open their hands.",
  },
  {
    pair: "lust_chastity",
    vice: "Lust",
    virtue: "Chastity",
    sinColor: "#831843",
    virtueColor: "#4c1d95",
    taunt: "Desire clouds your sight. Chastity clears the fog — reclaim your focus.",
    sage: "Chastity fortifies. Your will is unshaken by the fires of temptation.",
  },
  {
    pair: "wrath_patience",
    vice: "Wrath",
    virtue: "Patience",
    sinColor: "#7f1d1d",
    virtueColor: "#14532d",
    taunt: "Wrath burns your bridges. Patience forges iron in silence — practice stillness.",
    sage: "Patience is your shield. You endure where others break.",
  },
  {
    pair: "envy_kindness",
    vice: "Envy",
    virtue: "Kindness",
    sinColor: "#1a2e05",
    virtueColor: "#0c4a6e",
    taunt: "Envy poisons the well. Offer Kindness and the Shadow weakens its grip.",
    sage: "Kindness radiates. You lift others and so the Archive lifts you.",
  },
  {
    pair: "pride_humility",
    vice: "Pride",
    virtue: "Humility",
    sinColor: "#3b0764",
    virtueColor: "#431407",
    taunt: "Pride blinds the climber. Humility is the lantern that reveals the true path.",
    sage: "Humility is strength. The wise kneel to rise higher than the arrogant.",
  },
] as const;

type PairKey = (typeof DOMAIN_PAIRS)[number]["pair"];

async function postQuickLog(type: "vice" | "virtue", pair: string) {
  const res = await fetch(`${BASE}/api/ascension/quick-log`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, pair }),
  });
  if (!res.ok) throw new Error("Quick-log failed");
  return res.json();
}

function TugBar({ viceScore, virtueScore }: { viceScore: number; virtueScore: number }) {
  const total = viceScore + virtueScore;
  const raw = total === 0 ? 50 : 50 + ((virtueScore - viceScore) / Math.max(total, 1)) * 50;
  const pct = Math.min(95, Math.max(5, raw));
  return (
    <div className="relative h-3 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: pct >= 50
            ? `linear-gradient(to right, #7f1d1d ${Math.max(0, 50 - pct)}%, #a16207)`
            : `linear-gradient(to right, #7f1d1d, #6b21a8)`,
        }}
      />
      <div
        className="absolute inset-y-0 w-1 -translate-x-1/2 bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.8)] transition-all duration-700"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

export default function CelestialDuel() {
  const queryClient = useQueryClient();
  const [logging, setLogging] = useState<string | null>(null);

  const { data: powers = [], isLoading } = useQuery<CelestialPower[]>({
    queryKey: ["ascension", "powers"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ascension/powers`);
      if (!res.ok) throw new Error("Failed to load powers");
      return res.json();
    },
    staleTime: 0,
  });

  const getPower = useCallback(
    (pair: string): CelestialPower => {
      return (
        powers.find((p) => p.domainPair === pair) ?? {
          id: 0,
          characterId: 0,
          domainPair: pair,
          viceScore: 0,
          virtueScore: 0,
          isAscended: false,
        }
      );
    },
    [powers]
  );

  const handleLog = useCallback(
    async (type: "vice" | "virtue", pair: string) => {
      const key = `${type}:${pair}`;
      if (logging === key) return;
      setLogging(key);
      try {
        const result = await postQuickLog(type, pair);
        queryClient.invalidateQueries({ queryKey: ["ascension", "powers"] });
        queryClient.invalidateQueries({ queryKey: ["getCharacter"] });

        if (result.overflowTriggered || result.momentumPenalty) {
          toast({
            title: "[SYSTEM] Momentum Crushed",
            description: "Vice overflowed. Gold halved. Streak reset. The Shadow claims its due.",
            duration: 6000,
          });
        } else if (result.ascensionTriggered) {
          toast({
            title: "[ASCENSION] Domain Transcended",
            description: `All stats +${result.ascensionBonus?.allStatsGain} permanently. You have risen beyond the mortal plane.`,
            duration: 8000,
          });
        } else if (type === "virtue") {
          toast({ title: "Virtue logged", description: "+10 XP granted.", duration: 2500 });
        } else {
          toast({ title: "Vice logged", description: "+2 Corruption. Hold the line.", duration: 2500 });
        }
      } catch {
        toast({ title: "Error", description: "Could not log. Check connection.", duration: 3000 });
      } finally {
        setLogging(null);
      }
    },
    [logging, queryClient]
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Split-screen banner */}
      <div className="relative flex h-48 md:h-64 overflow-hidden">
        <div
          className="flex-1 flex items-center justify-center"
          style={{
            backgroundImage: "url(/images/sins-bg.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
            background: "url(/images/sins-bg.jpg) center/cover fixed, linear-gradient(135deg,#3b0764 0%,#7f1d1d 100%)",
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 text-center">
            <p className="text-xs tracking-[0.5em] text-red-400 uppercase font-display mb-1">The Seven</p>
            <h2 className="font-display text-3xl md:text-4xl font-black tracking-widest text-red-300 drop-shadow-lg">
              SINS
            </h2>
          </div>
        </div>

        <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-white/20 z-20" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/80 shadow-[0_0_20px_rgba(255,255,255,0.15)]">
            <span className="text-white font-display font-black text-lg">⚖</span>
          </div>
        </div>

        <div
          className="flex-1 flex items-center justify-center"
          style={{
            backgroundImage: "url(/images/virtues-bg.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundAttachment: "fixed",
            background: "url(/images/virtues-bg.jpg) center/cover fixed, linear-gradient(135deg,#a16207 0%,#065f46 100%)",
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 text-center">
            <p className="text-xs tracking-[0.5em] text-amber-400 uppercase font-display mb-1">The Seven</p>
            <h2 className="font-display text-3xl md:text-4xl font-black tracking-widest text-amber-200 drop-shadow-lg">
              VIRTUES
            </h2>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 space-y-10">
        {/* Tug-of-War Bars */}
        <section>
          <h3 className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6 text-center">
            Scale of Souls — Domain Balance
          </h3>
          {isLoading ? (
            <div className="text-center text-muted-foreground text-sm py-8">Consulting the Archive...</div>
          ) : (
            <div className="space-y-6">
              {DOMAIN_PAIRS.map((dp) => {
                const power = getPower(dp.pair);
                const viceWins = power.viceScore > power.virtueScore;
                return (
                  <div key={dp.pair} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-red-400">{dp.vice}</span>
                        <span className="text-xs text-muted-foreground bg-white/5 rounded px-1.5 py-0.5">
                          {power.viceScore}
                        </span>
                      </div>
                      {power.isAscended && (
                        <span className="text-xs tracking-widest text-amber-400 font-display">✦ ASCENDED</span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground bg-white/5 rounded px-1.5 py-0.5">
                          {power.virtueScore}
                        </span>
                        <span className="text-sm font-semibold text-amber-300">{dp.virtue}</span>
                      </div>
                    </div>
                    <TugBar viceScore={power.viceScore} virtueScore={power.virtueScore} />
                    <p className="mt-3 text-xs leading-relaxed italic">
                      {viceWins ? (
                        <span className="text-red-400/80">
                          <span className="font-semibold text-red-400">Shadow's Taunt: </span>
                          {dp.taunt}
                        </span>
                      ) : (
                        <span className="text-amber-300/80">
                          <span className="font-semibold text-amber-300">Sage's Guidance: </span>
                          {dp.sage}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick-Log Panel */}
        <section>
          <h3 className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6 text-center">
            Quick-Log — Manifest Your Will
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {DOMAIN_PAIRS.map((dp) => {
              const power = getPower(dp.pair);
              const viceKey = `vice:${dp.pair}`;
              const virtueKey = `virtue:${dp.pair}`;
              return (
                <div
                  key={dp.pair}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3"
                >
                  <p className="text-xs tracking-widest text-muted-foreground uppercase font-display text-center">
                    {dp.vice} vs {dp.virtue}
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={logging === viceKey}
                      onClick={() => handleLog("vice", dp.pair)}
                      className="flex-1 rounded-lg border border-red-900/40 bg-red-950/30 py-2 text-xs font-semibold text-red-400 transition-all hover:bg-red-900/40 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {logging === viceKey ? "..." : `+${dp.vice}`}
                    </button>
                    <button
                      disabled={logging === virtueKey}
                      onClick={() => handleLog("virtue", dp.pair)}
                      className="flex-1 rounded-lg border border-amber-900/40 bg-amber-950/20 py-2 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-900/30 hover:text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {logging === virtueKey ? "..." : `+${dp.virtue}`}
                    </button>
                  </div>
                  {/* Transmute button — only when virtue score >= 100 and not yet ascended */}
                  {power.virtueScore >= 100 && !power.isAscended && (
                    <button
                      disabled={logging === virtueKey}
                      onClick={() => handleLog("virtue", dp.pair)}
                      className="w-full rounded-lg border border-amber-400/60 bg-gradient-to-r from-amber-900/40 to-yellow-900/30 py-2 text-xs font-black tracking-widest text-amber-300 uppercase transition-all hover:from-amber-800/50 hover:to-yellow-800/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] animate-pulse"
                    >
                      ✦ Transmute — Ascend Now
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Momentum Penalty Notice */}
        <section className="rounded-xl border border-red-900/30 bg-red-950/10 p-5">
          <h4 className="font-display text-xs tracking-[0.4em] uppercase text-red-400 mb-2">
            Momentum Penalty
          </h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When a Vice score overflows past <span className="text-red-400 font-semibold">100</span>,
            the Shadow strikes: Gold is halved, your streak resets to zero, your multiplier returns to 1.0,
            and Corruption rises by 20. Accumulate Virtue to counter the tide.
          </p>
        </section>
      </div>
    </div>
  );
}
