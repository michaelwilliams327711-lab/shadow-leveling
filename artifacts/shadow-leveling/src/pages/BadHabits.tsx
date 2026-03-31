import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Plus, Trash2, Flame, Trophy, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
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
  useLogRelapse,
  useGetCorruptionConfig,
  getListBadHabitsQueryKey,
  getGetCharacterQueryKey,
  type BadHabit,
  type CorruptionConfig,
} from "@workspace/api-client-react";
import { InfoTooltip } from "@/components/InfoTooltip";

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

function ConfirmRelapseDialog({
  habit,
  onConfirm,
  isPending,
  config,
}: {
  habit: BadHabit;
  onConfirm: () => void;
  isPending: boolean;
  config: CorruptionConfig | undefined;
}) {
  const [open, setOpen] = useState(false);
  const cfg = SEVERITY_CONFIG[habit.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.Medium;

  const sev = habit.severity as keyof CorruptionConfig["corruptionDelta"];
  const corruptionPenalty = config?.corruptionDelta[sev] ?? { Low: 5, Medium: 15, High: 30 }[sev] ?? 15;
  const xpPenalty = config?.xpPenalty[sev] ?? { Low: 20, Medium: 50, High: 100 }[sev] ?? 50;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`border ${cfg.border} ${cfg.color} hover:bg-red-500/10 text-xs font-bold tracking-widest`}
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          LOG RELAPSE
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel border border-red-500/40 max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-red-400 tracking-widest text-lg">
            RELAPSE CONFIRMATION
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            You are about to log a relapse for:
          </p>
          <div className={`rounded-lg border px-4 py-3 ${cfg.border} ${cfg.bg}`}>
            <p className={`font-bold text-base ${cfg.color}`}>{habit.name}</p>
            <p className="text-xs text-muted-foreground">{habit.category} · {habit.severity} severity</p>
          </div>
          <div className="rounded-lg border border-red-900/40 bg-red-950/30 px-4 py-3 space-y-1">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Consequences</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Corruption +</span>
              <span className="font-bold text-red-400">+{corruptionPenalty}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">XP Penalty</span>
              <span className="font-bold text-red-400">-{xpPenalty} XP</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Clean Streak</span>
              <span className="font-bold text-red-400">RESET</span>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              className="flex-1 border border-white/10 text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold tracking-widest"
              disabled={isPending}
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              {isPending ? "Logging..." : "CONFIRM RELAPSE"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const { data: habits, isLoading } = useListBadHabits();
  const { data: corruptionConfig } = useGetCorruptionConfig();
  const deleteMutation = useDeleteBadHabit();
  const relapseMutation = useLogRelapse();
  const purificationDays = corruptionConfig?.purificationStreakDays ?? 3;

  const activeHabits = habits?.filter((h) => h.isActive === 1) ?? [];
  const inactiveHabits = habits?.filter((h) => h.isActive === 0) ?? [];

  const handleCreated = () => {
    queryClient.invalidateQueries({ queryKey: getListBadHabitsQueryKey() });
  };

  const handleRelapse = (habit: BadHabit) => {
    relapseMutation.mutate(
      { id: habit.id },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListBadHabitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
          toast({
            title: "RELAPSE LOGGED",
            description: `Corruption +${res.corruptionDelta} | XP -${res.xpPenalty} | New Corruption: ${res.newCorruption}/100`,
            className: "border-red-700 bg-red-950/80 text-red-200",
          });
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to log relapse.", variant: "destructive" });
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
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500" />
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

                return (
                  <motion.div
                    key={habit.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card
                      className={`glass-panel border ${cfg.border} relative overflow-hidden`}
                      style={{ boxShadow: habit.severity === "High" ? "0 0 20px rgba(239,68,68,0.1)" : undefined }}
                    >
                      <div className={`absolute top-0 left-0 w-1 h-full ${cfg.bg}`} style={{ background: habit.severity === "High" ? "rgba(239,68,68,0.5)" : habit.severity === "Medium" ? "rgba(249,115,22,0.5)" : "rgba(234,179,8,0.5)" }} />
                      <CardContent className="p-5 pl-6">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg select-none">{cfg.icon}</span>
                              <h3 className={`font-bold text-lg leading-tight truncate ${cfg.color}`}>{habit.name}</h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-xs ${cfg.border} ${cfg.color} bg-transparent`}>
                                {habit.severity}
                              </Badge>
                              <span className="text-xs text-muted-foreground">{habit.category}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 shrink-0"
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
                              className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ${habit.cleanStreak >= purificationDays ? "bg-green-400" : "bg-purple-500"}`}
                              style={{ width: `${streakPercent}%` }}
                            />
                          </div>
                        </div>

                        <ConfirmRelapseDialog
                          habit={habit}
                          onConfirm={() => handleRelapse(habit)}
                          isPending={relapseMutation.isPending}
                          config={corruptionConfig}
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
                      className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
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
