import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Plus, Trash2, Flame, Trophy, AlertTriangle, CheckCircle2, XCircle, Shield, Zap, Skull, Wrench, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  useListBadHabits,
  useCreateBadHabit,
  useDeleteBadHabit,
  useGetCorruptionConfig,
  getListBadHabitsQueryKey,
  getGetCharacterQueryKey,
  customFetch,
  type BadHabit,
  type CorruptionConfig,
} from "@workspace/api-client-react";

type FractureResolution = "RESILIENT" | "STAGGERED" | "COLLAPSED";

interface FractureBadHabit extends BadHabit {
  isFractured?: boolean;
  lapseMultiplier?: number;
  totalExposures?: number;
  resilientCount?: number;
}

interface ResolutionResult {
  success: boolean;
  resolution: FractureResolution;
  xpDelta: number;
  goldLoss: number;
  discLoss: number;
  corruptionDelta: number;
  newCorruption: number;
  newGold: number;
  newDiscipline: number;
  lapseMultiplier: number;
  isFractured: boolean;
}

interface RepairResult {
  success: boolean;
  didRepair: boolean;
  cost: number;
  newGold: number;
}

import { InfoTooltip } from "@/components/InfoTooltip";
import { triggerShatter } from "@/lib/audio";
import { triggerHapticThud, triggerHapticTick } from "@/lib/haptics";

const REPAIR_COST = 250;

const SEVERITY_CONFIG = {
  Low: { color: "text-amber-500", border: "border-amber-600/40", bg: "bg-amber-600/10", label: "Low", icon: "⚠️" },
  Medium: { color: "text-orange-400", border: "border-orange-500/40", bg: "bg-orange-500/10", label: "Medium", icon: "🔥" },
  High: { color: "text-red-400", border: "border-red-500/50", bg: "bg-red-500/15", label: "High", icon: "☠️" },
} as const;

const BAD_HABIT_CATEGORIES = [
  "Addiction",
  "Social",
  "Health",
  "Productivity",
  "Financial",
  "Other",
];

const createHabitSchema = z.object({
  name: z.string().min(1, "Name required").max(120),
  category: z.string().min(1, "Category required"),
  severity: z.enum(["Low", "Medium", "High"]),
});

type CreateHabitFormValues = z.infer<typeof createHabitSchema>;

