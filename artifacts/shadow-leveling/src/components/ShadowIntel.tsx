import type { ReactNode } from "react";
import { Cpu, RadioTower } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ShadowIntelProps {
  intel: string;
  title?: string;
  detail?: string;
  children?: ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function ShadowIntel({
  intel,
  title = "System Info",
  detail,
  children,
  className,
  side = "top",
}: ShadowIntelProps) {
  return (
    <Tooltip delayDuration={120}>
      <TooltipTrigger asChild>
        {children ? (
          <span className={cn("inline-flex cursor-help", className)}>
            {children}
          </span>
        ) : (
          <button
            type="button"
            className={cn(
              "inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-500/50 bg-[#050816]/80 text-blue-300 shadow-[0_0_12px_rgba(96,165,250,0.35)] transition-all hover:border-blue-300 hover:text-blue-100 hover:shadow-[0_0_18px_rgba(96,165,250,0.65)] hover:animate-pulse focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400",
              className
            )}
            aria-label={title}
          >
            <Cpu className="h-3 w-3" />
          </button>
        )}
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={10}
        className="max-w-xs rounded-xl border border-blue-500/60 bg-[#050510]/95 p-0 text-blue-100 shadow-[0_0_28px_rgba(96,165,250,0.45)] backdrop-blur-md"
      >
        <div className="relative overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-950/50 via-black to-blue-950/40" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/80 to-transparent" />
          <div className="relative space-y-2 p-4">
            <div className="flex items-center gap-2 border-b border-blue-500/20 pb-2">
              <RadioTower className="h-3.5 w-3.5 text-blue-300 drop-shadow-[0_0_8px_rgba(96,165,250,0.9)]" />
              <span className="font-display text-[11px] font-black uppercase tracking-[0.25em] text-blue-200">
                {title}
              </span>
            </div>
            <p className="font-sans text-xs leading-relaxed text-blue-100">
              {intel}
            </p>
            {detail && (
              <p className="border-t border-purple-500/20 pt-2 font-sans text-[11px] leading-relaxed text-purple-200/85">
                {detail}
              </p>
            )}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}