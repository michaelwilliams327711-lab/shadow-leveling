import { useState, useEffect, useRef } from "react";
import { useForm, type Control, type UseFormWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useCompleteQuest,
  completeQuest,
  useFailQuest,
  failQuest,
  useCreateQuest,
  useUpdateQuest,
  useDeleteQuest,
  getGetCharacterQueryKey,
  QuestDifficulty,
  StatBoost,
  useListQuestsWindowed,
  getListQuestsWindowedQueryKey,
  useGetPlannerDaily,
  useGetPlannerWeekly,
  useGetPlannerMonthly,
  useGetPlannerYearly,
  useRescheduleQuest,
  getPlannerDailyQueryKey,
  getPlannerWeeklyQueryKey,
  getPlannerMonthlyQueryKey,
  getPlannerYearlyQueryKey,
  type WeeklyPlannerDay,
  type MonthlyPlannerDay,
  type YearlyHeatmapDay,
  type YearlyKeyEvent,
} from "@workspace/api-client-react";
import type { RecurrenceConfig } from "@workspace/api-client-react";
import { customFetch } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollText, Clock, Trophy, Plus, CheckCircle2, XCircle, Pencil, Trash2, Zap, Sparkles, Dumbbell, Shield, Brain, Target, ChevronsUpDown, Check, RotateCcw, Pause, Play, ChevronDown, CalendarIcon, type LucideIcon, Calendar, CalendarDays, LayoutGrid, TrendingUp, Sword, ChevronLeft, ChevronRight, Circle, AlertCircle, Skull, Star, Flame, BarChart2, Coins, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { XpGainToast } from "@/components/XpGainToast";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Quest } from "@workspace/api-client-react";
import { InfoTooltip } from "@/components/InfoTooltip";
import { ShadowIntel } from "@/components/ShadowIntel";
import { CATEGORY_STAT_MAP, STAT_META, RANK_BASE_REWARDS, DURATION_BONUS_PER_MINUTE } from "@workspace/shared";
import { SYSTEM_INTEL } from "@/lib/systemLore";
import { LevelUpCeremony } from "@/components/LevelUpCeremony";
import { AwakeningOverlay } from "@/components/AwakeningOverlay";
import { QuestCompleteEffect } from "@/components/QuestCompleteEffect";
import { RankUpNotification } from "@/components/RankUpNotification";
import { GateFragmentDropAnimation } from "@/components/GateFragmentDropAnimation";
import { playQuestComplete, playSystemWarning } from "@/lib/sounds";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

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
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { useMemo } from "react";

const QuestCategory = {
  Financial: "Financial",
  Productivity: "Productivity",
  Study: "Study",
  Health: "Health",
  Creative: "Creative",
  Social: "Social",
  Spirit: "Spirit",
  Other: "Other",
} as const;

const CATEGORY_PRESETS = Object.values(QuestCategory);


const STAT_ICONS: Record<string, LucideIcon> = {
  strength: Dumbbell, spirit: Sparkles, endurance: Shield, intellect: Brain, discipline: Target,
};
const STAT_TEXT_COLORS: Record<string, string> = {
  strength: "text-red-400", spirit: "text-pink-400", endurance: "text-green-400",
  intellect: "text-blue-400", discipline: "text-purple-400",
};
const STAT_DISPLAY: Record<string, { label: string; icon: LucideIcon; color: string }> = Object.fromEntries(
  Object.keys(STAT_META).map((key) => [
    key,
    { label: STAT_META[key as keyof typeof STAT_META].label, icon: STAT_ICONS[key], color: STAT_TEXT_COLORS[key] },
  ])
);

const DAYS_OF_WEEK = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function getEffectiveStat(category: string, statBoost?: string | null): string {
  if (statBoost) return statBoost;
  return CATEGORY_STAT_MAP[category] ?? "strength";
}

function StatBoostBadge({ category, statBoost }: { category: string; statBoost?: string | null }) {
  const stat = getEffectiveStat(category, statBoost);
  const { label, icon: StatIcon, color } = STAT_DISPLAY[stat] ?? STAT_DISPLAY["strength"];
  return (
    <div className="flex items-center gap-2 mt-1">
      <StatIcon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-xs text-muted-foreground">Stat Boost:</span>
      <span className={`text-xs font-bold tracking-wider ${color}`}>{label}</span>
      {statBoost && <span className="text-xs text-muted-foreground">(manual)</span>}
    </div>
  );
}

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
}

function CategoryCombobox({ value, onChange }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [localInput, setLocalInput] = useState<string | null>(null);

  const inputValue = useMemo(() => localInput ?? value, [localInput, value]);

  const handleSelect = (selected: string) => {
    onChange(selected);
    setLocalInput(null);
    setOpen(false);
  };

  const handleInputChange = (search: string) => {
    setLocalInput(search);
    onChange(search);
  };

  const filteredPresets = CATEGORY_PRESETS.filter((cat) =>
    cat.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-background/50 border-input font-normal h-9 px-3 text-sm"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || "Select or type category"}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a category..."
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandList>
            {filteredPresets.length === 0 && inputValue.trim() === "" && (
              <CommandEmpty>Type to create a custom category.</CommandEmpty>
            )}
            {filteredPresets.length === 0 && inputValue.trim() !== "" && (
              <CommandGroup>
                <CommandItem
                  value={inputValue}
                  onSelect={() => handleSelect(inputValue.trim())}
                >
                  <Check className={cn("mr-2 h-3.5 w-3.5", value === inputValue.trim() ? "opacity-100" : "opacity-0")} />
                  Use "{inputValue.trim()}"
                </CommandItem>
              </CommandGroup>
            )}
            {filteredPresets.length > 0 && (
              <CommandGroup heading="Presets">
                {filteredPresets.map((cat) => (
                  <CommandItem key={cat} value={cat} onSelect={() => handleSelect(cat)}>
                    <Check className={cn("mr-2 h-3.5 w-3.5", value === cat ? "opacity-100" : "opacity-0")} />
                    {cat}
                  </CommandItem>
                ))}
                {inputValue.trim() !== "" && !CATEGORY_PRESETS.includes(inputValue.trim() as typeof CATEGORY_PRESETS[number]) && (
                  <CommandItem
                    value={inputValue}
                    onSelect={() => handleSelect(inputValue.trim())}
                  >
                    <Check className={cn("mr-2 h-3.5 w-3.5 opacity-0")} />
                    Use "{inputValue.trim()}"
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const recurrenceSchema = z.object({
  type: z.enum(["none", "daily", "weekly", "monthly", "yearly"]).default("none"),
  intervalDays: z.coerce.number().int().min(1).optional(),
  daysOfWeek: z.array(z.number()).optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  day: z.coerce.number().int().min(1).max(31).optional(),
});

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  statBoost: z.nativeEnum(StatBoost).optional(),
  difficulty: z.nativeEnum(QuestDifficulty),
  durationMinutes: z.coerce.number().int().min(1),
  deadline: z.string().optional(),
  targetAmount: z.coerce.number().int().min(1).optional(),
  amountUnit: z.string().optional(),
  recurrence: recurrenceSchema.optional(),
});

const editSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().min(1).optional(),
  statBoost: z.nativeEnum(StatBoost).optional().nullable(),
  difficulty: z.nativeEnum(QuestDifficulty).optional(),
  durationMinutes: z.coerce.number().int().min(1).optional(),
  deadline: z.string().optional().nullable(),
  targetAmount: z.coerce.number().int().min(1).optional().nullable(),
  amountUnit: z.string().optional().nullable(),
  recurrence: recurrenceSchema.optional().nullable(),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;

const DATE_ONLY_DEADLINE_TIME = "23:59";

function getLocalDatePart(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalTimePart(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}`;
  return time === DATE_ONLY_DEADLINE_TIME ? "" : time;
}

function buildDeadlineIso(datePart: string, timePart: string): string | null {
  if (!datePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return null;
  const hasTime = !!timePart;
  const [hours, minutes] = (hasTime ? timePart : DATE_ONLY_DEADLINE_TIME).split(":").map(Number);
  const deadline = new Date(
    year,
    month - 1,
    day,
    hours ?? 23,
    minutes ?? 59,
    hasTime ? 0 : 59,
    hasTime ? 0 : 999,
  );
  return Number.isNaN(deadline.getTime()) ? null : deadline.toISOString();
}

function normalizeDeadlineIso(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hasSpecificDeadlineTime(date: Date): boolean {
  return !(date.getHours() === 23 && date.getMinutes() === 59);
}

function formatDeadlineLabel(value?: string | null, status?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (status !== "completed" && Date.now() > date.getTime()) return "FAILED: TIME EXPIRED";

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const dateLabel = sameDay(date, today)
    ? "Today"
    : sameDay(date, tomorrow)
      ? "Tomorrow"
      : date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
  if (!hasSpecificDeadlineTime(date)) return dateLabel;
  return `${dateLabel} @ ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

function getDeadlineTone(value?: string | null, status?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const msUntilDeadline = date.getTime() - Date.now();
  if (status !== "completed" && msUntilDeadline < 0) {
    return "text-red-400 font-bold drop-shadow-[0_0_8px_rgba(248,113,113,0.45)]";
  }
  if (status !== "completed" && msUntilDeadline <= 2 * 60 * 60 * 1000) {
    return "text-red-300 drop-shadow-[0_0_8px_rgba(248,113,113,0.35)]";
  }
  return "text-purple-300/80";
}

function DeadlineInputs({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (value: string | null) => void;
}) {
  const datePart = getLocalDatePart(value);
  const timePart = getLocalTimePart(value);

  return (
    <div className="rounded-xl border border-purple-500/20 bg-[#111118]/80 p-3 shadow-[inset_0_0_18px_rgba(139,92,246,0.06)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FormLabel className="text-xs text-purple-200/80 uppercase tracking-[0.2em]">Due Date</FormLabel>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
            <Input
              type="date"
              value={datePart}
              onChange={(event) => onChange(buildDeadlineIso(event.target.value, timePart))}
              className="bg-[#0b0b12] border-purple-500/25 pl-9 text-purple-50 [color-scheme:dark] focus-visible:ring-purple-500"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <FormLabel className="text-xs text-purple-200/80 uppercase tracking-[0.2em]">Due Time <span className="text-muted-foreground">(optional)</span></FormLabel>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-400" />
            <Input
              type="time"
              value={timePart}
              disabled={!datePart}
              onChange={(event) => onChange(buildDeadlineIso(datePart, event.target.value))}
              className="bg-[#0b0b12] border-purple-500/25 pl-9 text-purple-50 [color-scheme:dark] focus-visible:ring-purple-500 disabled:opacity-40"
            />
          </div>
        </div>
      </div>
      {datePart && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-2 text-xs text-purple-300/70 hover:text-red-300 transition-colors"
        >
          Clear deadline
        </button>
      )}
    </div>
  );
}

function RecurrenceFieldsCreate({
  control,
  watch,
}: {
  control: Control<CreateFormValues>;
  watch: UseFormWatch<CreateFormValues>;
}) {
  const recurrenceType = watch("recurrence")?.type ?? "none";
  return <RecurrenceFieldsUI control={control as Control<CreateFormValues>} recurrenceType={recurrenceType} />;
}

function RecurrenceFieldsEdit({
  control,
  watch,
}: {
  control: Control<EditFormValues>;
  watch: UseFormWatch<EditFormValues>;
}) {
  const recurrenceType = watch("recurrence")?.type ?? "none";
  return <RecurrenceFieldsUI control={control as Control<EditFormValues>} recurrenceType={recurrenceType} />;
}

function YearlyDatePicker({ ctrl }: { ctrl: Control<CreateFormValues> }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium leading-none">Date (month &amp; day)</span>
      <FormField control={ctrl} name="recurrence.month" render={({ field: monthField }) => (
        <FormField control={ctrl} name="recurrence.day" render={({ field: dayField }) => {
          const month = monthField.value;
          const day = dayField.value;
          const selectedDate = month && day
            ? new Date(2000, month - 1, day)
            : undefined;

          const label = selectedDate
            ? selectedDate.toLocaleDateString("default", { month: "short", day: "numeric" })
            : "Pick a date";

          return (
            <FormItem>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn(
                      "h-8 text-xs w-full justify-start gap-2 bg-background/50 border-input font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {label}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        monthField.onChange(date.getMonth() + 1);
                        dayField.onChange(date.getDate());
                        setOpen(false);
                      }
                    }}
                    captionLayout="dropdown"
                    defaultMonth={selectedDate}
                    fromYear={new Date().getFullYear()}
                    toYear={new Date().getFullYear() + 30}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          );
        }} />
      )} />
    </div>
  );
}

function RecurrenceFieldsUI({
  control,
  recurrenceType,
}: {
  control: Control<CreateFormValues> | Control<EditFormValues>;
  recurrenceType: string;
}) {
  const ctrl = control as Control<CreateFormValues>;
  return (
    <div className="space-y-3 border border-white/10 rounded-lg p-3 bg-white/5">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
        <RotateCcw className="w-3.5 h-3.5" />
        Recurrence
      </div>

      <FormField control={ctrl} name="recurrence.type" render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs">Schedule</FormLabel>
          <Select onValueChange={field.onChange} value={field.value ?? "none"}>
            <FormControl><SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="none">None (one-time)</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
      )} />

      {recurrenceType === "daily" && (
        <FormField control={ctrl} name="recurrence.intervalDays" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Every N days</FormLabel>
            <FormControl>
              <Input type="number" min={1} placeholder="1" {...field} value={field.value ?? ""} className="h-8 text-xs bg-background/50" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      )}

      {recurrenceType === "weekly" && (
        <FormField control={ctrl} name="recurrence.daysOfWeek" render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs">Days of week</FormLabel>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_OF_WEEK.map(d => (
                <label key={d.value} className={cn(
                  "flex items-center justify-center min-w-[44px] min-h-[44px] rounded text-xs cursor-pointer border transition-colors",
                  (field.value ?? []).includes(d.value)
                    ? "bg-primary/30 border-primary/60 text-primary"
                    : "bg-background/50 border-white/10 text-muted-foreground hover:border-white/30"
                )}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={(field.value ?? []).includes(d.value)}
                    onChange={(e) => {
                      const current = field.value ?? [];
                      if (e.target.checked) {
                        field.onChange([...current, d.value].sort());
                      } else {
                        field.onChange(current.filter((v: number) => v !== d.value));
                      }
                    }}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </FormItem>
        )} />
      )}

      {recurrenceType === "monthly" && (
        <FormField control={ctrl} name="recurrence.dayOfMonth" render={({ field }) => {
          const WEEK_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
          const now = new Date();
          const startOffset = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
          const fillers = Array.from({ length: startOffset }, (_, i) => i);
          return (
            <FormItem>
              <FormLabel className="text-xs">Day of month</FormLabel>
              <div className="grid grid-cols-7 gap-1">
                {WEEK_LABELS.map((w) => (
                  <div key={w} className="flex items-center justify-center h-6 text-[10px] text-muted-foreground/60 font-medium">
                    {w}
                  </div>
                ))}
                {fillers.map((i) => (
                  <div key={`filler-${i}`} className="h-8" />
                ))}
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => field.onChange(day)}
                    className={cn(
                      "flex items-center justify-center h-8 rounded text-xs cursor-pointer border transition-colors",
                      (field.value === day || Number(field.value) === day)
                        ? "bg-primary/30 border-primary/60 text-primary"
                        : "bg-background/50 border-white/10 text-muted-foreground hover:border-white/20"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <FormMessage />
            </FormItem>
          );
        }} />
      )}

      {recurrenceType === "yearly" && (
        <YearlyDatePicker ctrl={ctrl} />
      )}
    </div>
  );
}

