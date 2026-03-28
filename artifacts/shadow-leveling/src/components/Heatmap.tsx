import { useEffect, useRef } from "react";
import { format, subDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ActivityDay } from "@workspace/api-client-react";

interface HeatmapProps {
  data?: ActivityDay[];
}

export function Heatmap({ data = [] }: HeatmapProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);

  // Generate last 364 days (52 weeks * 7 days)
  const today = new Date();
  const days = Array.from({ length: 364 }).map((_, i) => {
    const date = subDays(today, 363 - i);
    const dateStr = format(date, "yyyy-MM-dd");
    const activity = data.find(d => d.date.startsWith(dateStr));
    return {
      date,
      count: activity?.count || 0,
      level: activity?.level || 0
    };
  });

  const getLevelColor = (level: number) => {
    switch(level) {
      case 0: return "bg-white/5 border-white/5";
      case 1: return "bg-primary/20 border-primary/20";
      case 2: return "bg-primary/40 border-primary/40";
      case 3: return "bg-primary/70 border-primary/60";
      case 4: return "bg-primary border-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]";
      default: return "bg-white/5 border-white/5";
    }
  };

  // Group by weeks for the grid column layout
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div ref={scrollRef} className="w-full overflow-x-auto pb-4 hide-scrollbar">
      <div className="flex gap-1 min-w-max">
        {weeks.map((week, wIndex) => (
          <div key={wIndex} className="flex flex-col gap-1">
            {week.map((day, dIndex) => (
              <Tooltip key={dIndex}>
                <TooltipTrigger asChild>
                  <div 
                    className={`w-3 h-3 rounded-sm border ${getLevelColor(day.level)} transition-colors hover:border-white`}
                  />
                </TooltipTrigger>
                <TooltipContent className="bg-popover border-border text-xs font-sans">
                  <p className="font-semibold">{day.count} actions</p>
                  <p className="text-muted-foreground">{format(day.date, "MMM d, yyyy")}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
