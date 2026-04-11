import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useVisualSettings } from "@/context/VisualSettingsContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { LucideScale, LucideAlertTriangle, LucideShieldCheck } from "lucide-react";
import sinsImg from "@assets/images/sins-bg.png";
import virtuesImg from "@assets/images/virtues-bg.png";

interface CelestialPower {
  id: number;
  characterId: number;
  domainPair: string;
  viceScore: number;
  virtueScore: number;
  isAscended: boolean;
}

interface BattlefieldProps {
  powers: CelestialPower[];
  glitching: boolean;
  shimmering: boolean;
  flaring: boolean;
  clashSide: "virtue" | "sin" | null;
}

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const DOMAIN_PAIRS = [
  { pair: "sloth_diligence",    vice: "Sloth",    virtue: "Diligence",
    taunt:   "Sloth grows heavy. Arise and practice Diligence before your momentum is crushed.",
    sage:    "Diligence shines. The Archive recognizes your ceaseless motion.",
    warning: "The fortress of Diligence is under siege. A Fall now would be catastrophic." },
  { pair: "gluttony_temperance", vice: "Gluttony", virtue: "Temperance",
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

// ── AmberParticle spawner ──────────────────────────────────────────────────────
function spawnAmberParticles(container: HTMLDivElement, density: number = 1.0, sizeScale: number = 1.0) {
  const count = Math.max(1, Math.round(7 * density));
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "amber-corruption-particle";
    const size = (4 + Math.random() * 6) * sizeScale;
    p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${10 + Math.random() * 80}%;
      bottom: ${10 + Math.random() * 40}%;
      animation-delay: ${Math.random() * 0.3}s;
    `;
    container.appendChild(p);
    setTimeout(() => p.remove(), 1600);
  }
}

// ── TugBar ─────────────────────────────────────────────────────────────────────
function TugBar({ viceScore, virtueScore }: { viceScore: number; virtueScore: number }) {
  const total = viceScore + virtueScore;
  const raw = total === 0 ? 50 : 50 + ((virtueScore - viceScore) / Math.max(total, 1)) * 50;
  const pct = Math.min(95, Math.max(5, raw));

  return (
    <div className="relative h-3 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full tug-bounce"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, var(--ct-sin-grad-start), var(--ct-sin-grad-end))`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-between px-2 text-[8px] font-black tracking-widest text-white/40 uppercase pointer-events-none">
        <span>SIN ←</span>
        <span>→ VIRTUE</span>
      </div>
      <div
        className="absolute inset-y-0 w-1 -translate-x-1/2 bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.8)] tug-bounce"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

// ── GlobalBattlefield ─────────────────────────────────────────────────────────
function GlobalBattlefield({ powers, glitching, shimmering, flaring, clashSide }: BattlefieldProps) {
  const totals = useMemo(() => powers.reduce((acc, p) => ({
    vice: acc.vice + p.viceScore,
    virtue: acc.virtue + p.virtueScore
  }), { vice: 0, virtue: 0 }), [powers]);

  const totalPoints = totals.vice + totals.virtue;
  const virtueGloballyWinning = totals.virtue > totals.vice;
  const tied = totals.virtue === totals.vice;

  const virtueWeight  = totalPoints === 0 ? 50 : (totals.virtue / totalPoints) * 100;
  const virtueW = Math.min(92, Math.max(8, virtueWeight));
  const viceW   = 100 - virtueW;

  const sinLosingT    = virtueGloballyWinning ? Math.max(0, (virtueWeight - 50) / 50) : 0;
  const virtueLosingT = (!virtueGloballyWinning && !tied) ? Math.max(0, ((100 - virtueWeight) - 50) / 50) : 0;

  const SIDE_TRANSITION = "width 1.5s cubic-bezier(0.4,0,0.2,1), filter 1.2s ease-out, transform 0.3s ease-out";

  const virtueFilter = tied
    ? "brightness(1)"
    : virtueGloballyWinning
      ? "brightness(1.3) contrast(1.2) drop-shadow(0 0 28px rgba(245,158,11,0.7))"
      : `grayscale(${virtueLosingT.toFixed(2)}) blur(${(virtueLosingT * 12).toFixed(1)}px) opacity(${Math.max(0.15, 1 - virtueLosingT * 0.85).toFixed(2)})`;

  const sinFilter = tied
    ? "brightness(1)"
    : !virtueGloballyWinning
      ? "brightness(1.3) contrast(1.2) drop-shadow(0 0 28px rgba(245,158,11,0.6))"
      : `grayscale(${sinLosingT.toFixed(2)}) blur(${(sinLosingT * 12).toFixed(1)}px) opacity(${Math.max(0.15, 1 - sinLosingT * 0.85).toFixed(2)})`;

  const virtueTransform = clashSide === "virtue" ? "scale(1.05)" : "scale(1)";
  const sinTransform    = clashSide === "sin"    ? "scale(1.05)" : "scale(1)";

  const [glitchKey, setGlitchKey] = useState(0);
  useEffect(() => {
    if (glitching) setGlitchKey(k => k + 1);
  }, [glitching]);

  if (totalPoints === 0) {
    return (
      <div className="relative flex h-56 md:h-72 overflow-hidden border-b border-white/10 bg-black">
        <div className="absolute inset-0 z-0 flex">
          <div className="flex-1" style={{ background: `url(${sinsImg}) center/cover, #2a0340` }} />
          <div className="flex-1" style={{ background: `url(${virtuesImg}) center/cover, #1d4e89` }} />
        </div>
        <div className="absolute inset-0 z-10 bg-black/60" />
        <div className="relative z-20 w-full flex flex-col items-center justify-center gap-2">
          <LucideScale className="h-8 w-8 text-white/40" />
          <h2 className="font-display text-2xl font-black tracking-widest text-muted-foreground uppercase">
            Tide is Still
          </h2>
          <p className="text-xs text-muted-foreground/60 tracking-widest">Log a vice or virtue to begin the clash</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-56 md:h-72 overflow-hidden border-b border-white/10 bg-black">

      {/* ── Virtue Side ── */}
      <div
        className={["absolute inset-y-0 right-0 z-10 flex items-center justify-center overflow-hidden", shimmering ? "shimmer-sweep" : ""].join(" ")}
        style={{
          width: `${virtueW}%`,
          background: `url(${virtuesImg}) center/cover, linear-gradient(135deg,#a16207 0%,#065f46 100%)`,
          filter: virtueFilter,
          transform: virtueTransform,
          transformOrigin: "right center",
          transition: SIDE_TRANSITION,
        }}
      >
        <div
          className="absolute inset-0 bg-black/30"
          style={{ animation: virtueGloballyWinning ? "virtueGlow 5s infinite" : "none" }}
        />
        {virtueGloballyWinning && <div className="absolute inset-0 z-10 arise-mana" />}
        <div className="relative z-20 text-center px-4">
          <p className="text-xs tracking-[0.5em] text-amber-400 uppercase font-display mb-1">The Seven</p>
          <h2 className="font-display text-3xl md:text-4xl font-black tracking-widest text-amber-200 drop-shadow-lg">
            VIRTUES
          </h2>
          {virtueGloballyWinning && (
            <span className="text-[10px] tracking-widest text-white/70 uppercase">→ DRIVING THE TIDE ←</span>
          )}
          <p className="text-xs text-amber-400/60 font-stat mt-1">{totals.virtue} pts</p>
        </div>
      </div>

      {/* ── Central Separator + Scale ── */}
      <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-white/20 z-20" />
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
        <div
          className={["flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/80 shadow-[0_0_20px_rgba(255,255,255,0.15)]", flaring ? "flare-burst" : ""].join(" ")}
        >
          <LucideScale className="h-6 w-6 text-white" />
        </div>
      </div>

      {/* ── Sin Side — Amber Corruption active ── */}
      <div
        className="absolute inset-y-0 left-0 z-10 flex items-center justify-center overflow-hidden"
        style={{
          width: `${viceW}%`,
          background: `url(${sinsImg}) center/cover, linear-gradient(135deg, hsl(35 80% 8%) 0%, hsl(25 70% 14%) 100%)`,
          filter: sinFilter,
          transform: sinTransform,
          transformOrigin: "left center",
          transition: SIDE_TRANSITION,
        }}
      >
        {/* Amber tinted overlay — replaces the old purple overlay */}
        <div
          className="absolute inset-0 bg-black/30"
          style={{ animation: !virtueGloballyWinning ? "sinGlow 5s infinite" : "none" }}
        />
        <div className="absolute inset-0 z-[1]" style={{ background: "hsl(35 80% 12% / 0.35)", mixBlendMode: "multiply" }} />
        {virtueGloballyWinning && (
          <div className="absolute inset-0 z-10 corruption-smoke" style={{ opacity: 0.4 }} />
        )}
        <div className="relative z-20 text-center px-4">
          <p className="text-xs tracking-[0.5em] text-amber-600/80 uppercase font-display mb-1">The Seven</p>
          <h2
            key={glitchKey}
            className={[
              "font-display text-3xl md:text-4xl font-black tracking-widest text-amber-700/90 drop-shadow-lg",
              glitching ? "animate-glitch-high" : "",
            ].join(" ")}
            data-text="SINS"
          >
            SINS
          </h2>
          {!virtueGloballyWinning && !tied && (
            <span className="text-[10px] tracking-widest text-white/70 uppercase">← DRIVING THE TIDE →</span>
          )}
          <p className="text-xs text-amber-600/60 font-stat mt-1">{totals.vice} pts</p>
        </div>
      </div>
    </div>
  );
}

// ── CelestialDuel Page ────────────────────────────────────────────────────────
export default function CelestialDuel() {
  const queryClient = useQueryClient();
  const { amberDensity, amberSize, corruptionTheme } = useVisualSettings();
  const [logging, setLogging]       = useState<string | null>(null);
  const [glitching, setGlitching]   = useState(false);
  const [shimmering, setShimmering] = useState(false);
  const [flaring, setFlaring]       = useState(false);
  const [clashSide, setClashSide]   = useState<"virtue" | "sin" | null>(null);

  const glitchTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shimmerTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flareTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clashTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevVirtueWinRef = useRef<boolean | null>(null);
  const particleContainerRef = useRef<HTMLDivElement | null>(null);

  const triggerGlitch = useCallback(() => {
    if (glitchTimer.current) clearTimeout(glitchTimer.current);
    setGlitching(true);
    glitchTimer.current = setTimeout(() => setGlitching(false), 600);
  }, []);

  const triggerShimmer = useCallback(() => {
    if (shimmerTimer.current) clearTimeout(shimmerTimer.current);
    setShimmering(false);
    requestAnimationFrame(() => {
      setShimmering(true);
      shimmerTimer.current = setTimeout(() => setShimmering(false), 2500);
    });
  }, []);

  const triggerFlare = useCallback(() => {
    if (flareTimer.current) clearTimeout(flareTimer.current);
    setFlaring(false);
    requestAnimationFrame(() => {
      setFlaring(true);
      flareTimer.current = setTimeout(() => setFlaring(false), 900);
    });
  }, []);

  useEffect(() => () => {
    if (glitchTimer.current) clearTimeout(glitchTimer.current);
    if (shimmerTimer.current) clearTimeout(shimmerTimer.current);
    if (flareTimer.current) clearTimeout(flareTimer.current);
    if (clashTimer.current) clearTimeout(clashTimer.current);
  }, []);

  const { data: powers = [], isLoading } = useQuery<CelestialPower[]>({
    queryKey: ["ascension", "powers"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/ascension/powers`);
      if (!res.ok) throw new Error("Failed to load powers");
      return res.json();
    },
    staleTime: 1000 * 30,
  });

  const totals = useMemo(() => powers.reduce((acc, p) => ({
    vice: acc.vice + p.viceScore,
    virtue: acc.virtue + p.virtueScore
  }), { vice: 0, virtue: 0 }), [powers]);

  useEffect(() => {
    const virtueWinning = totals.virtue > totals.vice;
    if (prevVirtueWinRef.current !== null && prevVirtueWinRef.current !== virtueWinning) {
      triggerFlare();
    }
    prevVirtueWinRef.current = virtueWinning;
  }, [totals, triggerFlare]);

  const getPower = useCallback((pair: string): CelestialPower =>
    powers.find(p => p.domainPair === pair) ?? {
      id: 0, characterId: 0, domainPair: pair,
      viceScore: 0, virtueScore: 0, isAscended: false
    }, [powers]);

  const handleLog = useCallback(async (type: "vice" | "virtue", pair: string) => {
    const key = `${type}:${pair}`;
    if (logging === key) return;
    setLogging(key);
    try {
      const res = await fetch(`${BASE}/api/ascension/quick-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, pair, points: 10 }),
      });
      if (!res.ok) throw new Error("Log failed");
      const result = await res.json();

      queryClient.invalidateQueries({ queryKey: ["ascension", "powers"] });
      queryClient.invalidateQueries({ queryKey: ["getCharacter"] });

      if (clashTimer.current) clearTimeout(clashTimer.current);
      setClashSide(type === "virtue" ? "virtue" : "sin");
      clashTimer.current = setTimeout(() => setClashSide(null), 300);

      // ── Spawn amber particles on vice log ──────────────────────────────────
      if (type === "vice" && particleContainerRef.current) {
        spawnAmberParticles(particleContainerRef.current, amberDensity, amberSize);
      }

      if (result.greatFall) {
        triggerGlitch();
        setTimeout(triggerGlitch, 300);
        toast({ title: "[THE GREAT FALL] Domain Corrupted", description: "Ascension lost. All stats −50. 75% of gold seized. The Shadow devours your legacy.", variant: "destructive", duration: 10000 });
      } else if (result.overflowTriggered) {
        triggerGlitch();
        toast({ title: "[SYSTEM] Momentum Halved", description: "Vice overflowed. Gold halved. Streak reset. The Shadow claims its due.", variant: "destructive", duration: 6000 });
      } else if (result.ascensionTriggered) {
        triggerFlare();
        triggerShimmer();
        toast({ title: "[ASCENSION] Domain Transcended", description: `You have reached the peak of ${pair}. All stats +50 permanently. Virtue Relic unlocked.`, duration: 8000 });
      } else if (type === "virtue") {
        triggerShimmer();
        toast({ title: "Virtue logged", description: "+10 XP granted.", duration: 2500 });
      } else {
        triggerGlitch();
        toast({ title: "Vice logged", description: "+2 Corruption added. Hold the line.", duration: 2500 });
      }
    } catch (error) {
      console.error("Error logging celestial power:", error);
      toast({ title: "Error", description: "Failed to record log. Please try again.", variant: "destructive" });
    } finally {
      setLogging(null);
    }
  }, [logging, queryClient, triggerGlitch, triggerShimmer, triggerFlare, amberDensity, amberSize]);

  const getDomainClass = useCallback((power: CelestialPower): string => {
    if (power.isAscended && power.viceScore > 50) return "runic-siege under-siege border-red-900/40 animate-siege-pulse";
    if (power.viceScore > power.virtueScore) return "corruption-smoke border-red-900/10";
    if (power.virtueScore > power.viceScore) return "arise-mana border-amber-900/10";
    return "border-white/5";
  }, []);

  // ── Render — wrapped in celestial-void-context for scoped CSS isolation ────
  return (
    <div className={`celestial-void-context theme-${corruptionTheme} min-h-screen bg-background text-foreground relative`}>

      {/* Domain Drift Background Layer — Amber-tinted void */}
      <div className="absolute inset-0 z-0 flex overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="flex-1 relative animate-domain-drift" style={{
          background: `url(${sinsImg}) center/cover fixed, hsl(35 80% 8%)`,
          transform: "scale(1.1)",
          filter: "blur(22px) saturate(0.3) brightness(0.2)",
        }}>
          <div className="absolute inset-0" style={{ background: "var(--ct-bg-overlay)" }} />
        </div>
        <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-32 bg-gradient-to-r from-black via-black to-black opacity-90 blur-xl" />
        <div className="flex-1 relative animate-domain-drift" style={{
          background: `url(${virtuesImg}) center/cover fixed, #a16207`,
          transform: "scale(1.1)",
          filter: "blur(22px) saturate(0.35) brightness(0.16) hue-rotate(200deg)",
        }}>
          <div className="absolute inset-0 bg-blue-950/20" />
        </div>
      </div>

      {/* Amber Particle Container — attached to viewport, not scrollable */}
      <div
        ref={particleContainerRef}
        className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
        aria-hidden="true"
      />

      {/* Main Content Layer */}
      <div className="relative z-10 flex flex-col">
        <GlobalBattlefield
          powers={powers}
          glitching={glitching}
          shimmering={shimmering}
          flaring={flaring}
          clashSide={clashSide}
        />

        <div className="mx-auto max-w-4xl px-4 py-8 md:py-12 space-y-12 corruption-smoke">

          {/* Domain Balance Section */}
          <section className="corruption-smoke">
            <h3 className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground mb-8 text-center">
              Scale of Souls — Domain Balance
            </h3>
            {isLoading ? (
              <div className="text-center text-muted-foreground text-sm py-12">Consulting the Archive...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {DOMAIN_PAIRS.map(dp => {
                  const power      = getPower(dp.pair);
                  const underSiege = power.isAscended && power.viceScore > 50;
                  const viceWins   = power.viceScore > power.virtueScore;
                  const atmosphereClass = getDomainClass(power);
                  const advice = underSiege
                    ? { label: "Void Warning",    text: dp.warning }
                    : viceWins
                    ? { label: "Shadow's Taunt",  text: dp.taunt }
                    : { label: "Sage's Guidance", text: dp.sage };

                  return (
                    <div key={dp.pair} className={`rounded-2xl border bg-white/[0.01] p-5 shadow-inner ${atmosphereClass}`}>
                      <div className="flex items-center justify-between mb-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`text-sm md:text-base font-bold tracking-tight ${viceWins ? "ct-text" : "text-muted-foreground"}`}>{dp.vice}</span>
                          <span className="text-xs font-stat text-muted-foreground bg-white/5 rounded px-2 py-0.5">{power.viceScore}</span>
                        </div>
                        {power.isAscended && (
                          <div className={`flex items-center gap-1.5 text-xs tracking-widest font-display ${underSiege ? "text-red-400" : "ct-text-muted"}`}>
                            {underSiege
                              ? <LucideAlertTriangle className="h-4 w-4 animate-pulse" />
                              : <LucideShieldCheck className="h-4 w-4" />}
                            <span className="uppercase">{underSiege ? "Siege" : "Ascended"}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs font-stat text-muted-foreground bg-white/5 rounded px-2 py-0.5">{power.virtueScore}</span>
                          <span className={`text-sm md:text-base font-bold tracking-tight ${!viceWins ? "ct-text" : "text-muted-foreground"}`}>{dp.virtue}</span>
                        </div>
                      </div>
                      <TugBar viceScore={power.viceScore} virtueScore={power.virtueScore} />
                      <p className={`mt-3.5 text-xs leading-relaxed italic ${underSiege ? "text-orange-400/90 font-semibold" : viceWins ? "ct-text-muted" : "ct-text"}`}>
                        <span className="font-semibold not-italic">{advice.label}: </span>
                        {advice.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Quick-Log Section */}
          <section className="corruption-smoke">
            <h3 className="font-display text-xs tracking-[0.4em] uppercase text-muted-foreground mb-8 text-center">
              Quick-Log — Manifest Your Will
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1 [&>*:last-child]:max-w-xs [&>*:last-child]:mx-auto">
              {DOMAIN_PAIRS.map(dp => {
                const power = getPower(dp.pair);
                const atmosphereClass = getDomainClass(power);
                const underSiege = power.isAscended && power.viceScore > 50;

                return (
                  <div
                    key={dp.pair}
                    className={`rounded-2xl border bg-white/[0.01] p-5 space-y-4 shadow-lg ${atmosphereClass}`}
                    style={underSiege ? { borderColor: "rgba(239,68,68,0.4)", background: "rgba(127,29,29,0.06)" } : {}}
                  >
                    <p className="text-xs tracking-widest text-muted-foreground uppercase font-display text-center truncate">
                      {dp.vice} <span className="text-white/20">vs</span> {dp.virtue}
                      {power.isAscended && <span className="ml-1.5 ct-text">✦</span>}
                    </p>
                    <div className="flex gap-2.5">
                      <button
                        disabled={logging === `vice:${dp.pair}`}
                        onClick={() => handleLog("vice", dp.pair)}
                        className="ct-btn-vice flex-1 min-h-[44px] rounded-xl border py-2.5 text-sm font-semibold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {logging === `vice:${dp.pair}` ? "..." : `+${dp.vice}`}
                      </button>
                      <button
                        disabled={logging === `virtue:${dp.pair}`}
                        onClick={() => handleLog("virtue", dp.pair)}
                        className="ct-btn-virtue flex-1 min-h-[44px] rounded-xl border py-2.5 text-sm font-semibold active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {logging === `virtue:${dp.pair}` ? "..." : `+${dp.virtue}`}
                      </button>
                    </div>
                    {power.virtueScore >= 100 && !power.isAscended && (
                      <button
                        disabled={logging === `virtue:${dp.pair}`}
                        onClick={() => handleLog("virtue", dp.pair)}
                        className="ct-ascend-btn w-full min-h-[44px] rounded-xl border py-2.5 text-sm font-black tracking-widest uppercase animate-pulse active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ✦ Transmute — Ascend Now
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Info Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 corruption-smoke">
            <section className="ct-panel rounded-2xl border p-6 shadow-inner corruption-smoke">
              <div className="relative z-10 flex items-start gap-4">
                <LucideAlertTriangle className="ct-text h-8 w-8 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="ct-text font-display text-sm tracking-widest uppercase">Momentum Overload</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vice overflow past <span className="ct-text font-bold font-stat">100</span>: Gold halved, streak &amp; multiplier reset to Day 1, +20 Corruption.
                  </p>
                </div>
              </div>
            </section>
            <section className="ct-panel rounded-2xl border p-6 shadow-inner corruption-smoke">
              <div className="relative z-10 flex items-start gap-4">
                <LucideAlertTriangle className="ct-text-muted h-8 w-8 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="ct-text-muted font-display text-sm tracking-widest uppercase">The Great Fall</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Vice overflow while <span className="ct-text font-bold">Ascended</span>: Ascension lost, all stats −50, 75% gold seized, +40 Corruption.
                  </p>
                </div>
              </div>
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}
