import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Coins, Zap, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ActivityCalendar } from "react-activity-calendar";
import Calendar from "react-calendar";

interface DashboardStats {
  xpByDate: { date: string; xp: number }[];
  xpByStatCategory: { category: string; xp: number }[];
  activityCalendar: { date: string; count: number; level: number }[];
  outcomeBreakdown: Record<string, number>;
  character: {
    streak: number;
    gold: number;
    xp: number;
    xpToNextLevel: number;
    level: number;
  };
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch("/api/dashboard-stats");
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

const CHART_THEME = {
  background: "transparent",
  text: "#a1a1aa",
  grid: "rgba(255,255,255,0.05)",
  purple: "#8b5cf6",
  green: "#10b981",
  tooltip: { background: "#1c1c2e", border: "#8b5cf6", text: "#e4e4e7" },
};

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: CHART_THEME.tooltip.background,
        border: `1px solid ${CHART_THEME.tooltip.border}`,
        borderRadius: 8,
        padding: "8px 14px",
        color: CHART_THEME.tooltip.text,
        fontSize: 13,
      }}
    >
      {label && <p style={{ marginBottom: 4, fontWeight: 600 }}>{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [calDate, setCalDate] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardStats()
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <p className="text-red-400">Failed to load analytics: {error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  const xpPercent = Math.round((data.character.xp / data.character.xpToNextLevel) * 100);

  const outcomeChartData = [
    { name: "Completed", value: data.outcomeBreakdown.COMPLETED ?? 0, color: "#10b981" },
    { name: "Boss Defeated", value: data.outcomeBreakdown.BOSS_DEFEATED ?? 0, color: "#8b5cf6" },
    { name: "Failed", value: data.outcomeBreakdown.FAILED ?? 0, color: "#ef4444" },
    { name: "Missed Day", value: data.outcomeBreakdown.MISSED_DAY ?? 0, color: "#f59e0b" },
  ].filter((d) => d.value > 0);

  const xpByDateFormatted = data.xpByDate.map((d) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }));

  const xpByStatFormatted = data.xpByStatCategory.map((d) => ({
    stat: d.category,
    xp: d.xp,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight mb-1">
          ANALYTICS
        </h1>
        <InfoTooltip
          what="Analytics — a full breakdown of your progression data."
          fn="Aggregates your XP gains, gold, streaks, quest outcomes, and activity over time into charts and summaries."
          usage="Use this page to identify trends, spot weaknesses, and optimize which quests you're prioritizing."
        >
          <p className="text-muted-foreground text-lg tracking-widest uppercase cursor-default w-fit">
            <BarChart2 className="inline w-4 h-4 mr-2 text-primary" />
            Player Progression Overview
          </p>
        </InfoTooltip>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="glass-panel border border-orange-500/20">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <Flame className="w-7 h-7 text-orange-500" />
              </div>
              <div>
                <InfoTooltip
                  what="Current Streak — consecutive days you've checked in without missing."
                  fn="Resets to 0 if you skip a daily check-in. Longer streaks grow your XP/Gold reward multiplier."
                  usage="Check in every day using the 'Daily Arise' button on the Status page to keep your streak alive."
                >
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5 cursor-default">Current Streak</p>
                </InfoTooltip>
                <p className="text-3xl font-display font-bold text-orange-400">{data.character.streak}</p>
                <p className="text-xs text-muted-foreground">days in a row</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-panel border border-yellow-500/20">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <Coins className="w-7 h-7 text-yellow-400" />
              </div>
              <div>
                <InfoTooltip
                  what="Treasury / Gold — your total accumulated in-game currency."
                  fn="Earned by completing quests. Higher-rank quests award more Gold per run."
                  usage="Spend Gold in the Shop to redeem real-life rewards you've defined for yourself."
                >
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5 cursor-default">Treasury / Gold</p>
                </InfoTooltip>
                <p className="text-3xl font-display font-bold text-yellow-400">{data.character.gold.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">gold coins</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="glass-panel border border-primary/20">
            <CardContent className="p-5 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <InfoTooltip
                    what="Next Level XP — your current XP progress toward the next level."
                    fn="XP accumulates from completed quests and resets per-level (not globally). The bar shows how far you are."
                    usage="Focus on higher-rank quests and maintain your streak multiplier to level up faster."
                  >
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5 cursor-default">Next Level XP</p>
                  </InfoTooltip>
                  <p className="text-xl font-display font-bold text-primary">
                    {data.character.xp.toLocaleString()} <span className="text-sm text-muted-foreground font-normal">/ {data.character.xpToNextLevel.toLocaleString()}</span>
                  </p>
                </div>
              </div>
              <Progress value={xpPercent} className="h-2" indicatorClassName="bg-primary shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
              <p className="text-xs text-muted-foreground">{xpPercent}% to next level</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-lg">
              <InfoTooltip
                what="Progression Curve — your XP earned per day over the last 30 days."
                fn="Each point on the chart represents net XP gained that day from completed quests. Flat lines mean no activity."
                usage="Look for consistent peaks — they indicate your most productive days. Aim to reduce gaps between peaks."
              >
                <span className="cursor-default">Progression Curve — 30-Day XP</span>
              </InfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={xpByDateFormatted} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: CHART_THEME.text, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis tick={{ fill: CHART_THEME.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="xp"
                  name="XP Gained"
                  stroke="#8b5cf6"
                  strokeWidth={2.5}
                  fill="url(#xpGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass-panel h-full">
            <CardHeader>
              <CardTitle className="font-display tracking-widest text-lg">
                <InfoTooltip
                  what="Grind Breakdown — total XP earned broken down by which stat category the quests targeted."
                  fn="Shows whether your grind is balanced across Strength, Intellect, Endurance, Agility, and Discipline."
                  usage="If one bar dominates, consider adding quests in other categories to develop a well-rounded character."
                >
                  <span className="cursor-default">Grind Breakdown — XP by Stat</span>
                </InfoTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={xpByStatFormatted}
                  margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: CHART_THEME.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="stat" type="category" tick={{ fill: CHART_THEME.text, fontSize: 12 }} tickLine={false} axisLine={false} width={75} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="xp" name="XP" radius={[0, 6, 6, 0]}>
                    {xpByStatFormatted.map((_, i) => {
                      const colors = ["#8b5cf6", "#10b981", "#6366f1", "#f59e0b", "#ec4899"];
                      return <Cell key={i} fill={colors[i % colors.length]} fillOpacity={0.85} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass-panel h-full">
            <CardHeader>
              <CardTitle className="font-display tracking-widest text-lg">
                <InfoTooltip
                  what="Quest Outcome Breakdown — a pie chart of all your quest results to date."
                  fn="Segments show counts of Completed, Failed, Missed, and Boss Defeated outcomes across your entire history."
                  usage="A high Failed or Missed ratio signals quests that may be too ambitious — consider adjusting difficulty or deadlines."
                >
                  <span className="cursor-default">Quest Outcome Breakdown</span>
                </InfoTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-4">
              {outcomeChartData.length === 0 ? (
                <p className="text-muted-foreground text-sm">No quest activity recorded yet.</p>
              ) : (
                <>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={outcomeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {outcomeChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} fillOpacity={0.9} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                        contentStyle={{
                          background: "#1c1c2e",
                          border: "1px solid #8b5cf6",
                          borderRadius: 8,
                          color: "#e4e4e7",
                          fontSize: 13,
                        }}
                        labelStyle={{ color: "#e4e4e7" }}
                        itemStyle={{ color: "#ffffff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 flex-1">
                    {outcomeChartData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: item.color,
                            flexShrink: 0,
                          }}
                        />
                        <span className="text-sm text-muted-foreground flex-1">{item.name}</span>
                        <span className="text-sm font-bold text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-lg">
              <InfoTooltip
                what="Activity Heatmap — a full-year view of your daily quest activity."
                fn="Each cell is one day. Darker green means more quests completed. The label shows your total quest count for the year."
                usage="Identify your most active weeks and any streaks of inactivity. Consistency over the year is the goal."
              >
                <span className="cursor-default">Activity Heatmap — Past Year</span>
              </InfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <ActivityCalendar
              data={data.activityCalendar}
              theme={{
                dark: ["#1a1a2e", "#1e3a2e", "#166534", "#16a34a", "#10b981"],
              }}
              colorScheme="dark"
              labels={{
                months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                totalCount: "{{count}} quests completed in {{year}}",
                legend: { less: "Less", more: "More" },
              }}
              style={{ color: "#a1a1aa", fontSize: 12 }}
              blockSize={13}
              blockMargin={4}
              fontSize={12}
            />
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-lg">
              <InfoTooltip
                what="Raid Schedule — an interactive monthly calendar for planning and reviewing your quest timeline."
                fn="Navigate months to see which days you were active. Today is highlighted in green, selected days in purple."
                usage="Use it to plan ahead — spot upcoming gaps in your schedule and decide which quests to tackle each day."
              >
                <span className="cursor-default">Raid Schedule — Monthly View</span>
              </InfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <style>{`
              .analytics-calendar .react-calendar {
                background: transparent;
                border: none;
                width: 100%;
                font-family: inherit;
                color: #e4e4e7;
              }
              .analytics-calendar .react-calendar__navigation {
                display: flex;
                align-items: center;
                margin-bottom: 12px;
              }
              .analytics-calendar .react-calendar__navigation button {
                background: transparent;
                border: none;
                color: #a1a1aa;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                padding: 6px 10px;
                border-radius: 6px;
                transition: background 0.15s, color 0.15s;
              }
              .analytics-calendar .react-calendar__navigation button:hover {
                background: rgba(139,92,246,0.15);
                color: #8b5cf6;
              }
              .analytics-calendar .react-calendar__navigation__label {
                flex: 1;
                font-size: 15px !important;
                font-weight: 700 !important;
                color: #e4e4e7 !important;
                letter-spacing: 0.05em;
                text-align: center;
              }
              .analytics-calendar .react-calendar__month-view__weekdays {
                text-align: center;
                font-size: 11px;
                color: #71717a;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                margin-bottom: 6px;
              }
              .analytics-calendar .react-calendar__month-view__weekdays abbr {
                text-decoration: none;
              }
              .analytics-calendar .react-calendar__tile {
                background: transparent;
                border: none;
                color: #e4e4e7;
                padding: 8px 4px;
                border-radius: 8px;
                cursor: pointer;
                font-size: 13px;
                transition: background 0.15s;
                text-align: center;
              }
              .analytics-calendar .react-calendar__tile:hover {
                background: rgba(139,92,246,0.15);
              }
              .analytics-calendar .react-calendar__tile--active {
                background: rgba(139,92,246,0.3) !important;
                color: #a78bfa !important;
                font-weight: 700;
              }
              .analytics-calendar .react-calendar__tile--now {
                background: rgba(16,185,129,0.1);
                color: #10b981;
                font-weight: 700;
              }
              .analytics-calendar .react-calendar__month-view__days__day--neighboringMonth {
                color: #3f3f46;
              }
            `}</style>
            <div className="analytics-calendar max-w-md mx-auto">
              <Calendar
                value={calDate}
                onChange={(val) => val instanceof Date && setCalDate(val)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
