import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const ANIM_STYLES = `
@keyframes sinGlow {
  0%,100% { box-shadow: inset 0 0 60px rgba(127,29,29,0.35); }
  50%      { box-shadow: inset 0 0 110px rgba(127,29,29,0.65); }
}
@keyframes virtueGlow {
  0%,100% { box-shadow: inset 0 0 60px rgba(161,98,7,0.35); }
  50%      { box-shadow: inset 0 0 110px rgba(245,158,11,0.55); }
}
@keyframes bgDrift {
  0%,100% { background-position: center 50%; }
  50%      { background-position: center 46%; }
}
@keyframes siegePulse {
  0%,100% { box-shadow:0 0 0 0 rgba(239,68,68,0); border-color:rgba(239,68,68,0.3); }
  50%     { box-shadow:0 0 18px 4px rgba(239,68,68,0.25); border-color:rgba(239,68,68,0.75); }
}
@keyframes fallFlash {
  0%   { background:rgba(239,68,68,0.18); }
  100% { background:transparent; }
}
`;

interface CelestialPower {
  id: number; characterId: number; domainPair: string;
  viceScore: number; virtueScore: number; isAscended: boolean;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const DOMAIN_PAIRS = [
  { pair: "sloth_diligence",    vice: "Sloth",    virtue: "Diligence",
    taunt:   "Sloth grows heavy. Arise and practice Diligence before your momentum is crushed.",
    sage:    "Diligence shines. The Archive recognizes your ceaseless motion.",
    warning: "The fortress of Diligence is under siege. A Fall now would be catastrophic." },
  { pair: "gluttony_temperance",vice: "Gluttony", virtue: "Temperance",
    taunt:   "Excess devours your growth. Temperance is the blade that cuts through desire.",
    sage:    "Temperance guides your hand. Restraint is the armour of the strong.",
    warning: "Temperance teeters on the edge. Do not let Gluttony shatter what you built." },
  { pair: "greed_charity",      vice: "Greed",    virtue: "Charity",
    taunt:   "Greed hollows the soul. Give freely before the Shadow claims your gold.",
    sage:    "Charity flows through you. The cosmos rewards those who open their hands.",
    warning: "Charity's light flickers. One more failure and your gold will be ash." },
  { pair: "lust_chastity",      vice: "Lust",     virtue: "Chastity",
    taunt:   "Desire clouds your sight. Chastity clears the fog — reclaim your focus.",
    sage:    "Chastity fortifies. Your will is unshaken by the fires of temptation.",
    warning: "The sanctum of Chastity is crumbling. Resist now or the Fall destroys all." },
  { pair: "wrath_patience",     vice: "Wrath",    virtue: "Patience",
    taunt:   "Wrath burns your bridges. Patience forges iron in silence — practice stillness.",
    sage:    "Patience is your shield. You endure where others break.",
    warning: "Wrath hammers at your Patience. The Fall would strip your strength to bone." },
  { pair: "envy_kindness",      vice: "Envy",     virtue: "Kindness",
    taunt:   "Envy poisons the well. Offer Kindness and the Shadow weakens its grip.",
    sage:    "Kindness radiates. You lift others and so the Archive lifts you.",
    warning: "Kindness is besieged by Envy. One Fall here costs you everything gained." },
  { pair: "pride_humility",     vice: "Pride",    virtue: "Humility",
    taunt:   "Pride blinds the climber. Humility is the lantern that reveals the true path.",
    sage:    "Humility is strength. The wise kneel to rise higher than the arrogant.",
    warning: "Pride storms the gates of Humility. A Fall now would be your ruin complete." },
] as const;

function TugBar({ viceScore, virtueScore }: { viceScore: number; virtueScore: number }) {
  const total = viceScore + virtueScore;
  const raw   = total === 0 ? 50 : 50 + ((virtueScore - viceScore) / Math.max(total, 1)) * 50;
  const pct   = Math.min(95, Math.max(5, raw));
  return (
    <div className="relative h-3 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{
          width: `${pct}%`,
          transition: "width 800ms cubic-bezier(0.34,1.56,0.64,1)",
          background: pct >= 50
            ? "linear-gradient(to right,#7f1d1d,#a16207)"
            : "linear-gradient(to right,#7f1d1d,#6b21a8)",
        }}
      />
      <div
        className="absolute inset-y-0 w-1 -translate-x-1/2 bg-white rounded-full"
        style={{
          left: `${pct}%`,
          transition: "left 800ms cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: "0 0 6px rgba(255,255,255,0.8)",
        }}
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
    (pair: string): CelestialPower =>
      powers.find((p) => p.domainPair === pair) ??
      { id: 0, characterId: 0, domainPair: pair, viceScore: 0, virtueScore: 0, isAscended: false },
    [powers]
  );

  const handleLog = useCallback(async (type: "vice" | "virtue", pair: string) => {
    const key = `${type}:${pair}`;
    if (logging === key) return;
    setLogging(key);
    try {
      const res = await fetch(`${BASE}/api/ascension/quick-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, pair }),
      });
      if (!res.ok) throw new Error();
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["ascension", "powers"] });
      queryClient.invalidateQueries({ queryKey: ["getCharacter"] });

      if (result.greatFall) {
        toast({
          title: "[THE GREAT FALL] Domain Corrupted",
          description: "Ascension lost. All stats decayed by 50. 75% of your gold seized. The Shadow devours your legacy.",
          duration: 10000,
        });
      } else if (result.overflowTriggered) {
        toast({
          title: "[SYSTEM] Momentum Crushed",
          description: "Vice overflowed. Gold halved. Streak reset. The Shadow claims its due.",
          duration: 6000,
        });
      } else if (result.ascensionTriggered) {
        toast({
          title: "[ASCENSION] Domain Transcended",
          description: `All stats +${result.ascensionBonus?.allStatsGain} permanently. You rise beyond the mortal plane.`,
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
  }, [logging, queryClient]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{ANIM_STYLES}</style>

      {/* ── Split-Screen Animated Banner ───────────────────────────── */}
      <div className="relative flex h-72 md:h-96 overflow-hidden">
        {/* SINS half */}
        <div className="flex-1 relative overflow-hidden" style={{ animation: "sinGlow 4s ease-in-out infinite" }}>
          <img
            src="/images/sins-bg.png"
            alt="Seven Deadly Sins"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ animation: "bgDrift 12s ease-in-out infinite", objectPosition: "center" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/20 to-black/60" />
          <div className="absolute inset-0 flex items-end pb-6 justify-center z-10">
            <div className="text-center select-none drop-shadow-lg">
              <p className="text-xs tracking-[0.5em] text-red-400 uppercase font-display mb-1">The Seven</p>
              <h2 className="font-display text-4xl md:text-5xl font-black tracking-widest text-red-300"
                style={{ textShadow: "0 0 30px rgba(239,68,68,0.6), 0 2px 8px rgba(0,0,0,0.8)" }}>
                SINS
              </h2>
            </div>
          </div>
        </div>

        {/* Center divider + scale */}
        <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-white/25 z-20" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/40 bg-black/90"
            style={{ boxShadow: "0 0 24px rgba(255,255,255,0.2), 0 0 48px rgba(255,255,255,0.05)" }}>
            <span className="text-white text-2xl">⚖</span>
          </div>
        </div>

        {/* VIRTUES half */}
        <div className="flex-1 relative overflow-hidden" style={{ animation: "virtueGlow 5s ease-in-out infinite" }}>
          <img
            src="/images/virtues-bg.png"
            alt="Seven Heavenly Virtues"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ animation: "bgDrift 14s ease-in-out infinite reverse", objectPosition: "center" }}
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/40 via-black/20 to-black/60" />
          <div className="absolute inset-0 flex items-end pb-6 justify-center z-10">
            <div className="text-center select-none drop-shadow-lg">
              <p className="text-xs tracking-[0.5em] text-amber-400 uppercase font-display mb-1">The Seven</p>
              <h2 className="font-display text-4xl md:text-5xl font-black tracking-widest text-amber-200"
                style={{ textShadow: "0 0 30px rgba(245,158,11,0.6), 0 2px 8px rgba(0,0,0,0.8)" }}>
                VIRTUES
              </h2>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8 space-y-10">
        {/* ── Domain Balance Bars ────────────────────────────────────── */}
        <section>
          <h3 className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6 text-center">
            Scale of Souls — Domain Balance
          </h3>

          {isLoading
            ? <div className="text-center text-muted-foreground text-sm py-8">Consulting the Archive...</div>
            : <div className="space-y-5">
                {DOMAIN_PAIRS.map((dp) => {
                  const power     = getPower(dp.pair);
                  const underSiege = power.isAscended && power.viceScore > 50;
                  const viceWins   = power.viceScore > power.virtueScore;

                  let advice: { label: string; text: string; color: string };
                  if (power.isAscended && viceWins) {
                    advice = { label: "Void Warning", text: dp.warning, color: "text-orange-400" };
                  } else if (viceWins) {
                    advice = { label: "Shadow's Taunt", text: dp.taunt, color: "text-red-400" };
                  } else {
                    advice = { label: "Sage's Guidance", text: dp.sage, color: "text-amber-300" };
                  }

                  return (
                    <div
                      key={dp.pair}
                      className="rounded-xl border bg-white/[0.02] p-4 transition-all duration-500"
                      style={
                        underSiege
                          ? { animation: "siegePulse 2s ease-in-out infinite" }
                          : { borderColor: "rgba(255,255,255,0.05)" }
                      }
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-red-400">{dp.vice}</span>
                          <span className="text-xs text-muted-foreground bg-white/5 rounded px-1.5 py-0.5">
                            {power.viceScore}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {power.isAscended && (
                            <span className="text-xs tracking-widest font-display"
                              style={{ color: underSiege ? "#f97316" : "#fbbf24",
                                textShadow: underSiege ? "0 0 8px rgba(249,115,22,0.6)" : "0 0 8px rgba(251,191,36,0.4)" }}>
                              {underSiege ? "⚠ UNDER SIEGE" : "✦ ASCENDED"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground bg-white/5 rounded px-1.5 py-0.5">
                            {power.virtueScore}
                          </span>
                          <span className="text-sm font-semibold text-amber-300">{dp.virtue}</span>
                        </div>
                      </div>

                      <TugBar viceScore={power.viceScore} virtueScore={power.virtueScore} />

                      <p className="mt-3 text-xs leading-relaxed italic">
                        <span className={`font-semibold ${advice.color}`}>{advice.label}: </span>
                        <span className={`${advice.color}/80`}>{advice.text}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
          }
        </section>

        {/* ── Quick-Log Panel ────────────────────────────────────────── */}
        <section>
          <h3 className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground mb-6 text-center">
            Quick-Log — Manifest Your Will
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {DOMAIN_PAIRS.map((dp) => {
              const power      = getPower(dp.pair);
              const viceKey    = `vice:${dp.pair}`;
              const virtueKey  = `virtue:${dp.pair}`;
              const showTransmute = power.virtueScore >= 100 && !power.isAscended;
              const underSiege = power.isAscended && power.viceScore > 50;

              return (
                <div key={dp.pair}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3 transition-all duration-300"
                  style={underSiege ? { borderColor: "rgba(239,68,68,0.4)", background: "rgba(127,29,29,0.06)" } : {}}>
                  <p className="text-xs tracking-widest text-muted-foreground uppercase font-display text-center">
                    {dp.vice} <span className="text-white/20">vs</span> {dp.virtue}
                    {power.isAscended && <span className="ml-2 text-amber-500">✦</span>}
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={logging === viceKey}
                      onClick={() => handleLog("vice", dp.pair)}
                      className="flex-1 rounded-lg border border-red-900/40 bg-red-950/30 py-2 text-xs font-semibold text-red-400 transition-all hover:bg-red-900/40 hover:text-red-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                      {logging === viceKey ? "..." : `+${dp.vice}`}
                    </button>
                    <button
                      disabled={logging === virtueKey}
                      onClick={() => handleLog("virtue", dp.pair)}
                      className="flex-1 rounded-lg border border-amber-900/40 bg-amber-950/20 py-2 text-xs font-semibold text-amber-400 transition-all hover:bg-amber-900/30 hover:text-amber-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                      {logging === virtueKey ? "..." : `+${dp.virtue}`}
                    </button>
                  </div>
                  {showTransmute && (
                    <button
                      disabled={logging === virtueKey}
                      onClick={() => handleLog("virtue", dp.pair)}
                      className="w-full rounded-lg border py-2 text-xs font-black tracking-widest uppercase transition-all active:scale-95 disabled:opacity-50 animate-pulse"
                      style={{
                        borderColor: "rgba(245,158,11,0.6)",
                        background: "linear-gradient(to right,rgba(120,53,15,0.4),rgba(113,63,18,0.3))",
                        color: "#fcd34d",
                        boxShadow: "0 0 14px rgba(245,158,11,0.2)",
                      }}>
                      ✦ Transmute — Ascend Now
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Lore Panels ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-xl border border-red-900/30 bg-red-950/10 p-5">
            <h4 className="font-display text-xs tracking-[0.4em] uppercase text-red-400 mb-2">Momentum Penalty</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Vice overflow past <span className="text-red-400 font-semibold">100</span>: Gold halved, streak reset,
              multiplier returned to 1.0, +20 Corruption.
            </p>
          </section>
          <section className="rounded-xl border border-orange-900/30 bg-orange-950/10 p-5">
            <h4 className="font-display text-xs tracking-[0.4em] uppercase text-orange-400 mb-2">The Great Fall</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If Vice overflows while a domain is <span className="text-amber-400 font-semibold">Ascended</span>:
              Ascension lost, all stats −50, 75% of gold seized, +40 Corruption, streak reset.
              Ascended domains resist with <span className="text-amber-400 font-semibold">+5 vice/failure</span> instead of +10.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
