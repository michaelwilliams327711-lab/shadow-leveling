import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Flame, Coins, Zap, BarChart2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  LineChart,
  Line,
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
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ActivityCalendar } from "react-activity-calendar";
import Calendar from "react-calendar";

interface DashboardData {
  streak: number;
  gold: number;
  xp: number;
  xpToNextLevel: number;
  progressionCurve: { date: string; xp: number }[];
  grindBreakdown: { stat: string; xp: number }[];
  timeAllocation: { name: string; value: number; color: string }[];
  activityData: { date: string; count: number; level: number }[];
  scheduledDates: string[];
}

async function fetchDashboardData(): Promise<DashboardData> {
  await new Promise((r) => setTimeout(r, 300));

  const today = new Date();
  const progressionCurve = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const base = 1200 + i * 85;
    const noise = Math.floor(Math.random() * 120 - 40);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      xp: Math.max(0, base + noise),
    };
  });

  const grindBreakdown = [
    { stat: "Strength", xp: 1840 },
    { stat: "Intellect", xp: 2210 },
    { stat: "Discipline", xp: 1580 },
    { stat: "Focus", xp: 960 },
  ];

  const timeAllocation = [
    { name: "Daily Quests", value: 42, color: "#8b5cf6" },
    { name: "Boss Raids", value: 18, color: "#10b981" },
    { name: "Skill Grind", value: 25, color: "#6366f1" },
    { name: "Idle Study", value: 15, color: "#f59e0b" },
  ];

  const activityData: { date: string; count: number; level: number }[] = [];
  const oneYearAgo = new Date(today);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cur = new Date(oneYearAgo);
  while (cur <= today) {
    const rng = Math.random();
    let count = 0;
    let level = 0;
    if (rng > 0.45) {
      count = Math.floor(Math.random() * 8) + 1;
      level = count <= 2 ? 1 : count <= 4 ? 2 : count <= 6 ? 3 : 4;
    }
    activityData.push({
      date: cur.toISOString().split("T")[0],
      count,
      level,
    });
    cur.setDate(cur.getDate() + 1);
  }

  const scheduledDates = [
    new Date(today.getFullYear(), today.getMonth(), 3).toISOString().split("T")[0],
    new Date(today.getFullYear(), today.getMonth(), 10).toISOString().split("T")[0],
    new Date(today.getFullYear(), today.getMonth(), 15).toISOString().split("T")[0],
    new Date(today.getFullYear(), today.getMonth(), 21).toISOString().split("T")[0],
    new Date(today.getFullYear(), today.getMonth(), 28).toISOString().split("T")[0],
  ];

  return {
    streak: 14,
    gold: 8450,
    xp: 3720,
    xpToNextLevel: 5000,
    progressionCurve,
    grindBreakdown,
    timeAllocation,
    activityData,
    scheduledDates,
  };
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [calDate, setCalDate] = useState(new Date());

  useEffect(() => {
    fetchDashboardData().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    );
  }

  const xpPercent = Math.round((data.xp / data.xpToNextLevel) * 100);

  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view !== "month") return null;
    const ds = date.toISOString().split("T")[0];
    if (data.scheduledDates.includes(ds)) {
      return (
        <div className="flex justify-center mt-0.5">
          <span
            style={{
              display: "block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#10b981",
            }}
          />
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight mb-1">
          ANALYTICS
        </h1>
        <p className="text-muted-foreground text-lg tracking-widest uppercase">
          <BarChart2 className="inline w-4 h-4 mr-2 text-primary" />
          Player Progression Overview
        </p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="glass-panel border border-orange-500/20">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <Flame className="w-7 h-7 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Current Streak</p>
                <p className="text-3xl font-display font-bold text-orange-400">{data.streak}</p>
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
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Treasury / Gold</p>
                <p className="text-3xl font-display font-bold text-yellow-400">{data.gold.toLocaleString()}</p>
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
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Next Level XP</p>
                  <p className="text-xl font-display font-bold text-primary">
                    {data.xp.toLocaleString()} <span className="text-sm text-muted-foreground font-normal">/ {data.xpToNextLevel.toLocaleString()}</span>
                  </p>
                </div>
              </div>
              <Progress value={xpPercent} className="h-2" indicatorColor="bg-primary shadow-[0_0_8px_rgba(139,92,246,0.8)]" />
              <p className="text-xs text-muted-foreground">{xpPercent}% to next level</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Progression Curve */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-lg">Progression Curve — 30-Day XP</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.progressionCurve} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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

      {/* Bar + Pie Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass-panel h-full">
            <CardHeader>
              <CardTitle className="font-display tracking-widest text-lg">Grind Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  layout="vertical"
                  data={data.grindBreakdown}
                  margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: CHART_THEME.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="stat" type="category" tick={{ fill: CHART_THEME.text, fontSize: 12 }} tickLine={false} axisLine={false} width={75} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="xp" name="XP" radius={[0, 6, 6, 0]}>
                    {data.grindBreakdown.map((_, i) => {
                      const colors = ["#8b5cf6", "#10b981", "#6366f1", "#f59e0b"];
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
              <CardTitle className="font-display tracking-widest text-lg">Time Allocation — Last 7 Days</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={data.timeAllocation}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.timeAllocation.map((entry, i) => (
                      <Cell key={i} fill={entry.color} fillOpacity={0.9} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, ""]}
                    contentStyle={{
                      background: "#1c1c2e",
                      border: "1px solid #8b5cf6",
                      borderRadius: 8,
                      color: "#e4e4e7",
                      fontSize: 13,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-2 flex-1">
                {data.timeAllocation.map((item) => (
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
                    <span className="text-sm font-bold text-white">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Activity Heatmap */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-lg">Activity Heatmap — Past Year</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <ActivityCalendar
              data={data.activityData}
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

      {/* Monthly Calendar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-lg">Raid Schedule — Monthly View</CardTitle>
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
                tileContent={tileContent}
              />
            </div>
            <p className="text-center text-xs text-muted-foreground mt-3">
              <span className="inline-flex items-center gap-1">
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
                Scheduled quest or boss unlock date
              </span>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