function getRecurrenceLabel(recurrence: RecurrenceConfig | null | undefined): string | null {
  if (!recurrence || recurrence.type === "none") return null;
  switch (recurrence.type) {
    case "daily": {
      const n = recurrence.intervalDays ?? 1;
      return n === 1 ? "Daily" : `Every ${n} days`;
    }
    case "weekly": {
      const days = recurrence.daysOfWeek ?? [];
      if (days.length === 0) return "Weekly";
      return days.map(d => DAYS_OF_WEEK[d]?.label).filter(Boolean).join(", ");
    }
    case "monthly":
      return `Monthly (day ${recurrence.dayOfMonth ?? 1})`;
    case "yearly":
      return `Yearly (${MONTHS[(recurrence.month ?? 1) - 1]} ${recurrence.day ?? 1})`;
    default:
      return null;
  }
}

const DIFFICULTY_COLORS: Record<string, string> = {
  F: "text-slate-400", E: "text-green-400", D: "text-blue-400", C: "text-indigo-400",
  B: "text-purple-400", A: "text-amber-400", S: "text-orange-400", SS: "text-rose-400", SSS: "text-red-400",
};

const DIFFICULTY_BG: Record<string, string> = {
  F: "bg-slate-500/20", E: "bg-green-500/20", D: "bg-blue-500/20", C: "bg-indigo-500/20",
  B: "bg-purple-500/20", A: "bg-amber-500/20", S: "bg-orange-500/20", SS: "bg-rose-500/20", SSS: "bg-red-500/20",
};

function getPlannerRecurrenceLabel(quest: Quest): string | null {
  const r = quest.recurrence;
  if (!r || r.type === "none") return null;
  if (r.type === "daily") return r.intervalDays && r.intervalDays > 1 ? `Every ${r.intervalDays}d` : "Daily";
  if (r.type === "weekly") return "Weekly";
  if (r.type === "monthly") return "Monthly";
  if (r.type === "yearly") return "Yearly";
  return null;
}

