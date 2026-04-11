import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Settings, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { useVisualSettings, type CorruptionTheme } from "@/context/VisualSettingsContext";

const THEMES: { id: CorruptionTheme; label: string; color: string; ring: string }[] = [
  { id: "amber", label: "Amber",  color: "hsl(45 100% 60%)",  ring: "ring-amber-400" },
  { id: "blood", label: "Blood",  color: "hsl(0 85% 55%)",    ring: "ring-red-600" },
  { id: "toxic", label: "Toxic",  color: "hsl(110 80% 45%)",  ring: "ring-green-500" },
  { id: "void",  label: "Void",   color: "hsl(270 70% 60%)",  ring: "ring-purple-500" },
];

function ParticlePreview({
  amberGlow,
  amberDensity,
  amberFlicker,
  amberSize,
  amberOpacity,
  corruptionTheme,
}: {
  amberGlow: number;
  amberDensity: number;
  amberFlicker: number;
  amberSize: number;
  amberOpacity: number;
  corruptionTheme: CorruptionTheme;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const spawnBurst = () => {
      const count = Math.max(1, Math.round(3 * amberDensity));
      for (let i = 0; i < count; i++) {
        const p = document.createElement("div");
        p.className = "amber-corruption-particle";
        const base = (3 + Math.random() * 5) * amberSize;
        p.style.cssText = `
          width: ${base}px;
          height: ${base}px;
          left: ${8 + Math.random() * 84}%;
          bottom: ${4 + Math.random() * 35}%;
          animation-delay: ${(Math.random() * 0.4).toFixed(2)}s;
        `;
        container.appendChild(p);
        setTimeout(() => p.remove(), 1600);
      }
    };

    spawnBurst();
    const id = setInterval(spawnBurst, 700);
    return () => clearInterval(id);
  }, [amberDensity, amberSize]);

  return (
    <div
      ref={containerRef}
      className={`celestial-void-context theme-${corruptionTheme} ct-border relative overflow-hidden rounded-lg border bg-black/70`}
      style={{
        height: "88px",
        "--amber-glow-size": `${amberGlow}px`,
        "--amber-flicker-duration": `${amberFlicker}s`,
        "--amber-opacity-max": `${amberOpacity}`,
      } as CSSProperties}
    >
      <div className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none">
        <span className="text-[9px] tracking-[0.4em] text-amber-900/40 uppercase font-display">
          Live Preview
        </span>
      </div>
    </div>
  );
}

