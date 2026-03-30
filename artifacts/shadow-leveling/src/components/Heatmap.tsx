import { useEffect, useRef } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActivityDay } from "@workspace/api-client-react";

interface HeatmapProps {
  data?: ActivityDay[];
}

function utcDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function Heatmap({ data = [] }: HeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const activityMap = new Map(data.map(a => [a.date, a]));

  const days = Array.from({ length: 364 }).map((_, i) => {
    const d = new Date(todayUTC - (363 - i) * 86400000);
    const dateStr = utcDateStr(d);
    const activity = activityMap.get(dateStr);
    return {
      dateStr,
      count: activity?.count || 0,
      level: activity?.level || 0,
    };
  });

  const getLevelColor = (level: number) => {
    switch (level) {
      case 0: return "bg-white/5 border-white/5";
      case 1: return "bg-primary/20 border-primary/20";
      case 2: return "bg-primary/40 border-primary/40";
      case 3: return "bg-primary/70 border-primary/60";
      case 4: return "bg-primary border-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]";
      default: return "bg-white/5 border-white/5";
    }
  };

  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div ref={scrollRef} className="w-full overflow-x-auto pb-4 hide-scrollbar">
      <div className="flex gap-1 min-w-max">
        {weeks.map((week) => (
          <div key={week[0]?.dateStr} className="flex flex-col gap-1">
            {week.map((day) => (
              <Tooltip key={day.dateStr}>
                <TooltipTrigger asChild>
                  <div
                    className={`w-3 h-3 rounded-sm border ${getLevelColor(day.level)} transition-colors hover:border-white`}
                  />
                </TooltipTrigger>
                <TooltipContent className="bg-popover border-border text-xs font-sans">
                  <p className="font-semibold">{day.count} actions</p>
                  <p className="text-muted-foreground">{formatDisplayDate(day.dateStr)}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
