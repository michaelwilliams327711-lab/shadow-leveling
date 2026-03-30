import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CalendarDays,
  LayoutGrid,
  TrendingUp,
  Sword,
  Shield,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  Skull,
  Star,
  Flame,
  Target,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useGetPlannerDaily,
  useGetPlannerWeekly,
  useGetPlannerMonthly,
  useGetPlannerYearly,
  useRescheduleQuest,
  getPlannerWeeklyQueryKey,
  type Quest,
  type WeeklyPlannerDay,
  type MonthlyPlannerDay,
  type YearlyHeatmapDay,
  type YearlyKeyEvent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

type PlannerView = "daily" | "weekly" | "monthly" | "yearly";

const DIFFICULTY_COLORS: Record<string, string> = {
  F: "text-slate-400",
  E: "text-green-400",
  D: "text-blue-400",
  C: "text-indigo-400",
  B: "text-purple-400",
  A: "text-amber-400",
  S: "text-orange-400",
  SS: "text-rose-400",
  SSS: "text-red-400",
};

const DIFFICULTY_BG: Record<string, string> = {
  F: "bg-slate-500/20",
  E: "bg-green-500/20",
  D: "bg-blue-500/20",
  C: "bg-indigo-500/20",
  B: "bg-purple-500/20",
  A: "bg-amber-500/20",
  S: "bg-orange-500/20",
  SS: "bg-rose-500/20",
  SSS: "bg-red-500/20",
};

function getRecurrenceLabel(quest: Quest): string | null {
  const r = quest.recurrence;
  if (!r || r.type === "none") return null;
  if (r.type === "daily") return r.intervalDays && r.intervalDays > 1 ? `Every ${r.intervalDays}d` : "Daily";
  if (r.type === "weekly") return "Weekly";
  if (r.type === "monthly") return "Monthly";
  if (r.type === "yearly") return "Yearly";
  return null;
}