export function SettingsDrawer() {
  const {
    amberGlow,
    amberDensity,
    amberFlicker,
    amberSize,
    amberOpacity,
    corruptionTheme,
    isSettingsOpen,
    setAmberGlow,
    setAmberDensity,
    setAmberFlicker,
    setAmberSize,
    setAmberOpacity,
    setCorruptionTheme,
    setIsSettingsOpen,
  } = useVisualSettings();

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".celestial-void-context");
    elements.forEach((el) => {
      el.style.setProperty("--amber-glow-size", `${amberGlow}px`);
      el.style.setProperty("--amber-flicker-duration", `${amberFlicker}s`);
      el.style.setProperty("--amber-opacity-max", `${amberOpacity}`);
    });
  }, [amberGlow, amberFlicker, amberOpacity]);

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(".celestial-void-context");
    elements.forEach((el) => {
      THEMES.forEach(({ id }) => el.classList.remove(`theme-${id}`));
      el.classList.add(`theme-${corruptionTheme}`);
    });
  }, [corruptionTheme]);

  return (
    <Sheet open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
      <SheetContent
        side="right"
        className="w-80 border-l border-amber-900/40 bg-black/95 backdrop-blur-xl p-0 flex flex-col"
      >
        <SheetHeader className="px-6 py-5 border-b border-amber-900/30">
          <SheetTitle className="font-display tracking-[0.3em] text-amber-400 uppercase flex items-center gap-2 text-base">
            <Settings className="w-4 h-4" />
            Command Center
          </SheetTitle>
          <p className="text-[10px] tracking-[0.4em] text-amber-600/60 uppercase mt-0.5 font-display">
            Scale of Souls — Corruption Controls
          </p>
        </SheetHeader>

        <div className="flex-1 px-6 py-6 space-y-8 overflow-y-auto">
          <ParticlePreview
            amberGlow={amberGlow}
            amberDensity={amberDensity}
            amberFlicker={amberFlicker}
            amberSize={amberSize}
            amberOpacity={amberOpacity}
            corruptionTheme={corruptionTheme}
          />

          <div className="space-y-3">
            <label className="font-display text-xs tracking-[0.35em] uppercase text-amber-300 block">
              Corruption Theme
            </label>
            <div className="grid grid-cols-4 gap-2">
              {THEMES.map(({ id, label, color, ring }) => (
                <button
                  key={id}
                  onClick={() => setCorruptionTheme(id)}
                  title={label}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border py-2 px-1 transition-all duration-200 ${
                    corruptionTheme === id
                      ? `border-transparent ring-2 ${ring} bg-white/5`
                      : "border-white/10 hover:border-white/20 hover:bg-white/5"
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-full shadow-lg"
                    style={{ background: color, boxShadow: `0 0 8px 2px ${color}` }}
                  />
                  <span className="text-[9px] font-display tracking-widest uppercase text-white/50">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="w-full h-px bg-amber-900/20" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-display text-xs tracking-[0.35em] uppercase text-amber-300">
                Particle Density
              </label>
              <span className="font-stat text-sm text-amber-400 tabular-nums">
                {amberDensity.toFixed(1)}×
              </span>
            </div>
            <Slider
              min={0.5}
              max={4.0}
              step={0.1}
              value={[amberDensity]}
              onValueChange={([v]) => setAmberDensity(v)}
              className="[&_.bg-primary]:bg-amber-500 [&_.bg-primary\/20]:bg-amber-900/40 [&_.border-primary\/50]:border-amber-500/50"
            />
            <div className="flex justify-between text-[10px] text-amber-800/60 font-stat tracking-widest">
              <span>0.5×</span>
              <span>4.0×</span>
            </div>
            <p className="text-xs text-muted-foreground/50 leading-relaxed">
              Multiplies the number of particles spawned on each vice log.
            </p>
          </div>

          <div className="w-full h-px bg-amber-900/20" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-display text-xs tracking-[0.35em] uppercase text-amber-300">
                Glow Magnitude
              </label>
              <span className="font-stat text-sm text-amber-400 tabular-nums">
                {amberGlow}px
              </span>
            </div>
            <Slider
              min={5}
              max={40}
              step={1}
              value={[amberGlow]}
              onValueChange={([v]) => setAmberGlow(v)}
              className="[&_.bg-primary]:bg-amber-500 [&_.bg-primary\/20]:bg-amber-900/40 [&_.border-primary\/50]:border-amber-500/50"
            />
            <div className="flex justify-between text-[10px] text-amber-800/60 font-stat tracking-widest">
              <span>5px</span>
              <span>40px</span>
            </div>
            <p className="text-xs text-muted-foreground/50 leading-relaxed">
              Controls the radiance of the corruption aura on each particle.
            </p>
          </div>

          <div className="w-full h-px bg-amber-900/20" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-display text-xs tracking-[0.35em] uppercase text-amber-300">
                Flicker Speed
              </label>
              <span className="font-stat text-sm text-amber-400 tabular-nums">
                {amberFlicker.toFixed(2)}s
              </span>
            </div>
            <Slider
              min={0.1}
              max={1.0}
              step={0.05}
              value={[amberFlicker]}
              onValueChange={([v]) => setAmberFlicker(v)}
              className="[&_.bg-primary]:bg-amber-500 [&_.bg-primary\/20]:bg-amber-900/40 [&_.border-primary\/50]:border-amber-500/50"
            />
            <div className="flex justify-between text-[10px] text-amber-800/60 font-stat tracking-widest">
              <span>0.1s</span>
              <span>1.0s</span>
            </div>
            <p className="text-xs text-muted-foreground/50 leading-relaxed">
              Sets the flicker animation cycle. Lower = faster and more frantic.
            </p>
          </div>

          <div className="w-full h-px bg-amber-900/20" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-display text-xs tracking-[0.35em] uppercase text-amber-300">
                Ember Size
              </label>
              <span className="font-stat text-sm text-amber-400 tabular-nums">
                {amberSize.toFixed(1)}×
              </span>
            </div>
            <Slider
              min={0.4}
              max={3.0}
              step={0.1}
              value={[amberSize]}
              onValueChange={([v]) => setAmberSize(v)}
              className="[&_.bg-primary]:bg-amber-500 [&_.bg-primary\/20]:bg-amber-900/40 [&_.border-primary\/50]:border-amber-500/50"
            />
            <div className="flex justify-between text-[10px] text-amber-800/60 font-stat tracking-widest">
              <span>0.4×</span>
              <span>3.0×</span>
            </div>
            <p className="text-xs text-muted-foreground/50 leading-relaxed">
              Scales the diameter of each ember. Bigger embers drift more visibly.
            </p>
          </div>

          <div className="w-full h-px bg-amber-900/20" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="font-display text-xs tracking-[0.35em] uppercase text-amber-300">
                Ember Opacity
              </label>
              <span className="font-stat text-sm text-amber-400 tabular-nums">
                {Math.round(amberOpacity * 100)}%
              </span>
            </div>
            <Slider
              min={0.1}
              max={1.0}
              step={0.05}
              value={[amberOpacity]}
              onValueChange={([v]) => setAmberOpacity(v)}
              className="[&_.bg-primary]:bg-amber-500 [&_.bg-primary\/20]:bg-amber-900/40 [&_.border-primary\/50]:border-amber-500/50"
            />
            <div className="flex justify-between text-[10px] text-amber-800/60 font-stat tracking-widest">
              <span>10%</span>
              <span>100%</span>
            </div>
            <p className="text-xs text-muted-foreground/50 leading-relaxed">
              Peak brightness of each ember as it rises. Lower = ghostly and subtle.
            </p>
          </div>
        </div>

        <div className="px-6 py-5 border-t border-amber-900/30 space-y-3">
          <button
            onClick={() => {
              setAmberDensity(1.0);
              setAmberGlow(15);
              setAmberFlicker(0.3);
              setAmberSize(1.0);
              setAmberOpacity(0.9);
              setCorruptionTheme("amber");
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-2.5 text-xs font-display tracking-[0.25em] uppercase text-amber-600 hover:bg-amber-900/30 hover:text-amber-400 hover:border-amber-700/60 transition-all duration-200"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Defaults
          </button>
          <p className="text-[10px] tracking-[0.3em] text-amber-900/40 uppercase font-display text-center">
            Settings persist across sessions
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
