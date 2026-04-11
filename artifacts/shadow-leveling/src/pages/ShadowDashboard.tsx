import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingDown, Skull, AlertTriangle, ShieldAlert, Zap, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { InfoTooltip } from "@/components/InfoTooltip";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useGetCorruptionHistory, customFetch } from "@workspace/api-client-react";

const EMBER_COLORS = {
  red: [
    "rgba(239,68,68,0.9)", "rgba(255,110,40,0.8)", "rgba(220,30,30,0.85)",
    "rgba(255,140,50,0.75)", "rgba(200,50,50,0.9)", "rgba(255,60,0,0.8)",
    "rgba(255,80,20,0.7)", "rgba(180,20,20,0.85)", "rgba(255,100,30,0.8)",
  ],
  crimson: [
    "rgba(180,10,10,0.9)", "rgba(200,20,20,0.85)", "rgba(160,0,0,0.9)",
    "rgba(220,30,30,0.8)", "rgba(140,0,0,0.85)", "rgba(190,15,15,0.9)",
    "rgba(210,25,25,0.75)", "rgba(150,5,5,0.9)", "rgba(170,10,10,0.85)",
  ],
  orange: [
    "rgba(251,146,60,0.9)", "rgba(234,88,12,0.85)", "rgba(249,115,22,0.8)",
    "rgba(253,186,116,0.75)", "rgba(194,65,12,0.9)", "rgba(252,165,80,0.8)",
    "rgba(245,100,20,0.85)", "rgba(255,130,40,0.75)", "rgba(230,80,15,0.9)",
  ],
  blue: [
    "rgba(0,200,255,0.9)", "rgba(30,160,255,0.85)", "rgba(100,220,255,0.8)",
    "rgba(0,180,255,0.92)", "rgba(60,210,255,0.75)", "rgba(0,230,255,0.88)",
    "rgba(80,190,255,0.8)", "rgba(0,150,255,0.9)",  "rgba(120,230,255,0.75)",
  ],
};

function SystemCorners() {
  return (
    <>
      <span className="sl-corner tl" />
      <span className="sl-corner tr" />
      <span className="sl-corner bl" />
      <span className="sl-corner br" />
    </>
  );
}

function EmberParticles({ palette = "red", count = 40 }: { palette?: keyof typeof EMBER_COLORS; count?: number }) {
  const colors = EMBER_COLORS[palette];
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const size = [1.5, 2, 2.5, 1, 3, 1.5, 2, 1, 2.5][i % 9];
        const left = ((i * 2.47 + 3) % 92) + 4;
        const delay = (i * 0.18) % 7;
        const dur = 5 + (i % 5) * 0.5;
        const drift = (i % 2 === 0 ? 1 : -1) * (3 + (i % 6));
        const color = colors[i % colors.length];
        return (
          <span
            key={i}
            className="ember-particle"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              background: color,
              "--delay": `${delay}s`,
              "--dur": `${dur}s`,
              "--drift": `${drift}px`,
            } as React.CSSProperties}
          />
        );
      })}
    </>
  );
}

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
  grid: "rgba(0,180,255,0.08)",
  text: "rgba(140,210,255,0.7)",
  red: "rgba(0,200,255,0.9)",
  darkRed: "rgba(0,100,255,0.6)",
  orange: "rgba(0,170,255,0.8)",
  tooltip: {
    background: "rgba(0,4,20,0.96)",
    border: "rgba(0,180,255,0.5)",
    text: "rgba(160,230,255,0.9)",
  },
};