function QuestCard({ quest, compact = false }: { quest: Quest; compact?: boolean }) {
  const recLabel = getRecurrenceLabel(quest);
  const isCompleted = quest.status === "completed";

  return (
    <div
      className={`flex items-start gap-2 rounded-lg px-3 py-2 border transition-all ${
        isCompleted
          ? "opacity-50 bg-white/3 border-white/5"
          : "bg-white/5 border-white/10 hover:bg-white/8"
      }`}
    >
      {isCompleted ? (
        <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-medium truncate ${isCompleted ? "line-through text-muted-foreground" : "text-white"}`}>
            {quest.name}
          </span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${DIFFICULTY_BG[quest.difficulty]} ${DIFFICULTY_COLORS[quest.difficulty]}`}>
            {quest.difficulty}
          </span>
          {recLabel && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">
              {recLabel}
            </span>
          )}
        </div>
        {!compact && (
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-yellow-400" />
              {quest.xpReward} XP
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {quest.durationMinutes}m
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function DailyView() {
  const { data, isLoading } = useGetPlannerDaily();

  if (isLoading) {
    return <ViewSkeleton />;
  }

  if (!data) return null;

  const completionPct = data.totalDueCount > 0
    ? Math.round((data.completedTodayCount / data.totalDueCount) * 100)
    : 0;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  const badHabitsDueCount = data.badHabits.filter((h) => h.todayStatus === null).length;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-primary/30 bg-primary/5 p-5 backdrop-blur-sm"
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wider text-white">
              TODAY'S ORDERS
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">{formatDate(data.date)}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-stat font-bold text-yellow-400">
              +{data.totalXpAvailable} XP
            </div>
            <div className="text-xs text-muted-foreground">available if cleared</div>
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{data.completedTodayCount} / {data.totalDueCount} completed</span>
            <span>{completionPct}%</span>
          </div>
          <Progress value={completionPct} className="h-2" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-white/5 p-2">
            <div className="text-lg font-stat font-bold text-white">{data.quests.length}</div>
            <div className="text-xs text-muted-foreground">Quests Due</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2">
            <div className="text-lg font-stat font-bold text-blue-400">{data.dailyOrders.filter(o => !o.completed).length}</div>
            <div className="text-xs text-muted-foreground">Daily Orders</div>
          </div>
          <div className="rounded-lg bg-white/5 p-2">
            <div className={`text-lg font-stat font-bold ${badHabitsDueCount > 0 ? "text-red-400" : "text-green-400"}`}>
              {badHabitsDueCount}
            </div>
            <div className="text-xs text-muted-foreground">Habit Check-ins</div>
          </div>
        </div>
      </motion.div>

      {data.quests.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-background/50 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sword className="h-4 w-4 text-primary" />
                Active Quests Due Today
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.quests.map((q) => (
                <QuestCard key={q.id} quest={q} />
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {data.dailyOrders.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="bg-background/50 border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4 text-blue-400" />
                Daily Orders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.dailyOrders.map((order) => (
                <div
                  key={order.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
                    order.completed
                      ? "opacity-50 bg-white/3 border-white/5"
                      : "bg-blue-500/5 border-blue-500/20"
                  }`}
                >
                  {order.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-blue-400 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${order.completed ? "line-through text-muted-foreground" : "text-white"}`}>
                    {order.name}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">{order.statCategory}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {data.badHabits.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-background/50 border-red-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-red-400" />
                Bad Habit Check-ins
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.badHabits.map((habit) => {
                const status = habit.todayStatus;
                return (
                  <div
                    key={habit.id}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${
                      status === "clean"
                        ? "bg-green-500/5 border-green-500/20"
                        : status === "relapse"
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    {status === "clean" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
                    ) : status === "relapse" ? (
                      <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-sm text-white">{habit.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {status === "clean" ? "Clean" : status === "relapse" ? "Relapsed" : "Unchecked"}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {data.quests.length === 0 && data.dailyOrders.length === 0 && data.badHabits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-primary/10 p-4 mb-4">
            <Star className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">All clear, Hunter</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            No quests or tasks due today. Add recurring quests or daily orders to see them here.
          </p>
        </div>
      )}
    </div>
  );
}

function WeeklyView() {
  const { data, isLoading } = useGetPlannerWeekly();
  const rescheduleQuest = useRescheduleQuest();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dragQuestRef = useRef<{ questId: number; fromDate: string } | null>(null);

  if (isLoading) return <ViewSkeleton />;
  if (!data) return null;

  const today = new Date().toISOString().split("T")[0];

  const handleDragStart = (questId: number, fromDate: string) => {
    dragQuestRef.current = { questId, fromDate };
  };

  const handleDrop = async (toDate: string) => {
    if (!dragQuestRef.current) return;
    const { questId, fromDate } = dragQuestRef.current;
    if (fromDate === toDate) return;

    try {
      await rescheduleQuest.mutateAsync({ questId, newDeadline: toDate });
      await queryClient.invalidateQueries({ queryKey: getPlannerWeeklyQueryKey() });
      toast({ title: "Quest rescheduled", description: `Moved to ${toDate}`, duration: 3000 });
    } catch {
      toast({ title: "Failed to reschedule", variant: "destructive", duration: 3000 });
    }
    dragQuestRef.current = null;
  };

  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-muted-foreground">
        {data.weekStart} — {data.weekEnd}
        <span className="ml-2 text-xs opacity-60">• Drag quests to reschedule</span>
      </div>
      <div className="grid grid-cols-7 gap-2">
        {data.days.map((day: WeeklyPlannerDay) => {
          const isToday = day.date === today;
          const isPast = day.date < today;
          return (
            <div
              key={day.date}
              className={`rounded-xl border p-2 min-h-[120px] transition-colors ${
                isToday
                  ? "border-primary/50 bg-primary/5"
                  : "border-white/10 bg-white/3 hover:bg-white/5"
              }`}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => handleDrop(day.date)}
            >
              <div className={`text-center mb-2 ${isToday ? "text-primary font-bold" : isPast ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                <div className="text-xs uppercase tracking-wider">{day.dayName}</div>
                <div className={`text-lg font-stat ${isToday ? "text-primary" : ""}`}>
                  {new Date(day.date + "T00:00:00").getDate()}
                </div>
                {day.completedCount > 0 && (
                  <div className="text-xs text-green-400">✓{day.completedCount}</div>
                )}
              </div>
              <div className="space-y-1">
                {day.quests.slice(0, 5).map((q: Quest) => {
                  const recLabel = getRecurrenceLabel(q);
                  const isCompleted = q.status === "completed";
                  return (
                    <div
                      key={q.id}
                      draggable={!isCompleted && !!q.deadline}
                      onDragStart={() => handleDragStart(q.id, day.date)}
                      className={`text-xs rounded px-1.5 py-1 truncate border cursor-grab active:cursor-grabbing select-none ${
                        isCompleted
                          ? "opacity-40 bg-white/3 border-white/5 line-through"
                          : `${DIFFICULTY_BG[q.difficulty]} border-white/10`
                      }`}
                      title={q.name}
                    >
                      <span className={`font-bold mr-1 ${DIFFICULTY_COLORS[q.difficulty]}`}>{q.difficulty}</span>
                      {q.name}
                      {recLabel && <span className="ml-1 opacity-60">↻</span>}
                    </div>
                  );
                })}
                {day.quests.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center">+{day.quests.length - 5} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground justify-center">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-blue-500/30 border border-blue-500/30" /> Active</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded bg-green-500/20 border border-green-500/20" /> Completed</span>
        <span className="flex items-center gap-1.5">↻ Recurring</span>
      </div>
    </div>
  );
}

function MonthlyView() {
  const { data, isLoading } = useGetPlannerMonthly();
  const [selectedDay, setSelectedDay] = useState<MonthlyPlannerDay | null>(null);

  if (isLoading) return <ViewSkeleton />;
  if (!data) return null;

  const firstDay = new Date(`${data.year}-${String(data.month).padStart(2, "0")}-01`).getDay();
  const emptyLeadingCells = firstDay;

  return (
    <div className="space-y-4">
      <h2 className="text-center font-display text-xl font-bold tracking-wider text-white">
        {data.monthName} {data.year}
      </h2>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1 uppercase tracking-wider font-semibold">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: emptyLeadingCells }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {data.days.map((day: MonthlyPlannerDay) => {
          const isToday = day.date === data.today;
          const isPast = day.date < data.today;
          const hasActivity = day.completedCount > 0 || day.failedCount > 0;
          const hasMilestones = day.milestones.length > 0;
          const dayNum = new Date(day.date + "T00:00:00").getDate();

          return (
            <button
              key={day.date}
              onClick={() => setSelectedDay(selectedDay?.date === day.date ? null : day)}
              className={`relative rounded-lg p-1.5 text-center transition-all border text-xs h-14 flex flex-col items-center justify-start ${
                isToday
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : selectedDay?.date === day.date
                  ? "border-white/40 bg-white/10 text-white"
                  : isPast
                  ? "border-white/5 bg-transparent text-muted-foreground/50 hover:bg-white/5"
                  : "border-white/10 bg-white/3 text-muted-foreground hover:bg-white/8"
              }`}
            >
              <span className={`font-semibold ${isToday ? "text-primary" : ""}`}>{dayNum}</span>
              <div className="flex items-center gap-0.5 mt-auto flex-wrap justify-center">
                {day.completedCount > 0 && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" title={`${day.completedCount} completed`} />
                )}
                {day.failedCount > 0 && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" title={`${day.failedCount} failed`} />
                )}
                {hasMilestones && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" title="Milestone deadline" />
                )}
                {day.upcomingQuests.length > 0 && !hasActivity && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400/60" title="Quests due" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="bg-background/60 border-white/20 mt-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{new Date(selectedDay.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
                  <div className="flex gap-2 text-xs font-normal">
                    {selectedDay.completedCount > 0 && (
                      <span className="text-green-400">✓ {selectedDay.completedCount} completed</span>
                    )}
                    {selectedDay.failedCount > 0 && (
                      <span className="text-red-400">✗ {selectedDay.failedCount} failed</span>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedDay.milestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                    <Star className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Deadline: {m.name}</span>
                  </div>
                ))}
                {selectedDay.upcomingQuests.map((q) => (
                  <QuestCard key={q.id} quest={q} compact />
                ))}
                {selectedDay.milestones.length === 0 && selectedDay.upcomingQuests.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No quests scheduled for this day.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center mt-2">
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-green-400" /> Completed</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-red-400" /> Failed</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Deadline</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-blue-400/60" /> Scheduled</span>
      </div>
    </div>
  );
}

const HEATMAP_COLORS = [
  "bg-white/5 border-white/5",
  "bg-primary/20 border-primary/20",
  "bg-primary/40 border-primary/40",
  "bg-primary/60 border-primary/60",
  "bg-primary border-primary/80",
];

function YearlyView() {
  const { data, isLoading } = useGetPlannerYearly();

  if (isLoading) return <ViewSkeleton />;
  if (!data) return null;

  const weeks: YearlyHeatmapDay[][] = [];
  let currentWeek: YearlyHeatmapDay[] = [];

  const firstDayOfYear = new Date(data.year, 0, 1).getDay();
  for (let i = 0; i < firstDayOfYear; i++) {
    currentWeek.push({ date: "", completedCount: 0, failedCount: 0, xpGained: 0, level: -1 });
  }

  for (const day of data.heatmapDays) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push({ date: "", completedCount: 0, failedCount: 0, xpGained: 0, level: -1 });
    }
    weeks.push(currentWeek);
  }

  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const monthPositions: { month: string; col: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    for (const day of weeks[w]) {
      if (day.date) {
        const m = new Date(day.date + "T00:00:00").getMonth();
        if (m !== lastMonth) {
          monthPositions.push({ month: MONTH_NAMES[m], col: w });
          lastMonth = m;
        }
      }
    }
  }

  const totalCompleted = data.heatmapDays.reduce((s, d) => s + d.completedCount, 0);
  const totalXp = data.heatmapDays.reduce((s, d) => s + d.xpGained, 0);
  const activeDays = data.heatmapDays.filter((d) => d.completedCount > 0).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-background/50 border-white/10 text-center p-4">
          <div className="text-2xl font-stat font-bold text-white">{totalCompleted}</div>
          <div className="text-xs text-muted-foreground">Quests Completed</div>
        </Card>
        <Card className="bg-background/50 border-white/10 text-center p-4">
          <div className="text-2xl font-stat font-bold text-yellow-400">{totalXp.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">XP Earned</div>
        </Card>
        <Card className="bg-background/50 border-white/10 text-center p-4">
          <div className="text-2xl font-stat font-bold text-primary">{activeDays}</div>
          <div className="text-xs text-muted-foreground">Active Days</div>
        </Card>
      </div>

      <Card className="bg-background/50 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" />
            Activity Heatmap — {data.year}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="relative min-w-[700px]">
            <div className="flex gap-0.5 mb-1 text-xs text-muted-foreground/60">
              {monthPositions.map((mp, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{ left: `${mp.col * 14}px` }}
                >
                  {mp.month}
                </div>
              ))}
            </div>
            <div className="flex gap-0.5 mt-5">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day, di) => {
                    if (!day.date || day.level < 0) {
                      return <div key={di} className="w-3 h-3 rounded-sm" />;
                    }
                    const isToday = day.date === data.today;
                    return (
                      <Tooltip key={di}>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-3 h-3 rounded-sm border cursor-default transition-transform hover:scale-125 ${
                              isToday ? "ring-1 ring-white/60" : ""
                            } ${HEATMAP_COLORS[day.level] ?? HEATMAP_COLORS[0]}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <div className="font-semibold">{day.date}</div>
                          <div>{day.completedCount} completed · {day.xpGained} XP</div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
            <span>Less</span>
            {HEATMAP_COLORS.map((c, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm border ${c}`} />
            ))}
            <span>More</span>
          </div>
        </CardContent>
      </Card>

      {data.keyEvents.length > 0 && (
        <Card className="bg-background/50 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" />
              Key Events — {data.year}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {data.keyEvents.map((event: YearlyKeyEvent, i: number) => (
              <div
                key={i}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 border text-sm ${
                  event.type === "boss_defeated"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                    : event.type === "high_xp_day"
                    ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-300"
                    : "bg-primary/10 border-primary/30 text-primary"
                }`}
              >
                {event.type === "boss_defeated" ? (
                  <Skull className="h-4 w-4 flex-shrink-0" />
                ) : event.type === "high_xp_day" ? (
                  <Zap className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <Flame className="h-4 w-4 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <span className="font-medium">{event.label}</span>
                </div>
                <span className="text-xs opacity-70 flex-shrink-0">{event.date}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ViewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 rounded-xl bg-white/5" />
      <div className="h-48 rounded-xl bg-white/5" />
      <div className="h-24 rounded-xl bg-white/5" />
    </div>
  );
}

const VIEW_TABS: { key: PlannerView; label: string; icon: typeof Calendar }[] = [
  { key: "daily", label: "Daily", icon: Calendar },
  { key: "weekly", label: "Weekly", icon: CalendarDays },
  { key: "monthly", label: "Monthly", icon: LayoutGrid },
  { key: "yearly", label: "Yearly", icon: TrendingUp },
];

export default function Planner() {
  const [activeView, setActiveView] = useState<PlannerView>("daily");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 border border-primary/50">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-widest text-white">PLANNER</h1>
          <p className="text-xs text-muted-foreground tracking-wider">Your mission control</p>
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-white/5 border border-white/10 p-1">
        {VIEW_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveView(key)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
              activeView === key
                ? "bg-primary/20 text-primary border border-primary/40 shadow-[inset_0_0_10px_rgba(124,58,237,0.1)]"
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeView === "daily" && <DailyView />}
          {activeView === "weekly" && <WeeklyView />}
          {activeView === "monthly" && <MonthlyView />}
          {activeView === "yearly" && <YearlyView />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