function ConsistencyTracker({
  totalExposures,
  resilientCount,
}: {
  totalExposures: number;
  resilientCount: number;
}) {
  const winRate =
    totalExposures > 0 ? Math.round((resilientCount / totalExposures) * 100) : 0;
  const hasData = totalExposures > 0;

  const tierColor =
    !hasData
      ? "text-muted-foreground"
      : winRate >= 80
      ? "text-blue-300"
      : winRate >= 50
      ? "text-amber-300"
      : "text-red-300";
  const barColor =
    !hasData
      ? "bg-white/10"
      : winRate >= 80
      ? "bg-blue-400"
      : winRate >= 50
      ? "bg-amber-400"
      : "bg-red-500";

  return (
    <div className="mb-4 rounded-md bg-white/3 border border-white/5 px-3 py-2">
      <div className="flex justify-between items-center text-xs mb-1">
        <span className="text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-purple-400" />
          Consistency
        </span>
        <span className={`font-stat font-bold ${tierColor}`}>
          {hasData
            ? `Win Rate: ${winRate}% (${resilientCount}/${totalExposures} Exposures)`
            : "No exposures logged"}
        </span>
      </div>
      <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${hasData ? winRate : 0}%` }}
        />
      </div>
    </div>
  );
}

function FractureControls({
  habit,
  onResolve,
  onRepair,
  isResolving,
  isRepairing,
  pendingResolution,
  characterGold,
}: {
  habit: FractureBadHabit;
  onResolve: (resolution: FractureResolution) => void;
  onRepair: () => void;
  isResolving: boolean;
  isRepairing: boolean;
  pendingResolution: FractureResolution | null;
  characterGold: number;
}) {
  const lapseMultiplier = habit.lapseMultiplier ?? 1;
  const isFractured = habit.isFractured ?? false;
  const goldLoss = 50 * lapseMultiplier;
  const discLoss = 1 * lapseMultiplier;
  const canAffordRepair = characterGold >= REPAIR_COST;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Button
          size="sm"
          disabled={isResolving}
          onClick={() => onResolve("RESILIENT")}
          className="h-auto py-2 px-2 flex-col gap-0.5 bg-blue-700/30 hover:bg-blue-600/50 border border-blue-500/50 text-blue-200 font-bold tracking-widest text-[10px] disabled:opacity-50"
          title="Faced the trigger and won. +25 XP."
        >
          <Shield className="w-4 h-4 mb-0.5" />
          <span>RESILIENT</span>
          <span className="text-[9px] text-blue-300/80 font-stat">+25 XP</span>
          {pendingResolution === "RESILIENT" && isResolving && (
            <span className="text-[9px] text-blue-200">…</span>
          )}
        </Button>

        <Button
          size="sm"
          disabled={isResolving}
          onClick={() => onResolve("STAGGERED")}
          className="h-auto py-2 px-2 flex-col gap-0.5 bg-orange-700/30 hover:bg-orange-600/50 border border-orange-500/50 text-orange-200 font-bold tracking-widest text-[10px] disabled:opacity-50"
          title={`Slipped but contained. -${goldLoss}G / -${discLoss} DISC. Multiplier x3.`}
        >
          <Zap className="w-4 h-4 mb-0.5" />
          <span>STAGGERED</span>
          <span className="text-[9px] text-orange-300/80 font-stat">-{goldLoss}G ·-{discLoss}D</span>
          {pendingResolution === "STAGGERED" && isResolving && (
            <span className="text-[9px] text-orange-200">…</span>
          )}
        </Button>

        <Button
          size="sm"
          disabled={isResolving}
          onClick={() => onResolve("COLLAPSED")}
          className="h-auto py-2 px-2 flex-col gap-0.5 bg-red-700/40 hover:bg-red-600/60 border border-red-500/60 text-red-100 font-bold tracking-widest text-[10px] disabled:opacity-50"
          title={`Total relapse. Streak shattered. -${goldLoss}G / -${discLoss} DISC. Multiplier x3.`}
        >
          <Skull className="w-4 h-4 mb-0.5" />
          <span>COLLAPSED</span>
          <span className="text-[9px] text-red-300/80 font-stat">-{goldLoss}G ·STRK</span>
          {pendingResolution === "COLLAPSED" && isResolving && (
            <span className="text-[9px] text-red-200">…</span>
          )}
        </Button>
      </div>

      {isFractured && (
        <Button
          size="sm"
          disabled={isRepairing || !canAffordRepair}
          onClick={onRepair}
          className="w-full h-9 bg-yellow-700/40 hover:bg-yellow-600/60 border border-yellow-500/60 text-yellow-100 font-bold tracking-widest text-xs disabled:opacity-50"
          title={canAffordRepair ? `Reset multiplier to x1. Costs ${REPAIR_COST}G.` : `Need ${REPAIR_COST}G to repair.`}
        >
          <Wrench className="w-3.5 h-3.5 mr-2" />
          {isRepairing ? "REPAIRING…" : `REPAIR ARMOR (${REPAIR_COST}G)`}
        </Button>
      )}
    </div>
  );
}

function CreateHabitDialog({ onCreated, config }: { onCreated: () => void; config: CorruptionConfig | undefined }) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateBadHabit();

  const form = useForm<CreateHabitFormValues>({
    resolver: zodResolver(createHabitSchema),
    defaultValues: { name: "", category: "Other", severity: "Medium" },
  });

  const onSubmit = (values: CreateHabitFormValues) => {
    createMutation.mutate(
      { data: { name: values.name, category: values.category, severity: values.severity } },
      {
        onSuccess: () => {
          setOpen(false);
          form.reset();
          onCreated();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-purple-700/80 hover:bg-purple-600 border border-purple-500/50 text-white font-bold tracking-widest shadow-[0_0_15px_rgba(168,85,247,0.3)]"
        >
          <Plus className="w-4 h-4 mr-2" />
          REGISTER BAD HABIT
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border border-purple-500/40 max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-purple-400 tracking-widest">
            REGISTER BAD HABIT
          </DialogTitle>
          <DialogDescription className="sr-only">Register a new bad habit to track</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Habit Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g. Smoking, Doomscrolling..."
                      className="bg-background/60 border-purple-500/30 focus:border-purple-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background/60 border-purple-500/30 focus:border-purple-500">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {BAD_HABIT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground">Severity</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-background/60 border-purple-500/30 focus:border-purple-500">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Low">Low (+{config?.corruptionDelta.Low ?? 5} Corruption, -{config?.xpPenalty.Low ?? 20} XP)</SelectItem>
                      <SelectItem value="Medium">Medium (+{config?.corruptionDelta.Medium ?? 15} Corruption, -{config?.xpPenalty.Medium ?? 50} XP)</SelectItem>
                      <SelectItem value="High">High (+{config?.corruptionDelta.High ?? 30} Corruption, -{config?.xpPenalty.High ?? 100} XP)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full bg-purple-700 hover:bg-purple-600 text-white font-bold tracking-widest"
            >
              {createMutation.isPending ? "Registering..." : "REGISTER"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function BadHabits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: rawHabits, isLoading } = useListBadHabits();
  const habits = rawHabits as FractureBadHabit[] | undefined;
  const { data: corruptionConfig } = useGetCorruptionConfig();
  const deleteMutation = useDeleteBadHabit();
  const purificationDays = corruptionConfig?.purificationStreakDays ?? 3;

  const character = queryClient.getQueryData<{ gold: number }>(getGetCharacterQueryKey());
  const characterGold = character?.gold ?? 0;

  const [pendingHabitId, setPendingHabitId] = useState<string | null>(null);
  const [pendingResolution, setPendingResolution] = useState<FractureResolution | null>(null);
  const [repairingHabitId, setRepairingHabitId] = useState<string | null>(null);

  const resolveMutation = useMutation<
    ResolutionResult,
    Error,
    { habitId: string; resolution: FractureResolution }
  >({
    mutationFn: ({ habitId, resolution }) =>
      customFetch<ResolutionResult>(`/api/bad-habits/${habitId}/relapse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution }),
      }),
  });

  const repairMutation = useMutation<RepairResult, Error, { habitId: string }>({
    mutationFn: ({ habitId }) =>
      customFetch<RepairResult>(`/api/bad-habits/${habitId}/repair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
  });

  const activeHabits = habits?.filter((h) => h.isActive === 1) ?? [];
  const inactiveHabits = habits?.filter((h) => h.isActive === 0) ?? [];

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: getListBadHabitsQueryKey() });
  };

  const handleResolve = (habit: FractureBadHabit, resolution: FractureResolution) => {
    setPendingHabitId(habit.id);
    setPendingResolution(resolution);
    resolveMutation.mutate(
      { habitId: habit.id, resolution },
      {
        onSuccess: (res) => {
          // Optimistic character cache write — push the authoritative server
          // snapshot straight into the cache so the global Status panel
          // (Gold, XP, Discipline, Corruption, Level) repaints THIS frame
          // instead of waiting for the refetch round-trip.
          queryClient.setQueryData(
            getGetCharacterQueryKey(),
            (old: Record<string, unknown> | undefined) =>
              old
                ? {
                    ...old,
                    gold: res.newGold,
                    corruption: res.newCorruption,
                    discipline: res.newDiscipline,
                    level: res.newLevel,
                    xp: res.newXp,
                  }
                : old,
          );
          queryClient.invalidateQueries({ queryKey: getListBadHabitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });

          // Sensory ritual — shatter + haptic thud fire together so a streak
          // collapse (or a fresh fracture transition) is felt and heard at once.
          //   1. STAGGERED that flips isFractured from false -> true
          //   2. COLLAPSED — always (a streak shatter is, by definition, a shatter)
          const wasFractured = habit.isFractured ?? false;
          const isNowFractured = res.isFractured;
          const fractureTransition =
            resolution === "STAGGERED" && !wasFractured && isNowFractured;
          const isCollapsed = resolution === "COLLAPSED";
          if (fractureTransition || isCollapsed) {
            triggerShatter();
            triggerHapticThud();
          }

          // Haptic sync — RESILIENT awards XP. The optimistic setQueryData
          // above triggers the XP bar surge animation on the same frame,
          // so the tick lands in lockstep with the bar's "surge & settle".
          if (resolution === "RESILIENT") {
            triggerHapticTick();
          }

          if (resolution === "RESILIENT") {
            toast({
              title: "RESILIENT — TRIGGER OVERCOME",
              description: `+${res.xpDelta} XP. The shadow weakens.`,
              className: "border-blue-700 bg-blue-950/80 text-blue-200",
            });
          } else if (resolution === "STAGGERED") {
            toast({
              title: "STAGGERED — ARMOR FRACTURED",
              description: `-${res.goldLoss}G · -${res.discLoss} DISC · Multiplier now x${res.lapseMultiplier}.`,
              className: "border-orange-700 bg-orange-950/80 text-orange-200",
            });
          } else {
            toast({
              title: "COLLAPSED — STREAK SHATTERED",
              description: `-${res.goldLoss}G · -${res.discLoss} DISC · Streak reset · Multiplier now x${res.lapseMultiplier}.`,
              className: "border-red-700 bg-red-950/80 text-red-200",
            });
          }
        },
        onError: (err) => {
          toast({ title: "Error", description: err.message || "Failed to log resolution.", variant: "destructive" });
        },
        onSettled: () => {
          setPendingHabitId(null);
          setPendingResolution(null);
        },
      }
    );
  };

  const handleRepair = (habit: FractureBadHabit) => {
    setRepairingHabitId(habit.id);
    repairMutation.mutate(
      { habitId: habit.id },
      {
        onSuccess: (res) => {
          // Optimistic character cache write — mirror the relapse path so
          // the Gold counter drops the instant the response lands instead of
          // waiting for the refetch round-trip. /repair now returns a full
          // character snapshot (newGold/newCorruption/newDiscipline/newLevel/
          // newXp); only gold actually mutates server-side, but we splat the
          // whole snapshot to keep cache identical to the authoritative row.
          queryClient.setQueryData(
            getGetCharacterQueryKey(),
            (old: Record<string, unknown> | undefined) =>
              old
                ? {
                    ...old,
                    gold: res.newGold,
                    corruption: res.newCorruption,
                    discipline: res.newDiscipline,
                    level: res.newLevel,
                    xp: res.newXp,
                  }
                : old,
          );
          queryClient.invalidateQueries({ queryKey: getListBadHabitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
          toast({
            title: "ARMOR REPAIRED",
            description: `-${res.cost}G. Multiplier reset to x1.`,
            className: "border-yellow-600 bg-yellow-950/80 text-yellow-100",
          });
        },
        onError: (err) => {
          toast({ title: "Repair Failed", description: err.message || "Could not repair armor.", variant: "destructive" });
        },
        onSettled: () => {
          setRepairingHabitId(null);
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBadHabitsQueryKey() });
          toast({ title: "Habit removed.", description: "Bad habit deleted from the system." });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div className="space-y-2">
            <Skeleton className="h-12 w-52 rounded-xl" />
            <Skeleton className="h-4 w-64 rounded" />
          </div>
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="glass-panel rounded-2xl border border-white/10 p-5 space-y-4">
              <div className="flex justify-between items-start">
                <Skeleton className="h-6 w-40 rounded" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
              <div className="flex gap-3 pt-2">
                <Skeleton className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <InfoTooltip
              variant="shadow"
              what="Bad Habits — track and break your self-destructive patterns."
              fn="Each registered bad habit gains a Corruption score when you relapse. Corruption visually degrades your status window and acts as a dark mirror of your progress."
              usage={`Register habits you want to eliminate. Log relapses honestly. When ALL active habits maintain a ${purificationDays}-day clean streak simultaneously, your Corruption resets to 0 (Purification).`}
            >
              <h1
                className="text-4xl md:text-5xl font-display font-bold tracking-tight mb-1"
                style={{ color: "#a855f7", textShadow: "0 0 30px rgba(168,85,247,0.4)" }}
              >
                BAD HABITS
              </h1>
            </InfoTooltip>
            <p className="text-muted-foreground text-lg tracking-widest uppercase">
              <ShieldAlert className="inline w-4 h-4 mr-2 text-purple-500" />
              Corruption Control — Break the Cycle
            </p>
          </div>
          <CreateHabitDialog onCreated={handleCreated} config={corruptionConfig} />
        </div>
      </motion.div>

      {activeHabits.length === 0 && inactiveHabits.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="glass-panel border border-purple-500/20">
            <CardContent className="p-12 text-center">
              <ShieldAlert className="w-12 h-12 text-purple-500/40 mx-auto mb-4" />
              <p className="text-muted-foreground text-lg">No bad habits registered.</p>
              <p className="text-muted-foreground text-sm mt-1">Add a habit to begin tracking your Corruption.</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {activeHabits.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-purple-400/70">Active Habits</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {activeHabits.map((habit, i) => {
                const cfg = SEVERITY_CONFIG[habit.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.Medium;
                const streakPercent = Math.min(100, (habit.cleanStreak / purificationDays) * 100);
                const isFractured = habit.isFractured ?? false;
                const lapseMultiplier = habit.lapseMultiplier ?? 1;
                const isThisHabitResolving = pendingHabitId === habit.id && resolveMutation.isPending;
                const isThisHabitRepairing = repairingHabitId === habit.id && repairMutation.isPending;

                const totalExposures = habit.totalExposures ?? 0;
                const resilientCount = habit.resilientCount ?? 0;
                const winRate =
                  totalExposures > 0
                    ? Math.round((resilientCount / totalExposures) * 100)
                    : null;
                // Strict tier boundaries (per Sovereign spec):
                //   S-RANK  (Blue):  winRate >= 80 AND !isFractured
                //   MID-TIER (Amber): winRate >= 50 && winRate < 80 AND !isFractured
                //   CRITICAL (Red):  winRate < 50 OR isFractured
                //   null:            no exposures logged AND not fractured
                const effectiveTier: "blue" | "amber" | "red" | null =
                  isFractured
                    ? "red"
                    : winRate === null
                    ? null
                    : winRate >= 80
                    ? "blue"
                    : winRate >= 50
                    ? "amber"
                    : "red";

                const TIER_THEME = {
                  blue: {
                    text: "text-blue-300",
                    iconStroke: "rgb(96,165,250)",
                    stripe: "rgba(96,165,250,0.85)",
                    border: "border-blue-500",
                    glowLow: "rgba(96,165,250,0.30)",
                    glowHigh: "rgba(96,165,250,0.65)",
                    borderLow: "rgba(96,165,250,0.55)",
                    borderHigh: "rgba(147,197,253,1)",
                  },
                  amber: {
                    text: "text-amber-300",
                    iconStroke: "rgb(251,191,36)",
                    stripe: "rgba(251,191,36,0.85)",
                    border: "border-amber-500",
                    glowLow: "rgba(251,191,36,0.30)",
                    glowHigh: "rgba(251,191,36,0.65)",
                    borderLow: "rgba(251,191,36,0.55)",
                    borderHigh: "rgba(252,211,77,1)",
                  },
                  red: {
                    text: "text-red-300",
                    iconStroke: "rgb(239,68,68)",
                    stripe: "rgba(239,68,68,0.85)",
                    border: "border-red-500",
                    glowLow: "rgba(239,68,68,0.35)",
                    glowHigh: "rgba(239,68,68,0.65)",
                    borderLow: "rgba(239,68,68,0.55)",
                    borderHigh: "rgba(248,113,113,1)",
                  },
                } as const;

                const tierTheme = effectiveTier ? TIER_THEME[effectiveTier] : null;

                const nameColorClass = tierTheme?.text ?? cfg.color;
                const stripeBg =
                  tierTheme?.stripe ??
                  (habit.severity === "High"
                    ? "rgba(239,68,68,0.5)"
                    : habit.severity === "Medium"
                    ? "rgba(249,115,22,0.5)"
                    : "rgba(234,179,8,0.5)");
                const borderClass =
                  tierTheme?.border ?? cfg.border;

                // Animation:
                //   - With a tier color: tier-pulse (or tier-pulse-emergency when fractured)
                //   - No tier and not fractured: no animation
                //   - Fractured but no tier vars: fall back to legacy fractured-armor red pulse
                const animationClass = tierTheme
                  ? isFractured
                    ? "tier-pulse-emergency"
                    : "tier-pulse"
                  : isFractured
                  ? "fractured-armor"
                  : "";

                const cardStyle: React.CSSProperties & Record<string, string | undefined> = {
                  transition:
                    "color 0.7s ease, border-color 0.7s ease, box-shadow 0.7s ease, background-color 0.7s ease",
                };
                if (tierTheme) {
                  cardStyle["--tier-glow-low"] = tierTheme.glowLow;
                  cardStyle["--tier-glow-high"] = tierTheme.glowHigh;
                  cardStyle["--tier-border-low"] = tierTheme.borderLow;
                  cardStyle["--tier-border-high"] = tierTheme.borderHigh;
                }
                if (!animationClass && habit.severity === "High") {
                  cardStyle.boxShadow = "0 0 20px rgba(239,68,68,0.1)";
                }

                return (
                  <motion.div
                    key={habit.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card
                      className={`glass-panel relative overflow-hidden border transition-all duration-700 ${animationClass} ${borderClass}`}
                      style={cardStyle}
                    >
                      <div
                        className="absolute top-0 left-0 w-1 h-full transition-all duration-700"
                        style={{ background: stripeBg }}
                      />
                      <CardContent className="p-5 pl-6">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-lg select-none transition-all duration-700"
                                style={{
                                  color: tierTheme?.iconStroke,
                                  opacity: tierTheme ? 0.5 : 1,
                                }}
                              >
                                {cfg.icon}
                              </span>
                              <h3 className={`font-bold text-lg leading-tight truncate transition-colors duration-700 ${nameColorClass}`}>{habit.name}</h3>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={`text-xs ${cfg.border} ${cfg.color} bg-transparent`}>
                                {habit.severity}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{habit.category}</span>
                              {isFractured && (
                                <Badge
                                  className="text-[10px] tracking-widest border animate-pulse transition-colors duration-700"
                                  style={{
                                    color: tierTheme?.iconStroke,
                                    borderColor: tierTheme?.borderHigh,
                                    backgroundColor: tierTheme?.glowLow,
                                  }}
                                >
                                  FRACTURED · x{lapseMultiplier}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0"
                            onClick={() => handleDelete(habit.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="rounded-md bg-white/3 border border-white/5 px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Flame className="w-3.5 h-3.5 text-green-400" />
                              <span className="text-xs text-muted-foreground uppercase tracking-widest">Clean Streak</span>
                            </div>
                            <span className="text-xl font-stat font-bold text-green-400">{habit.cleanStreak}d</span>
                          </div>
                          <div className="rounded-md bg-white/3 border border-white/5 px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <Trophy className="w-3.5 h-3.5 text-violet-400" />
                              <span className="text-xs text-muted-foreground uppercase tracking-widest">Best</span>
                            </div>
                            <span className="text-xl font-stat font-bold text-violet-400">{habit.longestStreak}d</span>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Purification progress</span>
                            <span className={habit.cleanStreak >= purificationDays ? "text-green-400 font-bold" : "text-muted-foreground"}>
                              {habit.cleanStreak >= purificationDays ? "✓ CLEAN" : `${habit.cleanStreak}/${purificationDays} days`}
                            </span>
                          </div>
                          <div className="relative h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="absolute top-0 left-0 h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${streakPercent}%`,
                                backgroundColor:
                                  habit.cleanStreak >= purificationDays
                                    ? "rgb(74,222,128)"
                                    : tierTheme?.iconStroke ?? "rgb(168,85,247)",
                                boxShadow: tierTheme
                                  ? `0 0 8px ${tierTheme.glowHigh}`
                                  : undefined,
                              }}
                            />
                          </div>
                        </div>

                        <ConsistencyTracker
                          totalExposures={habit.totalExposures ?? 0}
                          resilientCount={habit.resilientCount ?? 0}
                        />

                        <FractureControls
                          habit={habit}
                          onResolve={(r) => handleResolve(habit, r)}
                          onRepair={() => handleRepair(habit)}
                          isResolving={isThisHabitResolving}
                          isRepairing={isThisHabitRepairing}
                          pendingResolution={isThisHabitResolving ? pendingResolution : null}
                          characterGold={characterGold}
                        />
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {inactiveHabits.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Inactive / Archived</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inactiveHabits.map((habit) => {
              const cfg = SEVERITY_CONFIG[habit.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.Medium;
              return (
                <Card key={habit.id} className="glass-panel border border-white/5 opacity-50">
                  <CardContent className="p-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-sm text-muted-foreground">{habit.name}</p>
                      <p className="text-xs text-muted-foreground">{habit.category} · {habit.severity}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => handleDelete(habit.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass-panel border border-purple-900/30">
          <CardHeader>
            <CardTitle className="font-display text-sm tracking-widest text-purple-400/70 uppercase flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Purification Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
              <span>All active bad habits must reach a <strong className="text-green-400">{purificationDays}-day clean streak simultaneously</strong> to trigger purification.</span>
            </div>
            <div className="flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <span>Any relapse resets that habit's streak to 0 and adds Corruption to your character.</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
              <span>Corruption above {corruptionConfig?.thresholds.low ?? 20} applies a red tint overlay to your status window. At {corruptionConfig?.thresholds.mid ?? 50}+, it pulses. At {corruptionConfig?.thresholds.high ?? 80}+, it glitches.</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
