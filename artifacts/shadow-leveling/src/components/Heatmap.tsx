import { useRef, useState } from "react";
import { Flame } from "lucide-react";
import type { ActivityDay } from "@workspace/api-client-react";

interface HeatmapProps {
  data?: ActivityDay[];
}

interface HoveredDay {
  dateStr: string;
  count: number;
  x: number;
  y: number;
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function Heatmap({ data = [] }: HeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDay, setHoveredDay] = useState<HoveredDay | null>(null);

  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const windowStartUTC = todayUTC - 363 * 86400000;

  const activityMap = new Map(data.map(a => [a.date, a]));

  const days: { dateStr: string; count: number; level: number }[] = [];
  for (let ms = windowStartUTC; ms <= todayUTC; ms += 86400000) {
    const d = new Date(ms);
    const dateStr = utcDateStr(d);
    const activity = activityMap.get(dateStr);
    days.push({
      dateStr,
      count: activity?.count || 0,
      level: activity?.level || 0,
    });
  }

  const windowStartDayOfWeek = new Date(windowStartUTC).getUTCDay();
  const paddedDays: (typeof days[0] | null)[] = [
    ...Array(windowStartDayOfWeek).fill(null),
    ...days,
  ];

  const weeks: (typeof days[0] | null)[][] = [];
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7));
  }

  const monthLabels: { label: string; colIndex: number }[] = [];
  const seenMonths = new Set<string>();

  for (let ms = windowStartUTC; ms <= todayUTC; ms += 86400000) {
    const d = new Date(ms);
    const month = d.getUTCMonth();
    const year = d.getUTCFullYear();
    const key = `${year}-${month}`;

    if (d.getUTCDate() === 1 && !seenMonths.has(key)) {
      seenMonths.add(key);
      const dayOffset = Math.round((ms - windowStartUTC) / 86400000);
      const colIndex = Math.floor((dayOffset + windowStartDayOfWeek) / 7);
      monthLabels.push({ label: MONTH_NAMES[month], colIndex });
    }
  }

  const startYear = new Date(windowStartUTC).getUTCFullYear();
  const endYear = now.getUTCFullYear();
  const titleYear = startYear === endYear ? String(endYear) : `${startYear} \u2013 ${endYear}`;

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

  const handleMouseEnter = (day: { dateStr: string; count: number }, e: React.MouseEvent<HTMLDivElement>) => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const cellRect = e.currentTarget.getBoundingClientRect();
    setHoveredDay({
      dateStr: day.dateStr,
      count: day.count,
      x: cellRect.left - containerRect.left + cellRect.width / 2,
      y: cellRect.top - containerRect.top,
    });
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  const CELL_STEP = 16;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-primary" />
        <span className="text-sm">
          Activity Heatmap — {titleYear}
        </span>
      </div>

      <div ref={containerRef} className="relative w-full overflow-x-auto hide-scrollbar">
        <div className="min-w-max">
          <div className="relative h-4 mb-1" style={{ width: weeks.length * CELL_STEP - 4 }}>
            {monthLabels.map(({ label, colIndex }, i) => (
              <span
                key={`${label}-${i}`}
                className="absolute text-[10px] text-muted-foreground leading-none"
                style={{ left: colIndex * CELL_STEP }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {Array.from({ length: 7 }).map((_, dIdx) => {
                  const day = week[dIdx];
                  if (!day) {
                    return <div key={dIdx} className="w-3 h-3 rounded-sm opacity-0" />;
                  }
                  return (
                    <div
                      key={day.dateStr}
                      className={`w-3 h-3 rounded-sm border ${getLevelColor(day.level)} transition-colors hover:border-white cursor-default`}
                      onMouseEnter={(e) => handleMouseEnter(day, e)}
                      onMouseLeave={handleMouseLeave}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] text-muted-foreground">Less</span>
            {[1, 2, 3, 4].map(level => (
              <div
                key={level}
                className={`w-3 h-3 rounded-sm border ${getLevelColor(level)}`}
              />
            ))}
            <span className="text-[10px] text-muted-foreground">More</span>
          </div>
        </div>

        {hoveredDay && (
          <div
            className="pointer-events-none absolute z-50 rounded-md border border-border bg-popover px-3 py-1.5 text-xs font-sans shadow-md"
            style={{
              left: hoveredDay.x,
              top: hoveredDay.y - 8,
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="font-semibold">{hoveredDay.count} actions</p>
            <p className="text-muted-foreground">{formatDisplayDate(hoveredDay.dateStr)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
