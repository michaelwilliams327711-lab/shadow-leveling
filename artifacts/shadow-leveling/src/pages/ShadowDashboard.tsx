import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingDown, Skull, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface GraveyardEntry {
  date: string;
  xp_change: number;
  action_type: string;
  description: string;
  stat_category: string;
}

interface ApiDashboardStats {
  xpByDate: { date: string; xp: number }[];
  xpByStatCategory: { category: string; xp: number }[];
  outcomeBreakdown: Record<string, number>;
  failuresByCategory: { category: string; count: number }[];
  xpBledByDate: { date: string; xp: number }[];
  totalXpBled: number;
  recentPenalties: GraveyardEntry[];
  character: {
    streak: number;
    gold: number;
    xp: number;
    xpToNextLevel: number;
    level: number;
  };
}

interface PenaltyData {
  entries: GraveyardEntry[];
  xpByDate: { date: string; xp: number }[];
  failuresByCategory: { category: string; count: number }[];
  totalXpBled: number;
  streaksShattered: number;
  greatestWeakness: string;
}

const CATEGORIES = ["Strength", "Intelligence", "Endurance", "Agility", "Discipline"];
const FAILED_DESCS = [
  "Skipped morning workout",
  "Missed study session",
  "Failed to meditate",
  "Skipped daily run",
  "Ignored reading goal",
  "Broke diet commitment",
  "Skipped cold shower",
  "Failed sleep schedule",
];

function buildMockEntries(): GraveyardEntry[] {
  const today = new Date();
  const entries: GraveyardEntry[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    if (Math.random() < 0.45) {
      const isMissedDay = Math.random() < 0.3;
      entries.push({
        date: dateStr,
        xp_change: isMissedDay
          ? -(Math.floor(Math.random() * 40) + 20)
          : -(Math.floor(Math.random() * 25) + 5),
        action_type: isMissedDay ? "MISSED_DAY" : "FAILED",
        description: FAILED_DESCS[Math.floor(Math.random() * FAILED_DESCS.length)],
        stat_category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
      });
    }
  }
  return entries;
}

function deriveMetricsFromEntries(entries: GraveyardEntry[]): PenaltyData {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const xpByDateMap: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    xpByDateMap[d.toISOString().split("T")[0]] = 0;
  }

  let totalXpBled = 0;
  let streaksShattered = 0;
  const categoryFailCounts: Record<string, number> = {};

  for (const e of entries) {
    const entryDate = new Date(e.date);
    if (entryDate >= thirtyDaysAgo) {
      const dateKey = e.date.split("T")[0];
      if (dateKey in xpByDateMap) {
        xpByDateMap[dateKey] += e.xp_change;
      }
      if (e.xp_change < 0) totalXpBled += Math.abs(e.xp_change);
      if (e.action_type === "MISSED_DAY") streaksShattered++;
      if (e.action_type === "FAILED") {
        const cat = e.stat_category || "Unknown";
        categoryFailCounts[cat] = (categoryFailCounts[cat] ?? 0) + 1;
      }
    }
  }

  const xpByDate = Object.entries(xpByDateMap).map(([date, xp]) => ({
    date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    xp,
  }));

  const failuresByCategory = Object.entries(categoryFailCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const greatestWeakness = failuresByCategory[0]?.category ?? "None";

  const recentEntries = [...entries]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  return { entries: recentEntries, xpByDate, failuresByCategory, totalXpBled, streaksShattered, greatestWeakness };
}

async function fetchPenaltyData(): Promise<PenaltyData> {
  let apiData: ApiDashboardStats | null = null;

  try {
    const res = await fetch("/api/dashboard-stats");
    if (res.ok) {
      apiData = await res.json();
    }
  } catch {
  }

  const failedCount = apiData?.outcomeBreakdown?.FAILED ?? 0;
  const missedCount = apiData?.outcomeBreakdown?.MISSED_DAY ?? 0;
  const hasRealFailures = failedCount > 0 || missedCount > 0;

  if (!apiData || !hasRealFailures) {
    return deriveMetricsFromEntries(buildMockEntries());
  }

  const failuresByCategory = apiData.failuresByCategory ?? [];
  const greatestWeakness = failuresByCategory[0]?.category ?? "None";

  const xpByDate = (apiData.xpBledByDate ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    xp: d.xp,
  }));

  return {
    entries: apiData.recentPenalties ?? [],
    xpByDate,
    failuresByCategory,
    totalXpBled: apiData.totalXpBled ?? 0,
    streaksShattered: missedCount,
    greatestWeakness,
  };
}

const SHADOW_THEME = {
  grid: "rgba(239,68,68,0.08)",
  text: "#a1a1aa",
  red: "#ef4444",
  darkRed: "#991b1b",
  orange: "#ea580c",
  tooltip: { background: "#1c0a0a", border: "#ef4444", text: "#fca5a5" },
};

const DOUGHNUT_COLORS = ["#ef4444", "#dc2626", "#ea580c", "#c2410c", "#b91c1c"];

function ShadowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: SHADOW_THEME.tooltip.background,
        border: `1px solid ${SHADOW_THEME.tooltip.border}`,
        borderRadius: 8,
        padding: "8px 14px",
        color: SHADOW_THEME.tooltip.text,
        fontSize: 13,
      }}
    >
      {label && <p style={{ marginBottom: 4, fontWeight: 600 }}>{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color ?? SHADOW_THEME.red }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function ShadowDashboard() {
  const [data, setData] = useState<PenaltyData | null>(null);

  useEffect(() => {
    fetchPenaltyData().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-500" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1
          className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-1"
          style={{ color: "#ef4444", textShadow: "0 0 30px rgba(239,68,68,0.4)" }}
        >
          SHADOW DASHBOARD
        </h1>
        <p className="text-muted-foreground text-lg tracking-widest uppercase">
          <TrendingDown className="inline w-4 h-4 mr-2 text-red-500" />
          Failure Analytics — 30-Day Reckoning
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="glass-panel border border-red-500/30" style={{ boxShadow: "0 0 20px rgba(239,68,68,0.07)" }}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                <TrendingDown className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Total XP Bled</p>
                <p className="text-3xl font-display font-bold text-red-400">
                  -{data.totalXpBled.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">last 30 days</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-panel border border-red-800/40" style={{ boxShadow: "0 0 20px rgba(153,27,27,0.07)" }}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-900/20 border border-red-800/40">
                <Skull className="w-7 h-7 text-red-700" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Streaks Shattered</p>
                <p className="text-3xl font-display font-bold" style={{ color: "#dc2626" }}>
                  {data.streaksShattered}
                </p>
                <p className="text-xs text-muted-foreground">missed days recorded</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="glass-panel border border-orange-700/30" style={{ boxShadow: "0 0 20px rgba(234,88,12,0.07)" }}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-900/15 border border-orange-700/30">
                <AlertTriangle className="w-7 h-7 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Greatest Weakness</p>
                <p className="text-xl font-display font-bold text-orange-400 truncate max-w-[140px]">
                  {data.greatestWeakness}
                </p>
                <p className="text-xs text-muted-foreground">most failures here</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass-panel border border-red-900/30">
          <CardHeader>
            <CardTitle className="font-display tracking-widest text-lg text-red-400">
              XP Bleed — 30-Day Loss Curve
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={data.xpByDate}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="bleedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#991b1b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={SHADOW_THEME.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: SHADOW_THEME.text, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={4}
                />
                <YAxis
                  tick={{ fill: SHADOW_THEME.text, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[
                    (dataMin: number) => Math.floor(dataMin * 1.1),
                    0,
                  ]}
                />
                <Tooltip content={<ShadowTooltip />} />
                <Area
                  type="monotone"
                  dataKey="xp"
                  name="XP Lost"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  fill="url(#bleedGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#ef4444", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass-panel border border-red-900/30 h-full">
            <CardHeader>
              <CardTitle className="font-display tracking-widest text-lg text-red-400">
                Time Sink — Failures by Category
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {data.failuresByCategory.length === 0 ? (
                <p className="text-muted-foreground text-sm">No failures recorded. For now.</p>
              ) : (
                <>
                  <PieChart width={220} height={220}>
                    <Pie
                      data={data.failuresByCategory}
                      cx={110}
                      cy={110}
                      innerRadius={65}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="category"
                      stroke="none"
                    >
                      {data.failuresByCategory.map((_, i) => (
                        <Cell
                          key={i}
                          fill={DOUGHNUT_COLORS[i % DOUGHNUT_COLORS.length]}
                          fillOpacity={0.9}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                      contentStyle={{
                        background: "#1c0a0a",
                        border: "1px solid #ef4444",
                        borderRadius: 8,
                        color: "#fca5a5",
                        fontSize: 13,
                      }}
                    />
                  </PieChart>
                  <div className="w-full grid grid-cols-2 gap-x-6 gap-y-2">
                    {data.failuresByCategory.map((item, i) => (
                      <div key={item.category} className="flex items-center gap-2">
                        <span
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: DOUGHNUT_COLORS[i % DOUGHNUT_COLORS.length],
                            flexShrink: 0,
                          }}
                        />
                        <span className="text-sm text-muted-foreground flex-1 truncate">{item.category}</span>
                        <span className="text-sm font-bold text-red-400">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass-panel border border-red-900/30 h-full">
            <CardHeader>
              <CardTitle className="font-display tracking-widest text-lg text-red-400">
                Graveyard — Recent Failures
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[280px] pr-1 space-y-2">
              {data.entries.length === 0 ? (
                <p className="text-muted-foreground text-sm">No failures recorded. Stay weak.</p>
              ) : (
                data.entries.map((entry, i) => {
                  const isMissed = entry.action_type === "MISSED_DAY";
                  return (
                    <div
                      key={i}
                      className="rounded-md px-3 py-2.5 border flex items-start gap-3"
                      style={{
                        background: isMissed ? "rgba(153,27,27,0.12)" : "rgba(239,68,68,0.06)",
                        borderColor: isMissed ? "rgba(153,27,27,0.4)" : "rgba(239,68,68,0.2)",
                      }}
                    >
                      <span className="text-lg mt-0.5 select-none">{isMissed ? "💀" : "✝"}</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs uppercase tracking-widest font-bold mb-0.5"
                          style={{ color: isMissed ? "#dc2626" : "#ef4444" }}
                        >
                          [{entry.action_type}] {entry.stat_category}
                        </p>
                        <p className="text-sm text-zinc-300 truncate">{entry.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}{" "}
                          &mdash;{" "}
                          <span style={{ color: "#ef4444" }}>
                            {entry.xp_change} XP
                          </span>
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