function PlannerQuestCard({ quest, compact = false }: { quest: Quest; compact?: boolean }) {
  const recLabel = getPlannerRecurrenceLabel(quest);
  const isCompleted = quest.status === "completed";
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 border transition-all ${isCompleted ? "opacity-50 bg-white/3 border-white/5" : "bg-white/5 border-white/10 hover:bg-white/8"}`}>
      {isCompleted ? <CheckCircle2 className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-sm font-medium truncate ${isCompleted ? "line-through text-muted-foreground" : "text-white"}`}>{quest.name}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${DIFFICULTY_BG[quest.difficulty]} ${DIFFICULTY_COLORS[quest.difficulty]}`}>{quest.difficulty}</span>
          {recLabel && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/20 text-primary">{recLabel}</span>}
        </div>
        {!compact && (
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-violet-400" />
              {Math.floor((RANK_BASE_REWARDS[quest.difficulty]?.xp ?? 50) + quest.durationMinutes * DURATION_BONUS_PER_MINUTE.xp)} XP
              <ShadowIntel title="Shadow Intel" intel={SYSTEM_INTEL.GATE_FRAGMENTS} detail="Clear this quest for a 15% Archive roll toward Gate Fragment acquisition." />
            </span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{quest.durationMinutes}m</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PlannerViewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 rounded-xl bg-white/5" />
      <div className="h-48 rounded-xl bg-white/5" />
      <div className="h-24 rounded-xl bg-white/5" />
    </div>
  );
}

function PlannerErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white mb-1">Data Unavailable</p>
        <p className="text-xs text-muted-foreground">Could not load planner data. Check your connection and try again.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="border-white/20 tracking-widest text-xs">
        Retry
      </Button>
    </div>
  );
}

function PlannerDailyView() {
  const { data, isLoading, isError, refetch } = useGetPlannerDaily();
  if (isLoading) return <PlannerViewSkeleton />;
  if (isError || !data) return <PlannerErrorCard onRetry={refetch} />;
  const completionPct = data.totalDueCount > 0 ? Math.round((data.completedTodayCount / data.totalDueCount) * 100) : 0;
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };
  const badHabitsDueCount = data.badHabits.filter((h) => h.todayStatus === null).length;
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-primary/30 bg-primary/5 p-5 backdrop-blur-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wider text-white">TODAY'S ORDERS</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{formatDate(data.date)}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-stat font-bold text-violet-400">+{data.totalXpAvailable} XP</div>
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
            <div className={`text-lg font-stat font-bold ${badHabitsDueCount > 0 ? "text-red-400" : "text-green-400"}`}>{badHabitsDueCount}</div>
            <div className="text-xs text-muted-foreground">Habit Check-ins</div>
          </div>
        </div>
      </motion.div>
      {data.quests.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-background/50 border-white/10">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Sword className="h-4 w-4 text-primary" />Active Quests Due Today</CardTitle></CardHeader>
            <CardContent className="space-y-2">{data.quests.map((q) => <PlannerQuestCard key={q.id} quest={q} />)}</CardContent>
          </Card>
        </motion.div>
      )}
      {data.dailyOrders.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="bg-background/50 border-white/10">
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-blue-400" />Daily Orders</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.dailyOrders.map((order) => (
                <div key={order.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${order.completed ? "opacity-50 bg-white/3 border-white/5" : "bg-blue-500/5 border-blue-500/20"}`}>
                  {order.completed ? <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" /> : <Circle className="h-4 w-4 text-blue-400 flex-shrink-0" />}
                  <span className={`text-sm ${order.completed ? "line-through text-muted-foreground" : "text-white"}`}>{order.name}</span>
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
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-red-400" />Bad Habit Check-ins</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.badHabits.map((habit) => {
                const status = habit.todayStatus;
                return (
                  <div key={habit.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${status === "clean" ? "bg-green-500/5 border-green-500/20" : status === "relapse" ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/10"}`}>
                    {status === "clean" ? <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" /> : status === "relapse" ? <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    <span className="text-sm text-white">{habit.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{status === "clean" ? "Clean" : status === "relapse" ? "Relapsed" : "Unchecked"}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}
      {data.quests.length === 0 && data.dailyOrders.length === 0 && data.badHabits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-primary/10 p-4 mb-4"><Star className="h-8 w-8 text-primary" /></div>
          <h3 className="text-lg font-semibold text-white mb-2">All clear, Hunter</h3>
          <p className="text-sm text-muted-foreground max-w-sm">No quests or tasks due today. Add recurring quests or daily orders to see them here.</p>
        </div>
      )}
    </div>
  );
}

function PlannerWeeklyView() {
  const { data, isLoading, isError, refetch } = useGetPlannerWeekly();
  const rescheduleQuest = useRescheduleQuest();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dragQuestRef = useRef<{ questId: number; fromDate: string } | null>(null);
  if (isLoading) return <PlannerViewSkeleton />;
  if (isError || !data) return <PlannerErrorCard onRetry={refetch} />;
  const today = new Date().toLocaleDateString("en-CA");
  const handleDragStart = (questId: number, fromDate: string) => { dragQuestRef.current = { questId, fromDate }; };
  const handleDrop = async (toDate: string) => {
    if (!dragQuestRef.current) return;
    const { questId, fromDate } = dragQuestRef.current;
    if (fromDate === toDate) return;
    try {
      await rescheduleQuest.mutateAsync({ questId, newDeadline: toDate });
      await queryClient.invalidateQueries({ queryKey: getPlannerWeeklyQueryKey() });
      toast({ title: "Quest rescheduled", description: `Moved to ${toDate}`, duration: 3000 });
    } catch { toast({ title: "Failed to reschedule", variant: "destructive", duration: 3000 }); }
    dragQuestRef.current = null;
  };
  return (
    <div className="space-y-4">
      <div className="text-center text-sm text-muted-foreground">{data.weekStart} — {data.weekEnd}<span className="ml-2 text-xs opacity-60">• Drag quests to reschedule</span></div>
      <div className="grid grid-cols-7 gap-2">
        {data.days.map((day: WeeklyPlannerDay) => {
          const isToday = day.date === today;
          const isPast = day.date < today;
          return (
            <div key={day.date} className={`rounded-xl border p-2 min-h-[120px] transition-colors ${isToday ? "border-primary/50 bg-primary/5" : "border-white/10 bg-white/3 hover:bg-white/5"}`} onDragOver={(e) => { e.preventDefault(); }} onDrop={() => handleDrop(day.date)}>
              <div className={`text-center mb-2 ${isToday ? "text-primary font-bold" : isPast ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                <div className="text-xs uppercase tracking-wider">{day.dayName}</div>
                <div className={`text-lg font-stat ${isToday ? "text-primary" : ""}`}>{new Date(day.date + "T00:00:00").getDate()}</div>
                {day.completedCount > 0 && <div className="text-xs text-green-400">✓{day.completedCount}</div>}
              </div>
              <div className="space-y-1">
                {day.quests.slice(0, 5).map((q: Quest) => {
                  const recLabel = getPlannerRecurrenceLabel(q);
                  const isCompleted = q.status === "completed";
                  return (
                    <div key={q.id} draggable={!isCompleted && !!q.deadline} onDragStart={() => handleDragStart(q.id, day.date)} className={`text-xs rounded px-1.5 py-1 truncate border cursor-grab active:cursor-grabbing select-none ${isCompleted ? "opacity-40 bg-white/3 border-white/5 line-through" : `${DIFFICULTY_BG[q.difficulty]} border-white/10`}`} title={q.name}>
                      <span className={`font-bold mr-1 ${DIFFICULTY_COLORS[q.difficulty]}`}>{q.difficulty}</span>
                      {q.name}{recLabel && <span className="ml-1 opacity-60">↻</span>}
                    </div>
                  );
                })}
                {day.quests.length > 5 && <div className="text-xs text-muted-foreground text-center">+{day.quests.length - 5} more</div>}
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

function PlannerMonthlyView() {
  const { data, isLoading, isError, refetch } = useGetPlannerMonthly();
  const [selectedDay, setSelectedDay] = useState<MonthlyPlannerDay | null>(null);
  if (isLoading) return <PlannerViewSkeleton />;
  if (isError || !data) return <PlannerErrorCard onRetry={refetch} />;
  const firstDay = new Date(`${data.year}-${String(data.month).padStart(2, "0")}-01`).getDay();
  const emptyLeadingCells = firstDay;
  return (
    <div className="space-y-4">
      <h2 className="text-center font-display text-xl font-bold tracking-wider text-white">{data.monthName} {data.year}</h2>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1 uppercase tracking-wider font-semibold">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: emptyLeadingCells }).map((_, i) => <div key={`empty-${i}`} />)}
        {data.days.map((day: MonthlyPlannerDay) => {
          const isToday = day.date === data.today;
          const isPast = day.date < data.today;
          const hasActivity = day.completedCount > 0 || day.failedCount > 0;
          const hasMilestones = day.milestones.length > 0;
          const dayNum = new Date(day.date + "T00:00:00").getDate();
          return (
            <button key={day.date} onClick={() => setSelectedDay(selectedDay?.date === day.date ? null : day)} className={`relative rounded-lg p-1.5 text-center transition-all border text-xs h-14 flex flex-col items-center justify-start ${isToday ? "border-primary/60 bg-primary/10 text-primary" : selectedDay?.date === day.date ? "border-white/40 bg-white/10 text-white" : isPast ? "border-white/5 bg-transparent text-muted-foreground/50 hover:bg-white/5" : "border-white/10 bg-white/3 text-muted-foreground hover:bg-white/8"}`}>
              <span className={`font-semibold ${isToday ? "text-primary" : ""}`}>{dayNum}</span>
              <div className="flex items-center gap-0.5 mt-auto flex-wrap justify-center">
                {day.completedCount > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />}
                {day.failedCount > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />}
                {hasMilestones && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />}
                {day.upcomingQuests.length > 0 && !hasActivity && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400/60" />}
              </div>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {selectedDay && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Card className="bg-background/60 border-white/20 mt-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{new Date(selectedDay.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
                  <div className="flex gap-2 text-xs font-normal">
                    {selectedDay.completedCount > 0 && <span className="text-green-400">✓ {selectedDay.completedCount} completed</span>}
                    {selectedDay.failedCount > 0 && <span className="text-red-400">✗ {selectedDay.failedCount} failed</span>}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedDay.milestones.map((m, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-amber-300 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                    <Star className="h-3.5 w-3.5 flex-shrink-0" /><span>Deadline: {m.name}</span>
                  </div>
                ))}
                {selectedDay.upcomingQuests.map((q) => <PlannerQuestCard key={q.id} quest={q} compact />)}
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

const HEATMAP_COLORS = ["bg-white/5 border-white/5", "bg-primary/20 border-primary/20", "bg-primary/40 border-primary/40", "bg-primary/60 border-primary/60", "bg-primary border-primary/80"];

function PlannerYearlyView() {
  const { data, isLoading, isError, refetch } = useGetPlannerYearly();
  const [hoverDay, setHoverDay] = useState<{ day: YearlyHeatmapDay; x: number; y: number } | null>(null);

  if (isLoading) return <PlannerViewSkeleton />;
  if (isError || !data) return <PlannerErrorCard onRetry={refetch} />;
  const weeks: YearlyHeatmapDay[][] = [];
  let currentWeek: YearlyHeatmapDay[] = [];
  const firstDayOfYear = new Date(data.year, 0, 1).getDay();
  for (let i = 0; i < firstDayOfYear; i++) currentWeek.push({ date: "", completedCount: 0, failedCount: 0, xpGained: 0, level: -1 });
  for (const day of data.heatmapDays) {
    currentWeek.push(day);
    if (currentWeek.length === 7) { weeks.push(currentWeek); currentWeek = []; }
  }
  if (currentWeek.length > 0) { while (currentWeek.length < 7) currentWeek.push({ date: "", completedCount: 0, failedCount: 0, xpGained: 0, level: -1 }); weeks.push(currentWeek); }
  const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthPositions: { month: string; col: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    for (const day of weeks[w]) {
      if (day.date) {
        const m = new Date(day.date + "T00:00:00").getMonth();
        if (m !== lastMonth) { monthPositions.push({ month: MONTH_NAMES[m], col: w }); lastMonth = m; }
      }
    }
  }
  const totalCompleted = data.heatmapDays.reduce((s, d) => s + d.completedCount, 0);
  const totalXp = data.heatmapDays.reduce((s, d) => s + d.xpGained, 0);
  const activeDays = data.heatmapDays.filter((d) => d.completedCount > 0).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-background/50 border-white/10 text-center p-4"><div className="text-2xl font-stat font-bold text-white">{totalCompleted}</div><div className="text-xs text-muted-foreground">Quests Completed</div></Card>
        <Card className="bg-background/50 border-white/10 text-center p-4"><div className="text-2xl font-stat font-bold text-violet-400">{totalXp.toLocaleString()}</div><div className="text-xs text-muted-foreground">XP Earned</div></Card>
        <Card className="bg-background/50 border-white/10 text-center p-4"><div className="text-2xl font-stat font-bold text-primary">{activeDays}</div><div className="text-xs text-muted-foreground">Active Days</div></Card>
      </div>
      <Card className="bg-background/50 border-white/10">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4 text-primary" />Activity Heatmap — {data.year}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="relative w-full max-w-4xl">
            <div className="flex gap-0.5 mb-1 text-xs text-muted-foreground/60">
              {monthPositions.map((mp, i) => <div key={i} className="absolute" style={{ left: `${mp.col * 14}px` }}>{mp.month}</div>)}
            </div>
            <div className="flex gap-0.5 mt-5">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day, di) => {
                    if (!day.date || day.level < 0) return <div key={di} className="w-3 h-3 rounded-sm" />;
                    const isToday = day.date === data.today;
                    return (
                      <div
                        key={di}
                        className={`w-3 h-3 rounded-sm border cursor-default transition-transform hover:scale-125 ${isToday ? "ring-1 ring-white/60" : ""} ${HEATMAP_COLORS[day.level] ?? HEATMAP_COLORS[0]}`}
                        onMouseEnter={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const parent = (e.currentTarget as HTMLElement).closest(".overflow-x-auto")?.getBoundingClientRect();
                          setHoverDay({ day, x: rect.left - (parent?.left ?? 0) + rect.width / 2, y: rect.top - (parent?.top ?? 0) });
                        }}
                        onMouseLeave={() => setHoverDay(null)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            {hoverDay && (
              <div
                className="pointer-events-none absolute z-50 rounded-md border border-white/10 bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md"
                style={{ left: hoverDay.x, top: hoverDay.y - 52, transform: "translateX(-50%)" }}
              >
                <div className="font-semibold">{hoverDay.day.date}</div>
                <div>{hoverDay.day.completedCount} completed · {hoverDay.day.xpGained} XP</div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
            <span>Less</span>
            {HEATMAP_COLORS.map((c, i) => <div key={i} className={`w-3 h-3 rounded-sm border ${c}`} />)}
            <span>More</span>
          </div>
        </CardContent>
      </Card>
      {data.keyEvents.length > 0 && (
        <Card className="bg-background/50 border-white/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-400" />Key Events — {data.year}</CardTitle></CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto">
            {data.keyEvents.map((event: YearlyKeyEvent, i: number) => (
              <div key={i} className={`flex items-center gap-3 rounded-lg px-3 py-2 border text-sm ${event.type === "boss_defeated" ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : event.type === "high_xp_day" ? "bg-violet-500/10 border-violet-500/30 text-violet-300" : "bg-primary/10 border-primary/30 text-primary"}`}>
                {event.type === "boss_defeated" ? <Skull className="h-4 w-4 flex-shrink-0" /> : event.type === "high_xp_day" ? <Zap className="h-4 w-4 flex-shrink-0" /> : <Flame className="h-4 w-4 flex-shrink-0" />}
                <div className="flex-1"><span className="font-medium">{event.label}</span></div>
                <span className="text-xs opacity-70 flex-shrink-0">{event.date}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

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

const CHART_THEME = {
  text: "#a1a1aa",
  grid: "rgba(255,255,255,0.05)",
};

const CHRONICLE_HEATMAP_COLORS = ["bg-white/5 border-white/5", "bg-emerald-900/50 border-emerald-800/50", "bg-emerald-700/60 border-emerald-600/60", "bg-emerald-500/70 border-emerald-400/70", "bg-emerald-400 border-emerald-300/80"];

function ChronicleHeatmap({ activityCalendar }: { activityCalendar: { date: string; count: number; level: number }[] }) {
  const [hoverDay, setHoverDay] = useState<{ item: { date: string; count: number; level: number }; x: number; y: number } | null>(null);

  const { weeks, monthPositions, totalCount } = useMemo(() => {
    if (!activityCalendar.length) return { weeks: [], monthPositions: [], totalCount: 0 };
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sorted = [...activityCalendar].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(sorted[0].date + "T00:00:00");
    const firstDow = firstDate.getDay();
    const weeksArr: { date: string; count: number; level: number }[][] = [];
    let cur: { date: string; count: number; level: number }[] = [];
    for (let i = 0; i < firstDow; i++) cur.push({ date: "", count: 0, level: -1 });
    for (const item of sorted) {
      cur.push(item);
      if (cur.length === 7) { weeksArr.push(cur); cur = []; }
    }
    if (cur.length > 0) { while (cur.length < 7) cur.push({ date: "", count: 0, level: -1 }); weeksArr.push(cur); }
    const mpos: { month: string; col: number }[] = [];
    let lastM = -1;
    for (let w = 0; w < weeksArr.length; w++) {
      for (const d of weeksArr[w]) {
        if (d.date) {
          const m = new Date(d.date + "T00:00:00").getMonth();
          if (m !== lastM) { mpos.push({ month: MONTH_NAMES[m], col: w }); lastM = m; }
        }
      }
    }
    const total = activityCalendar.reduce((s, d) => s + d.count, 0);
    return { weeks: weeksArr, monthPositions: mpos, totalCount: total };
  }, [activityCalendar]);

  if (!weeks.length) return null;

  return (
    <Card className="glass-panel">
      <CardHeader>
        <CardTitle className="font-display tracking-widest text-lg">Activity Heatmap — Past Year</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="relative w-full max-w-4xl">
          <div className="flex gap-0.5 mb-1 text-xs text-muted-foreground/60">
            {monthPositions.map((mp, i) => <div key={i} className="absolute" style={{ left: `${mp.col * 14}px` }}>{mp.month}</div>)}
          </div>
          <div className="flex gap-0.5 mt-5">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((item, di) => {
                  if (!item.date || item.level < 0) return <div key={di} className="w-3 h-3 rounded-sm" />;
                  return (
                    <div
                      key={di}
                      className={`w-3 h-3 rounded-sm border cursor-default transition-transform hover:scale-125 ${CHRONICLE_HEATMAP_COLORS[item.level] ?? CHRONICLE_HEATMAP_COLORS[0]}`}
                      onMouseEnter={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const parent = (e.currentTarget as HTMLElement).closest(".overflow-x-auto")?.getBoundingClientRect();
                        setHoverDay({ item, x: rect.left - (parent?.left ?? 0) + rect.width / 2, y: rect.top - (parent?.top ?? 0) });
                      }}
                      onMouseLeave={() => setHoverDay(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {hoverDay && (
            <div
              className="pointer-events-none absolute z-50 rounded-md border border-white/10 bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md"
              style={{ left: hoverDay.x, top: hoverDay.y - 52, transform: "translateX(-50%)" }}
            >
              <div className="font-semibold">{hoverDay.item.date}</div>
              <div>{hoverDay.item.count} quest{hoverDay.item.count !== 1 ? "s" : ""} completed</div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>{totalCount} quests completed in the past year</span>
          <div className="flex items-center gap-1">
            <span>Less</span>
            {CHRONICLE_HEATMAP_COLORS.map((c, i) => <div key={i} className={`w-3 h-3 rounded-sm border ${c}`} />)}
            <span>More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ChronicleTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#1c1c2e", border: "1px solid #8b5cf6", borderRadius: 8, padding: "8px 14px", color: "#e4e4e7", fontSize: 13 }}>
      {label && <p style={{ marginBottom: 4, fontWeight: 600 }}>{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

function ChronicleSection() {
  const { data, isLoading, isError, error } = useQuery<DashboardStats>({
    queryKey: ["dashboard-stats"],
    queryFn: async ({ signal }) => {
      return customFetch<DashboardStats>("/api/dashboard-stats", { signal });
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isError) {
    return (
      <div className="py-12 flex items-center justify-center">
        <p className="text-red-400">Failed to load analytics: {(error as Error).message}</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="py-12 flex items-center justify-center">
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

  const xpByDateFormatted = data.xpByDate.map((d) => {
    const [y, mo, dy] = d.date.split("-").map(Number);
    return {
      ...d,
      date: new Date(y, mo - 1, dy).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  });

  const xpByStatFormatted = data.xpByStatCategory.map((d) => ({ stat: d.category, xp: d.xp }));

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-display text-2xl font-bold tracking-widest text-white mb-1">HUNTER'S CHRONICLE</h2>
        <p className="text-muted-foreground text-sm tracking-widest uppercase">
          <BarChart2 className="inline w-4 h-4 mr-2 text-primary" />
          Player Progression Overview
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="glass-panel border border-orange-500/20">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <Flame className="w-7 h-7 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Current Streak</p>
                <p className="text-3xl font-stat font-bold text-orange-400">{data.character.streak}</p>
                <p className="text-xs text-muted-foreground">days in a row</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-panel border border-yellow-500/20">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <Coins className="w-7 h-7 text-gold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Treasury / Gold</p>
                <p className="text-3xl font-stat font-bold text-gold">{data.character.gold.toLocaleString()}</p>
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
                  <p className="text-xl font-stat font-bold text-primary">
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
            <CardTitle className="font-display tracking-widest text-lg">Progression Curve — 30-Day XP</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={xpByDateFormatted} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="chronicleXpGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="date" tick={{ fill: CHART_THEME.text, fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fill: CHART_THEME.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                <RechartsTooltip content={<ChronicleTooltip />} />
                <Area type="monotone" dataKey="xp" name="XP Gained" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#chronicleXpGradient)" dot={false} activeDot={{ r: 5, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="glass-panel h-full">
            <CardHeader>
              <CardTitle className="font-display tracking-widest text-lg">Grind Breakdown — XP by Stat</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart layout="vertical" data={xpByStatFormatted} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: CHART_THEME.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="stat" type="category" tick={{ fill: CHART_THEME.text, fontSize: 12 }} tickLine={false} axisLine={false} width={75} />
                  <RechartsTooltip content={<ChronicleTooltip />} />
                  <Bar dataKey="xp" name="XP" radius={[0, 6, 6, 0]}>
                    {xpByStatFormatted.map((entry, i) => {
                      const colors = ["#8b5cf6", "#10b981", "#6366f1", "#f59e0b", "#ec4899"];
                      return <Cell key={entry.stat} fill={colors[i % colors.length]} fillOpacity={0.85} />;
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
              <CardTitle className="font-display tracking-widest text-lg">Quest Outcome Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-4">
              {outcomeChartData.length === 0 ? (
                <p className="text-muted-foreground text-sm">No quest activity recorded yet.</p>
              ) : (
                <>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie data={outcomeChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                        {outcomeChartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} fillOpacity={0.9} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                        contentStyle={{ background: "#1c1c2e", border: "1px solid #8b5cf6", borderRadius: 8, color: "#e4e4e7", fontSize: 13 }}
                        labelStyle={{ color: "#e4e4e7" }}
                        itemStyle={{ color: "#ffffff" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 flex-1">
                    {outcomeChartData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
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
        <ChronicleHeatmap activityCalendar={data.activityCalendar} />
      </motion.div>
    </div>
  );
}

type PageTab = "daily" | "weekly" | "monthly" | "yearly" | "questlog";

const ALL_TABS: { key: PageTab; label: string; icon: typeof Calendar }[] = [
  { key: "daily", label: "Daily", icon: Calendar },
  { key: "weekly", label: "Weekly", icon: CalendarDays },
  { key: "monthly", label: "Monthly", icon: LayoutGrid },
  { key: "yearly", label: "Yearly", icon: TrendingUp },
  { key: "questlog", label: "Quest Log", icon: ScrollText },
];

const PLANNER_TABS: PageTab[] = ["daily", "weekly", "monthly", "yearly"];

const DEFAULT_WINDOW_DAYS = 30;

export default function Quests() {
  const [activeTab, setActiveTab] = useState<PageTab>("daily");
  const [showAll, setShowAll] = useState(false);
  const windowDays = showAll ? null : DEFAULT_WINDOW_DAYS;
  const { data: quests = [], isLoading } = useListQuestsWindowed({ windowDays });
  const createQuest = useCreateQuest();
  const updateQuest = useUpdateQuest();
  const deleteQuest = useDeleteQuest();
  const completeQuestMutation = useCompleteQuest({
    mutation: {
      mutationFn: ({ id }: { id: number }) =>
        completeQuest(id, { headers: { "x-local-date": new Date().toLocaleDateString("en-CA") } }),
    },
  });
  const failQuestMutation = useFailQuest({
    mutation: {
      mutationFn: ({ id }: { id: number }) =>
        failQuest(id, { headers: { "x-local-date": new Date().toLocaleDateString("en-CA") } }),
    },
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);
  const [showRecurrence, setShowRecurrence] = useState(false);
  const [showEditRecurrence, setShowEditRecurrence] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ newLevel: number; statDeltas: Array<{ name: string; value: number }> } | null>(null);
  const [completingQuestId, setCompletingQuestId] = useState<number | null>(null);
  const [rankUpData, setRankUpData] = useState<{ statName: string; statValue: number } | null>(null);
  const [fragmentDropData, setFragmentDropData] = useState<{ count: number } | null>(null);

  const [awakeningOpen, setAwakeningOpen] = useState(false);

  const [deadlineTick, setDeadlineTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setDeadlineTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "MISSION_WARNING_ALARM") {
        playSystemWarning();
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);


  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      description: "",
      category: QuestCategory.Productivity,
      statBoost: undefined,
      difficulty: QuestDifficulty.E,
      durationMinutes: 30,
      deadline: "",
      targetAmount: undefined,
      amountUnit: "",
      recurrence: { type: "none" },
    }
  });

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      description: "",
      category: QuestCategory.Productivity,
      statBoost: undefined,
      difficulty: QuestDifficulty.E,
      durationMinutes: 30,
      deadline: "",
      targetAmount: undefined,
      amountUnit: "",
      recurrence: { type: "none" },
    }
  });

  useEffect(() => {
    if (editingQuest) {
      const rec = editingQuest.recurrence as RecurrenceConfig | null;
      editForm.reset({
        name: editingQuest.name,
        description: editingQuest.description ?? "",
        category: editingQuest.category,
        statBoost: (editingQuest.statBoost as z.infer<typeof editSchema>["statBoost"]) ?? undefined,
        difficulty: editingQuest.difficulty as QuestDifficulty,
        durationMinutes: editingQuest.durationMinutes,
        deadline: editingQuest.deadline ?? "",
        targetAmount: editingQuest.targetAmount ?? undefined,
        amountUnit: editingQuest.amountUnit ?? "",
        recurrence: rec ?? { type: "none" },
      });
      setShowEditRecurrence(!!(rec && rec.type !== "none"));
    }
  }, [editingQuest?.id]);

  const isNearDeadline = (deadline: string | null | undefined): boolean => {
    if (!deadline || deadlineTick < 0) return false;
    const ms = new Date(deadline).getTime() - Date.now();
    return ms > 0 && ms <= 30 * 60 * 1000;
  };

  const invalidateQuests = () => {
    // Each key is computed inside its own try/catch so a single bad import or
    // undefined function can never block the rest of the invalidations.
    // Promise.allSettled fires every invalidation regardless of individual failures.
    const safeInvalidate = (getKey: () => readonly unknown[]) => {
      try {
        return queryClient.invalidateQueries({ queryKey: getKey() });
      } catch {
        return Promise.resolve();
      }
    };
    void Promise.allSettled([
      safeInvalidate(() => getListQuestsWindowedQueryKey()),
      safeInvalidate(() => getListQuestsWindowedQueryKey({ windowDays })),
      safeInvalidate(() => getPlannerDailyQueryKey()),
      safeInvalidate(() => getPlannerWeeklyQueryKey()),
      safeInvalidate(() => getPlannerMonthlyQueryKey()),
      safeInvalidate(() => getPlannerYearlyQueryKey()),
      safeInvalidate(() => getGetCharacterQueryKey()),
    ]);
  };

  const onComplete = async (id: number) => {
    const activeQueryKey = getListQuestsWindowedQueryKey({ windowDays });
    await queryClient.cancelQueries({ queryKey: activeQueryKey });
    const previousQuests = queryClient.getQueryData<Quest[]>(activeQueryKey);
    queryClient.setQueryData<Quest[]>(activeQueryKey, (old) =>
      old?.map((q) => q.id === id ? { ...q, status: "completed" } : q) ?? []
    );

    completeQuestMutation.mutate({ id }, {
      onSuccess: (res) => {
        setCompletingQuestId(id);
        if (!reduced) playQuestComplete();
        toast({ title: "Quest Cleared", description: <XpGainToast xp={res.xpAwarded} gold={res.goldAwarded} /> });
        if ((res as Record<string, unknown>).gateFragmentDropped) {
          const fragCount = (res.character as Record<string, number> | undefined)?.gateFragments ?? 1;
          setTimeout(() => setFragmentDropData({ count: Math.min(fragCount, 3) }), 700);
        }
        if ((res as Record<string, unknown>).vocationLevelUp === true) {
          setTimeout(() => setAwakeningOpen(true), 1400);
        }
        if (res.leveledUp && res.newLevel) {
          const statNames = ["strength", "spirit", "endurance", "intellect", "discipline"] as const;
          const statDeltas: Array<{ name: string; value: number }> = [];
          if (res.statGains) {
            for (const stat of statNames) {
              const gain = (res.statGains as Record<string, number>)[stat] ?? 0;
              if (gain > 0) {
                statDeltas.push({ name: stat.charAt(0).toUpperCase() + stat.slice(1), value: gain });
              }
            }
          }
          setTimeout(() => setLevelUpData({ newLevel: res.newLevel!, statDeltas }), 600);
        }
        if (res.statGains && res.character) {
          const statNames = ["strength", "spirit", "endurance", "intellect", "discipline"] as const;
          for (const stat of statNames) {
            const gain = (res.statGains as Record<string, number>)[stat] ?? 0;
            const newVal = (res.character as Record<string, number>)[stat] ?? 0;
            const prevVal = newVal - gain;
            const prevTier = Math.floor(prevVal / 10000);
            const newTier = Math.floor(newVal / 10000);
            if (gain > 0 && newTier > prevTier && newTier > 0) {
              setTimeout(() => setRankUpData({ statName: stat.charAt(0).toUpperCase() + stat.slice(1), statValue: newVal }), 1200);
              break;
            }
          }
        }
      },
      onError: () => {
        queryClient.setQueryData(activeQueryKey, previousQuests);
        toast({ title: "Sync Error", description: "Failed to complete quest. Reverting...", variant: "destructive" });
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: getListQuestsWindowedQueryKey() });
        queryClient.invalidateQueries({ queryKey: getPlannerDailyQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
      },
    });
  };

  const onFail = (id: number) => {
    failQuestMutation.mutate({ id }, {
      onSuccess: (res) => {
        invalidateQuests();
        toast({ title: "Quest Failed", description: `-${res.xpDeducted} XP | -${res.goldDeducted} Gold`, variant: "destructive" });
      }
    });
  };

  const onDelete = (id: number) => {
    deleteQuest.mutate({ id }, {
      onSuccess: () => {
        invalidateQuests();
        toast({ title: "Quest Removed", description: "Mission deleted from the system." });
      }
    });
  };

  const onTogglePause = (quest: Quest) => {
    updateQuest.mutate(
      { id: quest.id, data: { isPaused: !quest.isPaused } },
      {
        onSuccess: () => {
          invalidateQuests();
          toast({
            title: quest.isPaused ? "Quest Resumed" : "Quest Paused",
            description: quest.isPaused ? "The quest is now active again." : "The quest has been paused.",
          });
        }
      }
    );
  };

  const buildRecurrence = (rec: z.infer<typeof recurrenceSchema> | null | undefined): RecurrenceConfig | null => {
    if (!rec || rec.type === "none") return null;
    return rec as RecurrenceConfig;
  };

  const onCreateSubmit = (data: z.infer<typeof createSchema>) => {
    const deadlineIso = normalizeDeadlineIso(data.deadline);
    createQuest.mutate({
      data: {
        name: data.name,
        category: data.category,
        difficulty: data.difficulty,
        durationMinutes: data.durationMinutes,
        description: data.description || null,
        deadline: deadlineIso,
        statBoost: data.statBoost ?? null,
        targetAmount: data.targetAmount ?? null,
        amountUnit: data.amountUnit || null,
        recurrence: buildRecurrence(data.recurrence),
        vocationId: null,
      }
    }, {
      onSuccess: (newQuest) => {
        // ── Phase 1: Instant cache injection ─────────────────────────────
        // Write the new quest into both cache shapes immediately so it
        // appears in the Active tab before the background refetch arrives.
        queryClient.setQueryData<Quest[]>(
          getListQuestsWindowedQueryKey({ windowDays }),
          (old) => (old ? [...old, newQuest] : [newQuest]),
        );
        queryClient.setQueryData<Quest[]>(
          getListQuestsWindowedQueryKey(),
          (old) => (old ? [...old, newQuest] : [newQuest]),
        );
        // ── Phase 2: UI state — runs immediately, never blocked ───────────
        setIsCreateOpen(false);
        setShowRecurrence(false);
        createForm.reset();
        setActiveTab("questlog");
        window.scrollTo({ top: 0, behavior: "smooth" });
        toast({ title: "Quest Registered", description: "A new mission has been added to the system." });
        // ── Phase 3: Background reconciliation (fire-and-forget) ──────────
        // invalidateQuests uses Promise.allSettled — a failure in any single
        // planner key will never prevent the quest list from being refreshed.
        invalidateQuests();
      }
    });
  };

  const onEditSubmit = (data: z.infer<typeof editSchema>) => {
    if (!editingQuest) return;
    const deadlineIso = normalizeDeadlineIso(data.deadline);
    const questId = editingQuest.id;
    updateQuest.mutate(
      {
        id: questId,
        data: {
          name: data.name,
          category: data.category,
          difficulty: data.difficulty,
          durationMinutes: data.durationMinutes,
          description: data.description || null,
          deadline: deadlineIso,
          statBoost: data.statBoost ?? null,
          targetAmount: data.targetAmount ?? null,
          amountUnit: data.amountUnit || null,
          recurrence: buildRecurrence(data.recurrence),
          vocationId: null,
        }
      },
      {
        onSuccess: (updatedQuest) => {
          queryClient.setQueryData<Quest[]>(
            getListQuestsWindowedQueryKey({ windowDays }),
            (old) => old?.map((q) => q.id === updatedQuest.id ? updatedQuest : q) ?? old
          );
          queryClient.setQueryData<Quest[]>(
            getListQuestsWindowedQueryKey(),
            (old) => old?.map((q) => q.id === updatedQuest.id ? updatedQuest : q) ?? old
          );
          invalidateQuests();
          setEditingQuest(null);
          toast({ title: "Quest Updated", description: "Mission parameters have been updated." });
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Unknown error.";
          toast({
            title: "Update Failed",
            description: `Could not save quest changes. ${msg}`,
            className: "border-destructive bg-destructive/20 text-destructive-foreground",
          });
        },
      }
    );
  };

  const watchedCreateCategory = createForm.watch("category");
  const watchedCreateStatBoost = createForm.watch("statBoost");
  const watchedEditCategory = editForm.watch("category");
  const watchedEditStatBoost = editForm.watch("statBoost");

  const difficultyColors: Record<string, string> = {
    F: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    E: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    D: "bg-green-500/20 text-green-400 border-green-500/30",
    C: "bg-amber-600/20 text-amber-500 border-amber-600/30",
    B: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    A: "bg-red-500/20 text-red-400 border-red-500/30",
    S: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    SS: "bg-pink-500/20 text-pink-400 border-pink-500/30 shadow-[0_0_10px_rgba(236,72,153,0.5)]",
    SSS: "bg-primary/20 text-primary border-primary/50 shadow-[0_0_15px_rgba(124,58,237,0.6)] animate-pulse",
  };

  const rankTooltips: Record<string, { what: string; fn: string; usage: string }> = {
    F: {
      what: "Rank F — the lowest difficulty tier.",
      fn: "Awards minimal XP and Gold. Suitable for tiny 5–10 min tasks.",
      usage: "Use for trivial chores or warm-up tasks. Easy to complete, but low reward.",
    },
    E: {
      what: "Rank E — beginner difficulty.",
      fn: "Awards small XP and Gold. Suitable for short tasks under 30 minutes.",
      usage: "Good for daily habits and simple recurring to-dos.",
    },
    D: {
      what: "Rank D — easy difficulty.",
      fn: "Awards moderate XP and Gold. Suitable for tasks around 30–60 minutes.",
      usage: "Assign to straightforward tasks that require some focus.",
    },
    C: {
      what: "Rank C — medium difficulty.",
      fn: "Awards decent XP and Gold. Suitable for tasks requiring 1–2 hours of effort.",
      usage: "Great for study sessions, workouts, or focused work blocks.",
    },
    B: {
      what: "Rank B — hard difficulty.",
      fn: "Awards solid XP and Gold. Suitable for demanding tasks of 2–4 hours.",
      usage: "Reserve for projects, long study sprints, or physically demanding challenges.",
    },
    A: {
      what: "Rank A — very hard difficulty.",
      fn: "Awards high XP and Gold. Suitable for tasks that take most of the day.",
      usage: "Use sparingly for major milestones or intensive full-day efforts.",
    },
    S: {
      what: "Rank S — elite difficulty.",
      fn: "Awards very high XP and Gold. Equivalent to a significant life achievement.",
      usage: "Set for ambitious multi-session projects or major personal goals.",
    },
    SS: {
      what: "Rank SS — legendary difficulty.",
      fn: "Awards exceptional XP and Gold. Only for the most grueling long-term quests.",
      usage: "Assign to week-long sprints or major life challenges.",
    },
    SSS: {
      what: "Rank SSS — mythic difficulty.",
      fn: "Awards maximum XP and Gold. Reserved for once-in-a-lifetime feats.",
      usage: "Only for the absolute hardest goals you can set for yourself.",
    },
  };

  if (isLoading) return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md ml-4" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-11 w-11 rounded-md" />
              <Skeleton className="h-11 w-11 rounded-md" />
              <Skeleton className="h-11 w-24 rounded-md" />
              <Skeleton className="h-11 w-24 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 border border-primary/50">
          <ScrollText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-widest text-white">QUESTS</h1>
          <p className="text-xs text-muted-foreground tracking-wider">Missions, orders & planning</p>
        </div>
      </div>

      {/* Unified tab bar: planner views + quest log + daily orders */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-white/5 border border-white/10 p-1 mb-8">
        {ALL_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold tracking-widest transition-all ${
              activeTab === key
                ? "bg-primary/20 text-primary border border-primary/40 shadow-[inset_0_0_10px_rgba(124,58,237,0.1)]"
                : "text-muted-foreground hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="hidden sm:inline truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* PLANNER tabs (daily/weekly/monthly/yearly) + Chronicle stats below */}
      {PLANNER_TABS.includes(activeTab) && (
        <div className="space-y-8">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {activeTab === "daily" && <PlannerDailyView />}
              {activeTab === "weekly" && <PlannerWeeklyView />}
              {activeTab === "monthly" && <PlannerMonthlyView />}
              {activeTab === "yearly" && <PlannerYearlyView />}
            </motion.div>
          </AnimatePresence>
          {/* Chronicle stats embedded below planner */}
          <div className="border-t border-white/10 pt-8">
            <ChronicleSection />
          </div>
        </div>
      )}

      {/* QUEST LOG tab */}
      {activeTab === "questlog" && (
      <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <InfoTooltip
            what="Quest Log — your personal mission board."
            fn="Tracks all real-world tasks as game quests. Completing quests earns XP and Gold; failing costs them."
            usage="Add quests with the ADD QUEST button. Complete or Fail them from the Active tab to update your stats."
          >
            <h2 className="text-2xl font-display font-bold text-white tracking-tight flex items-center gap-3">
              <ScrollText className="w-6 h-6 text-primary" />
              QUEST LOG
            </h2>
          </InfoTooltip>
          <p className="text-muted-foreground mt-1 tracking-wider uppercase text-sm">System missions and daily tasks</p>
        </div>

        {/* Create Quest Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) setShowRecurrence(false); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider hover-glow">
              <Plus className="w-4 h-4 mr-2" /> ADD QUEST
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-white/10 sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display tracking-widest text-xl">Register Mission</DialogTitle>
              <DialogDescription className="sr-only">Create a new quest mission</DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-4">
                <FormField control={createForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <InfoTooltip what="The name of the task you want to track." fn="Displayed on your quest card and used as the primary identifier in your log." usage="Be specific — 'Read 20 pages of Atomic Habits' is better than 'Read'.">
                      <FormLabel>Quest Objective</FormLabel>
                    </InfoTooltip>
                    <FormControl><Input {...field} placeholder="e.g. 1 Hour of C++ Programming" className="bg-background/50" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={createForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <InfoTooltip what="Extra context about what this mission involves." fn="Shown beneath the quest title on your card as a supporting note." usage="Use this to clarify conditions, tools needed, or any rule you want to remember when completing the task.">
                      <FormLabel>Description <span className="text-muted-foreground">(optional)</span></FormLabel>
                    </InfoTooltip>
                    <FormControl>
                      <Textarea {...field} placeholder="What does this mission entail?" className="bg-background/50 resize-none" rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={createForm.control} name="category" render={({ field }) => (
                    <FormItem>
                      <InfoTooltip what="The life domain this quest belongs to." fn="Groups your quest under a stat category — Strength, Intelligence, Discipline, etc. Determines which stat grows when you complete it." usage="Pick the category that best matches the real-world skill or habit the quest is training.">
                        <FormLabel>Category</FormLabel>
                      </InfoTooltip>
                      <FormControl>
                        <CategoryCombobox value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={createForm.control} name="difficulty" render={({ field }) => (
                    <FormItem>
                      <InfoTooltip what="The difficulty tier of this quest." fn="Ranks run E → D → C → B → A → S. Higher ranks award significantly more XP and Gold on completion but also penalize more on failure." usage="Match the rank to the actual effort required. Under-ranking easy tasks wastes potential; over-ranking impossible tasks leads to repeated failures.">
                        <FormLabel>Rank</FormLabel>
                      </InfoTooltip>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.values(QuestDifficulty).map(r => (
                            <SelectItem key={r} value={r}>Rank {r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={createForm.control} name="statBoost" render={({ field }) => (
                  <FormItem>
                    <InfoTooltip what="Which character stat this quest boosts on completion." fn="Overrides the stat automatically assigned by the category. Useful when a quest spans multiple domains and you want to direct the XP to a specific stat." usage="Leave on Auto unless the default stat assignment doesn't reflect the primary skill being trained.">
                      <FormLabel>Stat Boost <span className="text-muted-foreground">(optional override)</span></FormLabel>
                    </InfoTooltip>
                    <Select onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)} value={field.value ?? "__none__"}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Auto (from category)" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Auto (from category)</SelectItem>
                        {Object.values(StatBoost).map(stat => {
                          const { label, icon: StatIcon, color } = STAT_DISPLAY[stat];
                          return (
                            <SelectItem key={stat} value={stat}>
                              <span className={`flex items-center gap-2 ${color}`}>
                                <StatIcon className="w-3.5 h-3.5" />
                                {label}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <StatBoostBadge category={watchedCreateCategory} statBoost={watchedCreateStatBoost} />
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={createForm.control} name="durationMinutes" render={({ field }) => (
                  <FormItem>
                    <InfoTooltip what="How long you plan to spend on this quest." fn="Logged in minutes. Used to track total time invested per category over time." usage="Set a realistic target. If a task consistently takes longer than the duration you set, increase it to keep your log accurate.">
                      <FormLabel>Duration (minutes)</FormLabel>
                    </InfoTooltip>
                    <FormControl><Input type="number" min={1} {...field} className="bg-background/50" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={createForm.control} name="targetAmount" render={({ field }) => (
                    <FormItem>
                      <InfoTooltip what="A numeric target that defines quest completion." fn="Pairs with Unit of Measure to create a trackable progress goal — e.g. 100 pages, 5 sets, 2000 words." usage="Use this for measurable tasks where time alone doesn't capture progress. Leave blank for time-only quests.">
                        <FormLabel>Completion Goal <span className="text-muted-foreground">(optional)</span></FormLabel>
                      </InfoTooltip>
                      <FormControl>
                        <Input type="number" min={1} placeholder="e.g. 100" {...field} value={field.value ?? ""} className="bg-background/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={createForm.control} name="amountUnit" render={({ field }) => (
                    <FormItem>
                      <InfoTooltip what="The unit for your completion goal." fn="Labels the Completion Goal number — e.g. pages, oz, reps, words, km. Shown on the quest card next to your progress." usage="Set this whenever you have a Completion Goal. Without a unit the number lacks context.">
                        <FormLabel>Unit of Measure <span className="text-muted-foreground">(optional)</span></FormLabel>
                      </InfoTooltip>
                      <FormControl>
                        <Input placeholder="e.g. oz, pages" {...field} className="bg-background/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <FormField control={createForm.control} name="deadline" render={({ field }) => (
                  <FormItem>
                    <InfoTooltip what="A hard cutoff date and optional time for this quest." fn="When the deadline passes, the quest is automatically marked as Failed, deducting XP and Gold as a penalty." usage="Set a date for real due dates. Add a time only when the mission has a specific cutoff hour.">
                      <FormLabel>
                        Deadline <span className="text-muted-foreground">(optional)</span>
                      </FormLabel>
                    </InfoTooltip>
                    <FormControl>
                      <DeadlineInputs value={field.value} onChange={field.onChange} />
                    </FormControl>
                    <p className="text-xs text-destructive/70">If set, the quest auto-fails when the deadline passes.</p>
                    <FormMessage />
                  </FormItem>
                )} />

                <button
                  type="button"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors w-full"
                  onClick={() => setShowRecurrence(v => !v)}
                >
                  <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showRecurrence && "rotate-180")} />
                  {showRecurrence ? "Hide" : "Show"} Recurrence Settings
                </button>

                {showRecurrence && (
                  <RecurrenceFieldsCreate control={createForm.control} watch={createForm.watch} />
                )}

                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 mt-4" disabled={createQuest.isPending}>
                  {createQuest.isPending ? "Registering..." : "Submit Mission"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Quest Dialog */}
      <Dialog open={!!editingQuest} onOpenChange={(open) => { if (!open) setEditingQuest(null); }}>
        <DialogContent className="glass-panel border-white/10 sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest text-xl">Edit Mission</DialogTitle>
            <DialogDescription className="sr-only">Edit an existing quest mission</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <InfoTooltip what="The name of the task you want to track." fn="Displayed on your quest card and used as the primary identifier in your log." usage="Be specific — 'Read 20 pages of Atomic Habits' is better than 'Read'.">
                    <FormLabel>Quest Objective</FormLabel>
                  </InfoTooltip>
                  <FormControl><Input {...field} className="bg-background/50" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={editForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <InfoTooltip what="Extra context about what this mission involves." fn="Shown beneath the quest title on your card as a supporting note." usage="Use this to clarify conditions, tools needed, or any rule you want to remember when completing the task.">
                    <FormLabel>Description <span className="text-muted-foreground">(optional)</span></FormLabel>
                  </InfoTooltip>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="What does this mission entail?" className="bg-background/50 resize-none" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="category" render={({ field }) => (
                  <FormItem>
                    <InfoTooltip what="The life domain this quest belongs to." fn="Groups your quest under a stat category — Strength, Intelligence, Discipline, etc. Determines which stat grows when you complete it." usage="Pick the category that best matches the real-world skill or habit the quest is training.">
                      <FormLabel>Category</FormLabel>
                    </InfoTooltip>
                    <FormControl>
                      <CategoryCombobox value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="difficulty" render={({ field }) => (
                  <FormItem>
                    <InfoTooltip what="The difficulty tier of this quest." fn="Ranks run E → D → C → B → A → S. Higher ranks award significantly more XP and Gold on completion but also penalize more on failure." usage="Match the rank to the actual effort required. Under-ranking easy tasks wastes potential; over-ranking impossible tasks leads to repeated failures.">
                      <FormLabel>Rank</FormLabel>
                    </InfoTooltip>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(QuestDifficulty).map(r => (
                          <SelectItem key={r} value={r}>Rank {r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={editForm.control} name="statBoost" render={({ field }) => (
                <FormItem>
                  <InfoTooltip what="Which character stat this quest boosts on completion." fn="Overrides the stat automatically assigned by the category. Useful when a quest spans multiple domains and you want to direct the XP to a specific stat." usage="Leave on Auto unless the default stat assignment doesn't reflect the primary skill being trained.">
                    <FormLabel>Stat Boost <span className="text-muted-foreground">(optional override)</span></FormLabel>
                  </InfoTooltip>
                  <Select onValueChange={(v) => field.onChange(v === "__none__" ? null : v)} value={field.value ?? "__none__"}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Auto (from category)" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Auto (from category)</SelectItem>
                      {Object.values(StatBoost).map(stat => {
                        const { label, icon: StatIcon, color } = STAT_DISPLAY[stat];
                        return (
                          <SelectItem key={stat} value={stat}>
                            <span className={`flex items-center gap-2 ${color}`}>
                              <StatIcon className="w-3.5 h-3.5" />
                              {label}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <StatBoostBadge category={watchedEditCategory ?? ""} statBoost={watchedEditStatBoost} />
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={editForm.control} name="durationMinutes" render={({ field }) => (
                <FormItem>
                  <InfoTooltip what="How long you plan to spend on this quest." fn="Logged in minutes. Used to track total time invested per category over time." usage="Set a realistic target. If a task consistently takes longer than the duration you set, increase it to keep your log accurate.">
                    <FormLabel>Duration (minutes)</FormLabel>
                  </InfoTooltip>
                  <FormControl><Input type="number" min={1} {...field} className="bg-background/50" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="targetAmount" render={({ field }) => (
                  <FormItem>
                    <InfoTooltip what="A numeric target that defines quest completion." fn="Pairs with Unit of Measure to create a trackable progress goal — e.g. 100 pages, 5 sets, 2000 words." usage="Use this for measurable tasks where time alone doesn't capture progress. Leave blank for time-only quests.">
                      <FormLabel>Completion Goal <span className="text-muted-foreground">(optional)</span></FormLabel>
                    </InfoTooltip>
                    <FormControl>
                      <Input type="number" min={1} placeholder="e.g. 100" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)} className="bg-background/50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="amountUnit" render={({ field }) => (
                  <FormItem>
                    <InfoTooltip what="The unit for your completion goal." fn="Labels the Completion Goal number — e.g. pages, oz, reps, words, km. Shown on the quest card next to your progress." usage="Set this whenever you have a Completion Goal. Without a unit the number lacks context.">
                      <FormLabel>Unit of Measure <span className="text-muted-foreground">(optional)</span></FormLabel>
                    </InfoTooltip>
                    <FormControl>
                      <Input placeholder="e.g. oz, pages" {...field} value={field.value ?? ""} className="bg-background/50" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={editForm.control} name="deadline" render={({ field }) => (
                <FormItem>
                  <InfoTooltip what="A hard cutoff date and optional time for this quest." fn="When the deadline passes, the quest is automatically marked as Failed, deducting XP and Gold as a penalty." usage="Set a date for real due dates. Add a time only when the mission has a specific cutoff hour.">
                    <FormLabel>
                      Deadline <span className="text-muted-foreground">(optional)</span>
                    </FormLabel>
                  </InfoTooltip>
                  <FormControl>
                    <DeadlineInputs value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <p className="text-xs text-destructive/70">If set, the quest auto-fails when the deadline passes.</p>
                  <FormMessage />
                </FormItem>
              )} />

              <button
                type="button"
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors w-full"
                onClick={() => setShowEditRecurrence(v => !v)}
              >
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showEditRecurrence && "rotate-180")} />
                {showEditRecurrence ? "Hide" : "Show"} Recurrence Settings
              </button>

              {showEditRecurrence && (
                <RecurrenceFieldsEdit control={editForm.control} watch={editForm.watch} />
              )}

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 mt-4"
                disabled={updateQuest.isPending || completeQuestMutation.isPending || failQuestMutation.isPending}
              >
                {updateQuest.isPending ? "Updating..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="active" className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
          <TabsList className="bg-card border border-white/5 w-full justify-start rounded-xl p-1">
            <InfoTooltip
              what="ACTIVE tab — quests currently in progress."
              fn="Lists all quests that have not yet been completed, failed, or paused."
              usage="Complete or Fail a quest from here. Use Pause to temporarily remove it from your active rotation."
            >
              <TabsTrigger value="active" className="rounded-lg tracking-widest font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-primary">ACTIVE</TabsTrigger>
            </InfoTooltip>
          <InfoTooltip
            what="CLEARED tab — successfully completed quests."
            fn="Shows every quest you have marked as complete. Completion awards XP and Gold."
            usage="Review your cleared missions here. Delete old entries to keep the log clean."
          >
            <TabsTrigger value="completed" className="rounded-lg tracking-widest font-semibold data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">CLEARED</TabsTrigger>
          </InfoTooltip>
          <InfoTooltip
            what="FAILED tab — quests you did not complete."
            fn="Lists quests that were manually failed or auto-failed when their deadline passed."
            usage="Review failed quests to spot patterns. Each failure cost you XP and Gold."
          >
            <TabsTrigger value="failed" className="rounded-lg tracking-widest font-semibold data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive">FAILED</TabsTrigger>
          </InfoTooltip>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-xs border-white/10 text-muted-foreground hover:text-white hover:border-white/30"
            onClick={() => setShowAll(v => !v)}
          >
            {showAll ? "Upcoming only" : "Show all quests"}
          </Button>
        </div>

        {(['active', 'completed', 'failed'] as const).map((status) => (
          <TabsContent key={status} value={status} className="space-y-4">
            {quests.filter(q => q.status === status).length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/10 rounded-xl glass-panel">
                <p className="text-muted-foreground tracking-widest">
                  {status === 'active' && !showAll ? "NO UPCOMING MISSIONS — USE \"SHOW ALL QUESTS\" TO SEE FAR-FUTURE QUESTS" : "NO MISSIONS FOUND"}
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {quests.filter(q => q.status === status).map(quest => {
                  const recLabel = getRecurrenceLabel(quest.recurrence as RecurrenceConfig | null);
                  const deadlineLabel = formatDeadlineLabel(quest.deadline, quest.status);
                  const deadlineTone = getDeadlineTone(quest.deadline, quest.status);
                  return (
                    <Card key={quest.id} className={cn("glass-panel overflow-hidden group relative", quest.isPaused && "opacity-60", status === "active" && isNearDeadline(quest.deadline) && "animate-warning-flash")}>
                      <QuestCompleteEffect
                        active={completingQuestId === quest.id}
                        onDone={() => setCompletingQuestId(null)}
                      />
                      <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            {(() => {
                              const tip = rankTooltips[quest.difficulty];
                              return tip ? (
                                <InfoTooltip what={tip.what} fn={tip.fn} usage={tip.usage}>
                                  <Badge className={`${difficultyColors[quest.difficulty]} px-2 py-0 uppercase tracking-widest font-bold border rounded-sm`}>
                                    Rank {quest.difficulty}
                                  </Badge>
                                </InfoTooltip>
                              ) : (
                                <Badge className={`${difficultyColors[quest.difficulty]} px-2 py-0 uppercase tracking-widest font-bold border rounded-sm`}>
                                  Rank {quest.difficulty}
                                </Badge>
                              );
                            })()}
                            <Badge variant="outline" className="text-muted-foreground border-white/10 bg-white/5">
                              {quest.category}
                            </Badge>
                            {recLabel && (
                              <InfoTooltip
                                what="Recurrence — this quest repeats automatically."
                                fn="After completion or failure, the quest resets and reappears in your Active list on the next scheduled date."
                                usage="Set recurring quests for daily habits or weekly reviews so they auto-regenerate without manual re-entry."
                              >
                                <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-none flex items-center gap-1">
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  {recLabel}
                                </Badge>
                              </InfoTooltip>
                            )}
                            {quest.isPaused && (
                              <Badge variant="secondary" className="bg-sky-500/10 text-sky-400 border-none flex items-center gap-1">
                                <Pause className="w-2.5 h-2.5" />
                                Paused
                              </Badge>
                            )}
                            {(() => {
                              const statKey = getEffectiveStat(quest.category, quest.statBoost);
                              const { label, icon: StatIcon, color } = STAT_DISPLAY[statKey] ?? STAT_DISPLAY["strength"];
                              return (
                                <InfoTooltip
                                  what={`Stat Boost: ${label} — the attribute this quest trains.`}
                                  fn="Completing this quest contributes XP toward your character's stat distribution. Each stat represents a real-world skill area."
                                  usage="Create quests in matching categories to build balanced stats. Override the auto-assignment via the Stat Boost field when editing."
                                >
                                  <span className={`flex items-center gap-1 text-xs ${color}`}>
                                    <StatIcon className="w-3 h-3" />
                                    {label}
                                  </span>
                                </InfoTooltip>
                              );
                            })()}
                          </div>
                          <h3 className="text-xl font-bold text-white font-sans">{quest.name}</h3>
                          {quest.description && (
                            <p className="text-sm text-muted-foreground leading-relaxed">{quest.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium flex-wrap">
                            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {quest.durationMinutes}m</span>
                            {deadlineLabel && deadlineTone && (
                              <span className={cn("flex items-center gap-1.5", deadlineTone)}>
                                <CalendarIcon className="w-4 h-4" />
                                <span>{deadlineLabel === "FAILED: TIME EXPIRED" ? deadlineLabel : `Due: ${deadlineLabel}`}</span>
                              </span>
                            )}
                            <span className="flex items-center gap-1.5 text-primary">
                              <Trophy className="w-4 h-4" />
                              {Math.floor((RANK_BASE_REWARDS[quest.difficulty]?.xp ?? 50) + quest.durationMinutes * DURATION_BONUS_PER_MINUTE.xp)} XP
                              <ShadowIntel title="Shadow Intel" intel={SYSTEM_INTEL.GATE_FRAGMENTS} detail="Successful quest completion triggers a 15% fragment roll. 3 fragments forge the Gate Key for a new Boss." />
                            </span>
                            <InfoTooltip
                              what="Gold Reward — currency awarded on completion."
                              fn="Gold is spent in the System Shop to purchase real-life rewards."
                              usage="Complete quests to earn Gold. Failing deducts Gold. Spend it in the Shop."
                            >
                              <span className="flex items-center gap-1.5 text-gold"><Coins className="w-4 h-4" /> {Math.floor((RANK_BASE_REWARDS[quest.difficulty]?.gold ?? 25) + quest.durationMinutes * DURATION_BONUS_PER_MINUTE.gold)} G</span>
                            </InfoTooltip>
                            {quest.targetAmount != null && (
                              <InfoTooltip
                                what="Completion Goal — the measurable target for this quest."
                                fn="A numeric target you must hit (e.g. 100 pages, 10 oz). Tracks quantified progress."
                                usage="Use this to set a concrete benchmark. Hit the target before marking the quest complete."
                              >
                                <span className="flex items-center gap-1.5 text-cyan-400">
                                  <Target className="w-4 h-4" />
                                  Target: {quest.targetAmount}{quest.amountUnit ? ` ${quest.amountUnit}` : ""}
                                </span>
                              </InfoTooltip>
                            )}
                          </div>
                        </div>

                        <div className="flex w-full sm:w-auto gap-2 flex-wrap sm:flex-nowrap">
                          {status === 'active' && (
                            <>
                              <InfoTooltip
                                what="Edit — modify this quest's details."
                                fn="Opens the edit form where you can change the name, difficulty, duration, category, and recurrence."
                                usage="Use to correct mistakes or adjust a quest as your goals evolve."
                              >
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className="h-11 w-11 border-primary/30 text-primary/70 hover:text-primary hover:border-primary/60 hover:bg-primary/10"
                                  onClick={() => setEditingQuest(quest)}
                                  title="Edit quest"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </InfoTooltip>
                              <InfoTooltip
                                what={quest.isPaused ? "Resume — reactivate this paused quest." : "Pause — temporarily suspend this quest."}
                                fn={quest.isPaused ? "Moves the quest back to Active so it can be completed or failed." : "Hides the quest from your active rotation without deleting it."}
                                usage={quest.isPaused ? "Resume when you are ready to tackle the quest again." : "Pause seasonal or low-priority quests you don't want to fail."}
                              >
                                <Button
                                  variant="outline"
                                  size="icon"
                                  className={cn(
                                    "border-sky-500/30 hover:border-sky-500/60 hover:bg-sky-500/10",
                                    quest.isPaused ? "text-sky-400" : "text-sky-400/60 hover:text-sky-400"
                                  )}
                                  onClick={() => onTogglePause(quest)}
                                  title={quest.isPaused ? "Resume quest" : "Pause quest"}
                                  disabled={updateQuest.isPending}
                                >
                                  {quest.isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                                </Button>
                              </InfoTooltip>
                              <InfoTooltip
                                what="Fail — mark this quest as failed."
                                fn="Immediately deducts XP and Gold as a penalty. Quest moves to the Failed tab."
                                usage="Press if you know you won't complete the quest. Repeated failures increase the penalty streak."
                              >
                                <Button
                                  variant="outline"
                                  className="flex-1 sm:flex-none border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                                  onClick={() => onFail(quest.id)}
                                  disabled={failQuestMutation.isPending || completeQuestMutation.isPending}
                                >
                                  <XCircle className="w-4 h-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Fail</span>
                                </Button>
                              </InfoTooltip>
                              <InfoTooltip
                                what="Clear — mark this quest as successfully completed."
                                fn="Awards the listed XP and Gold immediately. Quest moves to the Cleared tab."
                                usage="Press only when you have genuinely finished the real-world task."
                              >
                                <Button
                                  className="flex-1 sm:flex-none bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 hover:text-green-300"
                                  onClick={() => onComplete(quest.id)}
                                  disabled={failQuestMutation.isPending || completeQuestMutation.isPending}
                                >
                                  <CheckCircle2 className="w-4 h-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Clear</span>
                                </Button>
                              </InfoTooltip>
                            </>
                          )}
                          {(status === 'completed' || status === 'failed') && (
                            <InfoTooltip
                              what="Delete — permanently remove this quest record."
                              fn="Deletes the quest entry from the system. This cannot be undone."
                              usage="Use to clean up your log after reviewing completed or failed quests."
                            >
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 border-destructive/20 text-destructive/60 hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10"
                                onClick={() => onDelete(quest.id)}
                                title="Delete quest"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </InfoTooltip>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <LevelUpCeremony
        open={levelUpData !== null}
        newLevel={levelUpData?.newLevel ?? 0}
        statDeltas={levelUpData?.statDeltas}
        onDismiss={() => setLevelUpData(null)}
      />

      <RankUpNotification
        open={rankUpData !== null}
        statName={rankUpData?.statName ?? ""}
        statValue={rankUpData?.statValue ?? 0}
        onDismiss={() => setRankUpData(null)}
      />

      <GateFragmentDropAnimation
        active={fragmentDropData !== null}
        fragmentCount={fragmentDropData?.count ?? 0}
        onDone={() => setFragmentDropData(null)}
      />

      <AwakeningOverlay
        open={awakeningOpen}
        onDismiss={() => setAwakeningOpen(false)}
      />
      </div>
      )}
    </div>
  );
}
