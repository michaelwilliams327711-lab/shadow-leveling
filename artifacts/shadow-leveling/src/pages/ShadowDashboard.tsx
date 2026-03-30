import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingDown, Skull, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/InfoTooltip";
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

function parseDateLabel(dateStr: string): string {
  const [y, mo, dy] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, dy).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseDateFull(dateStr: string): string {
  const [y, mo, dy] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, dy).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const { data: apiData, isLoading } = useQuery<ApiDashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/dashboard-stats", { signal });
      if (!res.ok) throw new Error("Failed to fetch dashboard stats");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !apiData) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-500" />
      </div>
    );
  }

  const failuresByCategory = apiData.failuresByCategory ?? [];
  const greatestWeakness = failuresByCategory[0]?.category ?? "None";
  const missedCount = apiData.outcomeBreakdown?.MISSED_DAY ?? 0;
  const totalXpBled = apiData.totalXpBled ?? 0;

  const xpByDate = (apiData.xpBledByDate ?? []).map((d) => ({
    date: parseDateLabel(d.date),
    xp: d.xp,
  }));

  const entries = apiData.recentPenalties ?? [];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <InfoTooltip variant="shadow"
          what="Shadow Dashboard — your failure analytics hub."
          fn="Aggregates all XP losses, missed days, and failed quests from the past 30 days into a single dark-mode reckoning screen."
          usage="Use this weekly to confront your failures honestly. The insights here directly guide what to fix in your Quest Log."
        >
          <h1
            className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-1"
            style={{ color: "#ef4444", textShadow: "0 0 30px rgba(239,68,68,0.4)" }}
          >
            SHADOW DASHBOARD
          </h1>
        </InfoTooltip>
        <p className="text-muted-foreground text-lg tracking-widest uppercase">
          <TrendingDown className="inline w-4 h-4 mr-2 text-red-500" />
          Failure Analytics — 30-Day Reckoning
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <InfoTooltip variant="shadow"
            what="Total XP Bled — XP lost to failures in the last 30 days."
            fn="The cumulative XP deducted from failed quests and missed days over the past 30-day window."
            usage="Use this number to quantify the cost of your bad days. Reducing it means fewer failures and a healthier growth curve."
          >
            <Card className="glass-panel border border-red-500/30" style={{ boxShadow: "0 0 20px rgba(239,68,68,0.07)" }}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <TrendingDown className="w-7 h-7 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Total XP Bled</p>
                  <p className="text-3xl font-display font-bold text-red-400">
                    {totalXpBled === 0 ? "0" : `-${totalXpBled.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-muted-foreground">last 30 days</p>
                </div>
              </CardContent>
            </Card>
          </InfoTooltip>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <InfoTooltip variant="shadow"
            what="Streaks Shattered — days where your streak was broken."
            fn="Counts the number of MISSED_DAY events in the past 30 days — days where no quests were completed and your streak was reset."
            usage="Each missed day here cost you your streak multiplier. Aim to keep this at zero by completing at least one small quest every day."
          >
            <Card className="glass-panel border border-red-800/40" style={{ boxShadow: "0 0 20px rgba(153,27,27,0.07)" }}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-900/20 border border-red-800/40">
                  <Skull className="w-7 h-7 text-red-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Streaks Shattered</p>
                  <p className="text-3xl font-display font-bold" style={{ color: "#dc2626" }}>
                    {missedCount}
                  </p>
                  <p className="text-xs text-muted-foreground">missed days recorded</p>
                </div>
              </CardContent>
            </Card>
          </InfoTooltip>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <InfoTooltip variant="shadow"
            what="Greatest Weakness — the stat category with the most failures."
            fn="Identifies the quest category where you fail or miss the most, revealing the area of life requiring the most attention."
            usage="Create easier quests in this category to build momentum, or examine why tasks in this area are consistently not being completed."
          >
            <Card className="glass-panel border border-orange-700/30" style={{ boxShadow: "0 0 20px rgba(234,88,12,0.07)" }}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-orange-900/15 border border-orange-700/30">
                  <AlertTriangle className="w-7 h-7 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Greatest Weakness</p>
                  <p className="text-xl font-display font-bold text-orange-400 truncate max-w-[140px]">
                    {greatestWeakness}
                  </p>
                  <p className="text-xs text-muted-foreground">most failures here</p>
                </div>
              </CardContent>
            </Card>
          </InfoTooltip>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass-panel border border-red-900/30">
          <CardHeader>
            <InfoTooltip variant="shadow"
              what="XP Bleed — your daily XP losses over the past 30 days."
              fn="Each point shows how much XP was lost on that day due to failed quests or missed days. The area fills downward, representing loss."
              usage="Clusters of loss reveal your worst periods. Cross-reference with the Graveyard below to understand what habits caused each drop."
            >
              <CardTitle className="font-display tracking-widest text-lg text-red-400">
                XP Bleed — 30-Day Loss Curve
              </CardTitle>
            </InfoTooltip>
          </CardHeader>
          <CardContent>
            {xpByDate.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10">No XP losses recorded in the last 30 days.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart
                  data={xpByDate}
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
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass-panel border border-red-900/30 h-full">
            <CardHeader>
              <InfoTooltip variant="shadow"
                what="Time Sink — your failures broken down by quest category."
                fn="A doughnut chart showing which stat categories (Strength, Intellect, etc.) account for the most failed or missed quests."
                usage="The largest slice is your biggest time sink. Focus improvement efforts there — either reduce difficulty or increase accountability for tasks in that category."
              >
                <CardTitle className="font-display tracking-widest text-lg text-red-400">
                  Time Sink — Failures by Category
                </CardTitle>
              </InfoTooltip>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {failuresByCategory.length === 0 ? (
                <p className="text-muted-foreground text-sm">No failures recorded. For now.</p>
              ) : (
                <>
                  <PieChart width={220} height={220}>
                    <Pie
                      data={failuresByCategory}
                      cx={110}
                      cy={110}
                      innerRadius={65}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="category"
                      stroke="none"
                    >
                      {failuresByCategory.map((item, i) => (
                        <Cell
                          key={item.category}
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
                      labelStyle={{ color: "#fca5a5" }}
                      itemStyle={{ color: "#ffffff" }}
                    />
                  </PieChart>
                  <div className="w-full grid grid-cols-2 gap-x-6 gap-y-2">
                    {failuresByCategory.map((item, i) => (
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
              <InfoTooltip variant="shadow"
                what="Graveyard — a log of your most recent failures."
                fn="Lists the last 20 failed quests and missed days, including the date, category, description, and XP penalty incurred."
                usage="Review this regularly to spot recurring failure patterns. If the same description appears repeatedly, that task needs to be restructured or broken into smaller steps."
              >
                <CardTitle className="font-display tracking-widest text-lg text-red-400">
                  Graveyard — Recent Failures
                </CardTitle>
              </InfoTooltip>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[280px] pr-1 space-y-2">
              {entries.length === 0 ? (
                <p className="text-muted-foreground text-sm">No failures recorded. Stay weak.</p>
              ) : (
                entries.map((entry) => {
                  const isMissed = entry.action_type === "MISSED_DAY";
                  const entryKey = `${entry.date}-${entry.action_type}-${entry.description}`;
                  return (
                    <div
                      key={entryKey}
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
                          {parseDateFull(entry.date)}{" "}
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