const DOUGHNUT_COLORS = [
  "rgba(0,200,255,0.92)",
  "rgba(30,140,255,0.88)",
  "rgba(100,200,255,0.82)",
  "rgba(0,160,255,0.76)",
  "rgba(60,220,255,0.70)",
];

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
  const { data: apiData, isLoading, isError, refetch } = useQuery<ApiDashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: ({ signal }) =>
      customFetch<ApiDashboardStats>("/api/dashboard-stats", { signal }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: corruptionData } = useGetCorruptionHistory({ query: { staleTime: 5 * 60 * 1000 } });

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
        <Skeleton className="h-16 w-72 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-xl p-6 space-y-3">
              <Skeleton className="h-5 w-1/2 rounded" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-xl p-6 space-y-3">
              <Skeleton className="h-5 w-1/3 rounded" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !apiData) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-destructive font-bold tracking-widest uppercase">Failed to load Void data</p>
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="border-destructive/50 text-destructive hover:bg-destructive/10 gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
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

  const corruptionChartData = (corruptionData?.chartData ?? []).map((d) => ({
    date: parseDateLabel(d.date),
    corruption: d.corruption,
  }));
  const relapseEvents = corruptionData?.relapseEvents ?? [];

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
            style={{ color: "rgba(0,210,255,1)", textShadow: "0 0 30px rgba(0,180,255,0.55), 0 0 60px rgba(0,120,255,0.3)" }}
          >
            THE VOID
          </h1>
        </InfoTooltip>
        <p className="text-lg tracking-widest uppercase" style={{ color: "rgba(100,200,255,0.65)" }}>
          <TrendingDown className="inline w-4 h-4 mr-2" style={{ color: "rgba(0,200,255,0.7)" }} />
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
            <Card className="glass-panel sl-panel border">
              <SystemCorners />
              <EmberParticles palette="blue" />
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ background: "rgba(0,180,255,0.1)", border: "1px solid rgba(0,180,255,0.3)" }}>
                  <TrendingDown className="w-7 h-7" style={{ color: "rgba(0,210,255,0.9)" }} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-0.5 font-mono" style={{ color: "rgba(0,200,255,0.55)" }}>Total XP Bled</p>
                  <p className="text-3xl font-stat font-bold" style={{ color: "rgba(0,220,255,1)", textShadow: "0 0 12px rgba(0,180,255,0.6)" }}>
                    {totalXpBled === 0 ? "0" : `-${totalXpBled.toLocaleString()}`}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(100,190,255,0.5)" }}>last 30 days</p>
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
            <Card className="glass-panel sl-panel border">
              <SystemCorners />
              <EmberParticles palette="blue" />
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ background: "rgba(0,140,255,0.08)", border: "1px solid rgba(0,160,255,0.28)" }}>
                  <Skull className="w-7 h-7" style={{ color: "rgba(60,190,255,0.85)" }} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-0.5 font-mono" style={{ color: "rgba(0,200,255,0.55)" }}>Streaks Shattered</p>
                  <p className="text-3xl font-stat font-bold" style={{ color: "rgba(0,220,255,1)", textShadow: "0 0 12px rgba(0,180,255,0.6)" }}>
                    {missedCount}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(100,190,255,0.5)" }}>missed days recorded</p>
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
            <Card className="glass-panel sl-panel border">
              <SystemCorners />
              <EmberParticles palette="blue" />
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-xl" style={{ background: "rgba(0,160,255,0.08)", border: "1px solid rgba(0,170,255,0.28)" }}>
                  <AlertTriangle className="w-7 h-7" style={{ color: "rgba(0,200,255,0.85)" }} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-0.5 font-mono" style={{ color: "rgba(0,200,255,0.55)" }}>Greatest Weakness</p>
                  <p className="text-xl font-display font-bold truncate max-w-[140px]" style={{ color: "rgba(0,220,255,1)", textShadow: "0 0 10px rgba(0,180,255,0.5)" }}>
                    {greatestWeakness}
                  </p>
                  <p className="text-xs" style={{ color: "rgba(100,190,255,0.5)" }}>most failures here</p>
                </div>
              </CardContent>
            </Card>
          </InfoTooltip>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="glass-panel sl-panel border">
          <SystemCorners />
          <CardHeader>
            <InfoTooltip variant="shadow"
              what="XP Bleed — your daily XP losses over the past 30 days."
              fn="Each point shows how much XP was lost on that day due to failed quests or missed days. The area fills downward, representing loss."
              usage="Clusters of loss reveal your worst periods. Cross-reference with the Graveyard below to understand what habits caused each drop."
            >
              <CardTitle className="font-display tracking-widest text-lg" style={{ color: "rgba(0,210,255,0.9)", textShadow: "0 0 8px rgba(0,180,255,0.4)" }}>
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
                      <stop offset="5%" stopColor={SHADOW_THEME.red} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={SHADOW_THEME.darkRed} stopOpacity={0} />
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
                    stroke={SHADOW_THEME.red}
                    strokeWidth={2.5}
                    fill="url(#bleedGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: SHADOW_THEME.red, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass-panel sl-panel border h-full">
            <SystemCorners />
            <EmberParticles palette="blue" />
            <CardHeader>
              <InfoTooltip variant="shadow"
                what="Time Sink — your failures broken down by quest category."
                fn="A doughnut chart showing which stat categories (Strength, Intellect, etc.) account for the most failed or missed quests."
                usage="The largest slice is your biggest time sink. Focus improvement efforts there — either reduce difficulty or increase accountability for tasks in that category."
              >
                <CardTitle className="font-display tracking-widest text-lg" style={{ color: "rgba(0,210,255,0.9)", textShadow: "0 0 8px rgba(0,180,255,0.4)" }}>
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
                        background: SHADOW_THEME.tooltip.background,
                        border: `1px solid ${SHADOW_THEME.tooltip.border}`,
                        borderRadius: 8,
                        color: SHADOW_THEME.tooltip.text,
                        fontSize: 13,
                      }}
                      labelStyle={{ color: SHADOW_THEME.tooltip.text }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
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
                        <span className="text-sm font-bold" style={{ color: "rgba(0,210,255,0.9)" }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass-panel sl-panel border h-full">
            <SystemCorners />
            <EmberParticles palette="blue" />
            <CardHeader>
              <InfoTooltip variant="shadow"
                what="Graveyard — a log of your most recent failures."
                fn="Lists the last 20 failed quests and missed days, including the date, category, description, and XP penalty incurred."
                usage="Review this regularly to spot recurring failure patterns. If the same description appears repeatedly, that task needs to be restructured or broken into smaller steps."
              >
                <CardTitle className="font-display tracking-widest text-lg" style={{ color: "rgba(0,210,255,0.9)", textShadow: "0 0 8px rgba(0,180,255,0.4)" }}>
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
                      className="rounded-md px-3 py-2.5 flex items-start gap-3"
                      style={{
                        background: isMissed ? "rgba(0,120,255,0.12)" : "rgba(0,100,255,0.06)",
                        border: `1px solid ${isMissed ? "rgba(0,180,255,0.4)" : "rgba(0,160,255,0.2)"}`,
                      }}
                    >
                      <span className="text-lg mt-0.5 select-none">{isMissed ? "⚠" : "◈"}</span>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs uppercase tracking-widest font-bold mb-0.5 font-mono"
                          style={{ color: "rgba(0,200,255,0.85)" }}
                        >
                          [{entry.action_type}] {entry.stat_category}
                        </p>
                        <p className="text-sm truncate" style={{ color: "rgba(180,230,255,0.85)" }}>{entry.description}</p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(100,180,255,0.55)" }}>
                          {parseDateFull(entry.date)}{" "}
                          &mdash;{" "}
                          <span style={{ color: "rgba(0,210,255,0.9)" }}>
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

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <Card className="glass-panel sl-panel border">
          <SystemCorners />
          <EmberParticles palette="blue" count={60} />
          <CardHeader>
            <InfoTooltip variant="shadow"
              what="Corruption History — your corruption score over time."
              fn="A line chart plotting how your Corruption stat has changed with each relapse or purification event. The log below shows each relapse event."
              usage="Use this to see patterns in your relapses and measure your progress in keeping corruption low."
            >
              <CardTitle className="font-display tracking-widest text-lg flex items-center gap-2" style={{ color: "rgba(0,210,255,0.9)", textShadow: "0 0 8px rgba(0,180,255,0.4)" }}>
                <ShieldAlert className="w-5 h-5" />
                Corruption History
              </CardTitle>
            </InfoTooltip>
          </CardHeader>
          <CardContent>
            {corruptionChartData.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-10">No corruption events recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={corruptionChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="corruptionGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={SHADOW_THEME.red} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={SHADOW_THEME.darkRed} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={SHADOW_THEME.grid} />
                  <XAxis dataKey="date" tick={{ fill: SHADOW_THEME.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: SHADOW_THEME.text, fontSize: 11 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip content={<ShadowTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="corruption"
                    name="Corruption"
                    stroke={SHADOW_THEME.red}
                    strokeWidth={2.5}
                    dot={{ fill: SHADOW_THEME.red, r: 4, stroke: "hsl(var(--card))", strokeWidth: 1.5 }}
                    activeDot={{ r: 6, fill: SHADOW_THEME.red, stroke: "hsl(var(--card))", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {relapseEvents.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="glass-panel sl-panel border">
            <SystemCorners />
            <EmberParticles palette="blue" />
            <CardHeader>
              <InfoTooltip variant="shadow"
                what="Relapse Log — every relapse event recorded."
                fn="Shows date, habit name, and corruption increase for each logged relapse."
                usage="Review this log to identify which habits are causing the most damage and focus your effort there."
              >
                <CardTitle className="font-display tracking-widest text-lg flex items-center gap-2" style={{ color: "rgba(0,210,255,0.9)", textShadow: "0 0 8px rgba(0,180,255,0.4)" }}>
                  <Zap className="w-5 h-5" />
                  Relapse Log
                </CardTitle>
              </InfoTooltip>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[280px] pr-1 space-y-2">
              {relapseEvents.map((event, i) => (
                <div
                  key={`${event.occurredAt}-${i}`}
                  className="rounded-md px-3 py-2.5 flex items-start gap-3"
                  style={{ background: "rgba(0,100,255,0.06)", border: "1px solid rgba(0,160,255,0.2)" }}
                >
                  <span className="text-lg mt-0.5 select-none">◈</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs uppercase tracking-widest font-bold mb-0.5 font-mono" style={{ color: "rgba(0,200,255,0.85)" }}>
                      RELAPSE — {event.habitName}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(100,180,255,0.55)" }}>
                      {parseDateFull(event.date)} &mdash;{" "}
                      <span style={{ color: "rgba(0,210,255,0.9)" }}>+{event.delta} Corruption</span>
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
