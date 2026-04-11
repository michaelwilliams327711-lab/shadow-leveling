import { useEffect } from "react";
import { Settings, RotateCcw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import { useVisualSettings } from "@/context/VisualSettingsContext";

export function SettingsDrawer() {
  const {
    amberGlow,
    amberDensity,
    amberFlicker,
    isSettingsOpen,
    setAmberGlow,
    setAmberDensity,
    setAmberFlicker,
    setIsSettingsOpen,
  } = useVisualSettings();

  useEffect(() => {
    const el = document.querySelector(".celestial-void-context") as HTMLElement | null;
    if (!el) return;
    el.style.setProperty("--amber-glow-size", `${amberGlow}px`);
    el.style.setProperty("--amber-flicker-duration", `${amberFlicker}s`);
  }, [amberGlow, amberFlicker]);

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
            Scale of Souls — Amber Corruption Controls
          </p>
        </SheetHeader>

        <div className="flex-1 px-6 py-8 space-y-10">
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
              Multiplies the number of amber particles spawned on each vice log.
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
              Controls the radiance of the amber corruption aura on each particle.
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
        </div>

        <div className="px-6 py-5 border-t border-amber-900/30 space-y-3">
          <button
            onClick={() => {
              setAmberDensity(1.0);
              setAmberGlow(15);
              setAmberFlicker(0.3);
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
