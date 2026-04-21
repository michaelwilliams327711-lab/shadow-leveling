import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  useGetCharacter, 
  useGetActivityHeatmap, 
  useGetDailyRngEvent, 
  useDailyCheckin,
  dailyCheckin,
  useGetQuestLog,
  getGetCharacterQueryKey,
  getGetActivityHeatmapQueryKey,
  type QuestLogEntry,
  useListBadHabits,
  useRecordCleanDay,
  useGetCorruptionConfig,
  getListBadHabitsQueryKey,
  useListQuests,
  useAcknowledgeAwakening,
} from "@workspace/api-client-react";
import { AwakeningOverlay } from "@/components/AwakeningOverlay";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";

import { Flame, Coins, Shield, Brain, Dumbbell, Target, Sparkles, AlertCircle, Sword, SkullIcon, TrendingDown, ShieldAlert, KeyRound, Zap, User, MapPin, Lock } from "lucide-react";



import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatRadar } from "@/components/StatRadar";
import { Heatmap } from "@/components/Heatmap";
import { useToast } from "@/hooks/use-toast";
import { InfoTooltip } from "@/components/InfoTooltip";
import { StreakMilestoneBanner } from "@/components/StreakMilestoneBanner";
import { LevelUpCeremony } from "@/components/LevelUpCeremony";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { playAriseClick } from "@/lib/sounds";
import { STAT_META } from "@workspace/shared";

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 14) return "1 week ago";
  return `${Math.floor(diffDay / 7)} weeks ago`;
}

function getOutcomeBadge(entry: QuestLogEntry) {
  const actionType = entry.actionType;
  if (actionType === "BOSS_DEFEATED") {
    return { label: "BOSS DEFEATED", className: "bg-amber-500/20 text-amber-300 border border-amber-500/40" };
  }
  if (actionType === "MISSED_DAY") {
    return { label: "MISSED", className: "bg-slate-500/20 text-slate-400 border border-slate-500/40" };
  }
  if (entry.outcome === "completed") {
    return { label: "QUEST CLEARED", className: "bg-green-500/20 text-green-400 border border-green-500/40" };
  }
  return { label: "FAILED", className: "bg-red-500/20 text-red-400 border border-red-500/40" };
}

function CharacterStatsSkeleton() {
  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <Skeleton className="h-12 w-72 rounded-lg" />
          <Skeleton className="h-5 w-48 rounded" />
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Skeleton className="h-8 w-24 rounded" />
            <Skeleton className="h-4 w-40 rounded" />
          </div>
          <Skeleton className="h-14 w-14 rounded-xl" />
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="glass-panel rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
            <Skeleton className="h-7 w-12 rounded" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6 space-y-3">
          <Skeleton className="h-6 w-32 rounded" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <div className="glass-panel rounded-2xl p-6 space-y-3">
          <Skeleton className="h-6 w-36 rounded" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

const STAT_CAP = 110_000;

const STREAK_MILESTONES = [7, 14, 30, 60, 100];

export default function Dashboard() {
  const { data: character, isLoading: charLoading, isError: charError, refetch: refetchChar } = useGetCharacter();
  const { data: heatmap } = useGetActivityHeatmap();
  const { data: rngEvent } = useGetDailyRngEvent();
  const { data: questLogRaw } = useGetQuestLog({ query: { refetchInterval: 60_000 } });
  const { data: badHabits } = useListBadHabits();
  const { data: corruptionConfigData } = useGetCorruptionConfig();
  const { data: activeQuests } = useListQuests({ query: { staleTime: 60_000 } });
  const recordCleanDayMutation = useRecordCleanDay();
  const checkinMutation = useDailyCheckin({
    mutation: {
      mutationFn: () => dailyCheckin({ headers: { "x-local-date": new Date().toLocaleDateString("en-CA") } }),
    },
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const [ariseAnimating, setAriseAnimating] = useState(false);
  const [ariseStreakTick, setAriseStreakTick] = useState<number | null>(null);
  const [streakMilestone, setStreakMilestone] = useState<number | null>(null);
  const [levelUpData, setLevelUpData] = useState<{ newLevel: number } | null>(null);
  const [showAwakening, setShowAwakening] = useState(false);
  const acknowledgeAwakeningMutation = useAcknowledgeAwakening();

  useEffect(() => {
    if (character && character.vocationLevel >= 1 && !character.hasSeenAwakening) {
      setShowAwakening(true);
    }
  }, [character?.vocationLevel, character?.hasSeenAwakening]);

  const handleDismissAwakening = () => {
    setShowAwakening(false);
    acknowledgeAwakeningMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
      },
    });
  };

  const questLog = questLogRaw?.slice(0, 10) ?? [];

  const todayLocal = new Date().toLocaleDateString("en-CA");
  const hasCheckedInToday = character
    ? (character.lastCheckin ? character.lastCheckin.split("T")[0] === todayLocal : false)
    : false;

  const handleCheckin = () => {
    if (hasCheckedInToday || checkinMutation.isPending || recordCleanDayMutation.isPending) return;

    if (!reduced) playAriseClick();
    setAriseAnimating(true);
    setTimeout(() => setAriseAnimating(false), 1400);

    if ((badHabits?.length ?? 0) > 0) {
      recordCleanDayMutation.mutate(undefined, {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListBadHabitsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
          if (res.purified) {
            toast({
              title: "PURIFICATION COMPLETE",
              description: "All bad habits maintained a clean streak. Corruption reset to 0.",
              className: "border-green-600 bg-green-950/80 text-green-200",
            });
          }
        },
      });
    }
    checkinMutation.mutate(undefined, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetActivityHeatmapQueryKey() });

        setAriseStreakTick(res.streak);
        setTimeout(() => setAriseStreakTick(null), 2000);

        toast({
          title: "ARISE COMPLETE",
          description: `Streak: ${res.streak} | Multiplier: ${res.multiplier}x`,
          className: "bg-primary/20 border-primary text-primary-foreground",
        });

        if (res.leveledUp && res.newLevel) {
          setTimeout(() => setLevelUpData({ newLevel: res.newLevel! }), 1200);
        }

        if (STREAK_MILESTONES.includes(res.streak)) {
          setTimeout(() => setStreakMilestone(res.streak), 800);
        }

        if (res.milestoneBonus) {
          setTimeout(() => {
            toast({
              title: "THRESHOLD REACHED",
              description: `Bonus Rewards: +${res.milestoneBonusXp} XP | +${res.milestoneBonusGold} Gold`,
              className: "bg-destructive/20 border-destructive text-destructive-foreground",
            });
          }, 1000);
        }
      }
    });
  };

  if (charLoading) {
    return <CharacterStatsSkeleton />;
  }

  if (charError || !character) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground tracking-widest uppercase text-sm">System Error — Status Window Offline</p>
        <Button onClick={() => refetchChar()} variant="outline" className="border-white/20 tracking-widest">
          Retry Connection
        </Button>
      </div>
    );
  }

  const xpPercent = character.xpToNextLevel > 0
    ? Math.min(100, Math.round((character.xp / character.xpToNextLevel) * 100))
    : 100;

  const failStreak = character.failStreak ?? 0;
  const penaltyMultiplier = character.penaltyMultiplier ?? 1.0;

  const failStreakTier = failStreak >= 10 ? "max" : failStreak >= 7 ? "high" : failStreak >= 4 ? "mid" : failStreak >= 2 ? "low" : "none";

  const failStreakColors: Record<string, string> = {
    none: "text-muted-foreground",
    low: "text-amber-500",
    mid: "text-orange-400",
    high: "text-red-500",
    max: "text-red-600",
  };

  const failStreakBorderColors: Record<string, string> = {
    none: "border-white/10",
    low: "border-amber-500/30",
    mid: "border-orange-500/40",
    high: "border-red-500/50",
    max: "border-red-600/60",
  };

  const stats = [
    { name: STAT_META.strength.label,   val: character.strength,                      icon: Dumbbell, color: "text-red-400",    barColor: "bg-red-400"    },
    { name: STAT_META.spirit.label,     val: character.spirit ?? 0,                                       icon: Sparkles, color: "text-pink-400",   barColor: "bg-pink-400"   },
    { name: STAT_META.endurance.label,  val: character.endurance,                     icon: Shield,   color: "text-green-400",  barColor: "bg-green-400"  },
    { name: STAT_META.intellect.label,  val: character.intellect,                     icon: Brain,    color: "text-blue-400",   barColor: "bg-blue-400"   },
    { name: STAT_META.discipline.label, val: character.discipline,                    icon: Target,   color: "text-purple-400", barColor: "bg-purple-400" },
  ];

  const corruption = character.corruption ?? 0;
  const thresholds = corruptionConfigData?.thresholds ?? { high: 80, mid: 50, low: 20 };
  const corruptionTier = corruption >= thresholds.high ? "high" : corruption >= thresholds.mid ? "mid" : corruption >= thresholds.low ? "low" : "none";
  const corruptionOverlayClass = corruptionTier === "high" ? "corruption-high" : corruptionTier === "mid" ? "corruption-mid" : corruptionTier === "low" ? "corruption-low" : "";

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Daily Arise screen darken overlay */}
      <AnimatePresence>
        {ariseAnimating && !reduced && (
          <motion.div
            key="arise-screen-darken"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] pointer-events-none"
            style={{ background: "radial-gradient(ellipse at center, rgba(124,58,237,0.18) 0%, rgba(0,0,0,0.55) 100%)" }}
          />
        )}
      </AnimatePresence>

      {/* Header & Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight mb-2">STATUS WINDOW</h1>
          <p className="text-muted-foreground text-lg tracking-widest uppercase">Player: <span className="text-primary">{character.name}</span></p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <InfoTooltip
            what="Gold — the in-game currency earned by completing quests."
            fn="Accumulates as you clear missions. Higher-rank quests award more Gold."
            usage="Spend it in the Shop to claim real-life rewards you define."
          >
            <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3">
              <Coins className="text-gold w-5 h-5" />
              <span className="text-gold font-stat font-bold text-xl">{character.gold.toLocaleString()} G</span>
            </div>
          </InfoTooltip>
          <InfoTooltip
            what="Daily check-in streak — consecutive days you've logged in and checked in."
            fn="Builds a multiplier (up to 3×) that boosts XP and Gold rewards for completed quests. Tiers: 3 days → 1.5×, 7 days → 2×, 14 days → 2.5×, 30+ days → 3×."
            usage="Hit the 'Daily Arise' button every day to keep your streak alive and grow your multiplier."
          >
            <div
              className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 relative overflow-hidden"
              style={character.streak > 0 ? {
                border: "1px solid rgba(249,115,22,0.5)",
                boxShadow: "0 0 16px rgba(249,115,22,0.25)",
              } : { border: "1px solid rgba(249,115,22,0.2)" }}
            >
              <AnimatePresence>
                {ariseStreakTick !== null && !reduced && (
                  <motion.div
                    key="streak-tick"
                    className="absolute inset-0 bg-orange-500/20 rounded-xl pointer-events-none"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: [0, 1, 0.6, 0] }}
                    transition={{ duration: 0.8 }}
                  />
                )}
              </AnimatePresence>
              <motion.div
                animate={character.streak > 0 && !reduced ? {
                  filter: [
                    "drop-shadow(0 0 4px rgba(249,115,22,0.6))",
                    "drop-shadow(0 0 10px rgba(249,115,22,0.9))",
                    "drop-shadow(0 0 4px rgba(249,115,22,0.6))",
                  ],
                } : {}}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Flame className={`w-5 h-5 ${character.streak > 0 ? "text-orange-400" : "text-orange-600"}`} />
              </motion.div>
              <div className="flex flex-col">
                <motion.span
                  key={ariseStreakTick ?? character.streak}
                  initial={ariseStreakTick !== null && !reduced ? { scale: 1.4, color: "#fb923c" } : {}}
                  animate={{ scale: 1, color: character.streak > 0 ? "#fb923c" : "#9a3412" }}
                  transition={{ type: "spring", stiffness: 300, damping: 12 }}
                  className="font-stat font-bold text-xl leading-tight"
                >
                  {(ariseStreakTick ?? character.streak)} DAY STREAK
                </motion.span>
                {character.longestStreak > 0 && (
                  <span className="text-[10px] text-orange-600/70 tracking-wider">BEST: {character.longestStreak}</span>
                )}
              </div>
              {character.multiplier > 1 && (
                <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
                  {character.multiplier}x
                </span>
              )}
            </div>
          </InfoTooltip>
          <InfoTooltip
            what="Gate Fragments — dimensional essences that drop from completed quests."
            fn="Each quest completion has a 15% chance to drop a Gate Fragment. Collect 3 to forge a Gate Key and enter the Boss Arena."
            usage="Head to the Boss Arena once you have 3 fragments to challenge a boss."
          >
            <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 border border-pink-500/30">
              <KeyRound className="text-pink-400 w-5 h-5" />
              <span className="text-pink-300 font-stat font-bold text-xl">
                {character.gateFragments} / 3 Key
              </span>
            </div>
          </InfoTooltip>
          {failStreak > 0 && (
            <InfoTooltip
              what="Fail streak — consecutive quest failures or expired deadlines."
              fn="Applies a penalty multiplier that reduces XP and Gold earned from completed quests."
              usage="Complete any quest successfully to reset the fail streak and remove the penalty."
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`glass-panel px-4 py-2 rounded-xl flex items-center gap-3 border ${failStreakBorderColors[failStreakTier]}`}
              >
                <SkullIcon className={`w-5 h-5 ${failStreakColors[failStreakTier]}`} />
                <div className="flex flex-col">
                  <span className={`font-bold text-base leading-tight ${failStreakColors[failStreakTier]}`}>{failStreak} Fail Streak</span>
                  <span className={`text-xs leading-tight ${failStreakColors[failStreakTier]} opacity-80`}>{penaltyMultiplier}x penalty</span>
                </div>
              </motion.div>
            </InfoTooltip>
          )}
        </div>
      </div>

      {rngEvent?.hasEvent && rngEvent.event && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/50 rounded-xl p-4 flex items-start gap-4 shadow-[0_0_20px_rgba(124,58,237,0.2)]"
        >
          <Sparkles className="w-6 h-6 text-primary mt-1" />
          <div>
            <h3 className="font-display font-bold text-lg text-white">{rngEvent.event.title}</h3>
            <p className="text-muted-foreground text-sm font-sans">{rngEvent.event.description}</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Level & Checkin */}
        <div className="space-y-8 lg:col-span-2">
          <Card className={`glass-panel overflow-hidden relative ${corruptionOverlayClass}`}>
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Sword className="w-48 h-48" />
            </div>
            <CardContent className="p-8 relative z-10">
              <div className="flex justify-between items-baseline mb-4">
                <InfoTooltip
                  what="Character Level — your overall power rank in the system."
                  fn="Increases as you accumulate XP from completed quests. Higher levels unlock greater stat ceilings."
                  usage="Complete quests regularly to gain XP and level up faster."
                >
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl text-muted-foreground font-display tracking-widest">LEVEL</span>
                    <span className="text-6xl font-stat font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{character.level}</span>
                  </div>
                </InfoTooltip>
                <InfoTooltip
                  what="Experience Points (XP) — progress toward the next level."
                  fn="Earned by completing quests. Amount varies by rank and active multipliers."
                  usage="Fill the bar to level up. Streak bonuses and high-rank quests accelerate progress."
                >
                  <div className="text-right">
                    <span className="text-primary font-stat font-bold text-xl">{character.xp.toLocaleString()}</span>
                    <span className="text-muted-foreground text-sm font-stat"> / {character.xpToNextLevel.toLocaleString()} XP</span>
                  </div>
                </InfoTooltip>
              </div>
              
              <InfoTooltip
                what="XP Progress Bar — how close you are to the next level."
                fn={`XP required for this level = (2×${character.level} − 1) × 10 = ${character.xpToNextLevel} XP. Formula: Level = ⌊√(TotalXP / 10)⌋ + 1.`}
                usage="Keep completing quests to push the bar to 100% and trigger a level-up."
              >
                <div className="relative h-4 bg-secondary rounded-full overflow-hidden mb-2 border border-white/5 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${xpPercent}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary/50 to-primary rounded-full shadow-[0_0_10px_rgba(124,58,237,0.8)]"
                  />
                </div>
              </InfoTooltip>
              <div className="flex justify-between items-center text-[11px] text-muted-foreground/60 font-mono mb-6">
                <span>LVL {character.level} → LVL {character.level + 1}</span>
                <span className="text-primary/70">
                  {(character.xpToNextLevel - character.xp).toLocaleString()} XP remaining
                </span>
              </div>

              <div className="relative">
                <AnimatePresence>
                  {ariseAnimating && !reduced && (
                    <motion.div
                      key="arise-glow"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1.15 }}
                      exit={{ opacity: 0, scale: 1.3 }}
                      transition={{ duration: 0.4 }}
                      className="absolute inset-0 rounded-lg pointer-events-none"
                      style={{ background: "radial-gradient(ellipse at center, rgba(124,58,237,0.6) 0%, transparent 70%)", zIndex: 0 }}
                    />
                  )}
                </AnimatePresence>
                <motion.div
                  animate={ariseAnimating && !reduced ? { scale: [1, 0.96, 1.02, 1] } : {}}
                  transition={{ duration: 0.4 }}
                  className="relative z-10"
                >
                  <Button 
                    onClick={handleCheckin}
                    disabled={hasCheckedInToday || checkinMutation.isPending || recordCleanDayMutation.isPending}
                    className="w-full h-14 text-lg font-bold tracking-widest uppercase bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] transition-all duration-300 disabled:opacity-60"
                  >
                    {checkinMutation.isPending || recordCleanDayMutation.isPending
                      ? "Connecting..."
                      : hasCheckedInToday
                        ? "ARISE COMPLETE"
                        : "DAILY ARISE"}
                  </Button>
                </motion.div>
                {ariseAnimating && !reduced && (
                  <motion.div
                    className="absolute inset-0 rounded-lg pointer-events-none border-2 border-primary"
                    initial={{ opacity: 1, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.3 }}
                    transition={{ duration: 0.8 }}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="font-display tracking-widest text-lg">
                <InfoTooltip
                  what="Activity Record — a heatmap of your daily quest engagement over the past year."
                  fn="Each cell represents one day. Darker purple means more quests completed that day. Below the heatmap, your 10 most recent quest events are listed with outcome, XP/Gold changes, and timestamps."
                  usage="Use it to spot gaps in your consistency and review recent wins or failures at a glance."
                >
                  <span className="cursor-default">Hunter's Log</span>
                </InfoTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Heatmap data={heatmap || []} />
              {questLog.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">System Log</p>
                  <div className="max-h-64 overflow-y-auto space-y-1 pr-1 hide-scrollbar">
                    {questLog.map((entry) => {
                      const badge = getOutcomeBadge(entry);
                      const xpPositive = entry.xpChange >= 0;
                      const goldPositive = entry.goldChange >= 0;
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/3 border border-white/5 hover:bg-white/5 transition-colors"
                        >
                          <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded shrink-0 ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="flex-1 text-sm text-white/80 truncate font-sans">{entry.questName}</span>
                          <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
                            <span className={xpPositive ? "text-primary" : "text-red-400"}>
                              {xpPositive ? "+" : ""}{entry.xpChange} XP
                            </span>
                            <span className={goldPositive ? "text-gold" : "text-red-400"}>
                              {goldPositive ? "+" : ""}{entry.goldChange} G
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-sans">
                            {formatRelativeTime(entry.occurredAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {questLog.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2 font-sans">No quest activity yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Stats */}
        <div className="space-y-8">
          {/* Fatigue Meter */}
          {(() => {
            const now = Date.now();
            const questsWithDeadlines = (activeQuests ?? []).filter(
              (q) => q.deadline && q.status === "active"
            );
            let nearestMs = Infinity;
            let nearestName = "";
            for (const q of questsWithDeadlines) {
              const ms = new Date(q.deadline!).getTime() - now;
              if (ms < nearestMs) { nearestMs = ms; nearestName = q.name; }
            }
            const hoursLeft = nearestMs / 3_600_000;
            let fatigue = 0;
            if (questsWithDeadlines.length === 0 || nearestMs === Infinity) {
              fatigue = 0;
            } else if (nearestMs <= 0) {
              fatigue = 100;
            } else if (hoursLeft <= 24) {
              fatigue = Math.round(90 + ((24 - hoursLeft) / 24) * 10);
            } else if (hoursLeft <= 48) {
              fatigue = Math.round(70 + ((48 - hoursLeft) / 24) * 20);
            } else if (hoursLeft <= 72) {
              fatigue = Math.round(50 + ((72 - hoursLeft) / 24) * 20);
            } else if (hoursLeft <= 168) {
              fatigue = Math.round(15 + ((168 - hoursLeft) / 96) * 35);
            } else {
              fatigue = Math.round(Math.min(15, (168 / hoursLeft) * 15));
            }
            fatigue = Math.min(100, Math.max(0, fatigue));

            const SEGMENTS = 10;
            const litCount = Math.round((fatigue / 100) * SEGMENTS);
            const radius = 52;
            const cx = 70;
            const cy = 70;
            const strokeW = 10;
            const gapDeg = 8;
            const segDeg = (360 - SEGMENTS * gapDeg) / SEGMENTS;

            function segColor(i: number): string {
              if (i >= litCount) return "rgba(255,255,255,0.07)";
              const tier = litCount / SEGMENTS;
              if (tier <= 0.3) return "#22d3ee";
              if (tier <= 0.55) return "#a78bfa";
              if (tier <= 0.75) return "#f97316";
              return "#ef4444";
            }

            function describeArc(startDeg: number, endDeg: number): string {
              const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
              const x1 = cx + radius * Math.cos(toRad(startDeg));
              const y1 = cy + radius * Math.sin(toRad(startDeg));
              const x2 = cx + radius * Math.cos(toRad(endDeg));
              const y2 = cy + radius * Math.sin(toRad(endDeg));
              const large = endDeg - startDeg > 180 ? 1 : 0;
              return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
            }

            const fatigueLabel =
              fatigue >= 90 ? "CRITICAL" :
              fatigue >= 70 ? "ELEVATED" :
              fatigue >= 40 ? "MODERATE" :
              fatigue > 0   ? "LOW" : "NOMINAL";

            const labelColor =
              fatigue >= 90 ? "#ef4444" :
              fatigue >= 70 ? "#f97316" :
              fatigue >= 40 ? "#a78bfa" : "#22d3ee";

            let timeLabel = "";
            if (questsWithDeadlines.length > 0 && nearestMs !== Infinity && nearestMs > 0) {
              const h = Math.floor(hoursLeft);
              const m = Math.floor((hoursLeft - h) * 60);
              timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;
            } else if (nearestMs <= 0 && questsWithDeadlines.length > 0) {
              timeLabel = "OVERDUE";
            }

            return (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card
                  className="glass-panel"
                  style={{
                    borderColor: fatigue >= 70 ? `${labelColor}55` : "rgba(168,85,247,0.2)",
                    boxShadow: fatigue >= 70 ? `0 0 20px ${labelColor}22` : undefined,
                  }}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="font-display tracking-widest text-base flex items-center justify-between">
                      <span style={{ color: labelColor }}>Fatigue Meter</span>
                      <span
                        className="text-xs font-mono px-2 py-0.5 rounded"
                        style={{ background: `${labelColor}22`, color: labelColor, border: `1px solid ${labelColor}55` }}
                      >
                        {fatigueLabel}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col items-center gap-3">
                    <div className="relative" style={{ width: 140, height: 140 }}>
                      <svg width={140} height={140} viewBox="0 0 140 140">
                        <defs>
                          <filter id="seg-glow">
                            <feGaussianBlur stdDeviation="2.5" result="blur" />
                            <feMerge>
                              <feMergeNode in="blur" />
                              <feMergeNode in="SourceGraphic" />
                            </feMerge>
                          </filter>
                        </defs>
                        {Array.from({ length: SEGMENTS }).map((_, i) => {
                          const startDeg = i * (segDeg + gapDeg);
                          const endDeg = startDeg + segDeg;
                          const color = segColor(i);
                          const isLit = i < litCount;
                          return (
                            <path
                              key={i}
                              d={describeArc(startDeg, endDeg)}
                              fill="none"
                              stroke={color}
                              strokeWidth={strokeW}
                              strokeLinecap="round"
                              filter={isLit ? "url(#seg-glow)" : undefined}
                              style={{ transition: "stroke 0.4s ease" }}
                            />
                          );
                        })}
                        <text
                          x={cx}
                          y={cy - 6}
                          textAnchor="middle"
                          fontSize="20"
                          fontWeight="bold"
                          fontFamily="Rajdhani, sans-serif"
                          fill={fatigue === 0 ? "#4b5563" : labelColor}
                          style={{ filter: fatigue > 0 ? `drop-shadow(0 0 6px ${labelColor}aa)` : undefined }}
                        >
                          {fatigue}%
                        </text>
                        <text
                          x={cx}
                          y={cy + 10}
                          textAnchor="middle"
                          fontSize="8"
                          fontFamily="Rajdhani, sans-serif"
                          fill="#6b7280"
                          letterSpacing="2"
                        >
                          FATIGUE
                        </text>
                      </svg>
                    </div>
                    {timeLabel && nearestName ? (
                      <div className="text-center space-y-0.5">
                        <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={nearestName}>
                          {nearestName}
                        </p>
                        <p className="text-xs font-mono font-bold" style={{ color: labelColor }}>
                          {nearestMs <= 0 ? "OVERDUE" : `${timeLabel} remaining`}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/50 text-center">No active deadlines</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}

          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardTitle className="font-display tracking-widest text-lg flex items-center justify-between">
                Attributes
                <span className="text-xs font-sans text-muted-foreground bg-white/5 px-2 py-1 rounded">Rank: {(() => {
                  const lvl = character.level;
                  if (lvl >= 80) return "SSS";
                  if (lvl >= 60) return "SS";
                  if (lvl >= 40) return "S";
                  if (lvl >= 25) return "A";
                  if (lvl >= 15) return "B";
                  if (lvl >= 10) return "C";
                  if (lvl >= 5)  return "D";
                  if (lvl >= 2)  return "E";
                  return "F";
                })()}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatRadar character={character} />
              
              <div className="space-y-4 mt-6">
                {stats.map((stat) => {
                  const statTooltips: Record<string, { what: string; fn: string; usage: string }> = {
                    Strength: {
                      what: "Strength — raw physical power and force output.",
                      fn: "Increases when you complete Physical and strength-oriented quests.",
                      usage: "Assign quests in the Strength or Other category to grow this stat.",
                    },
                    Spirit: {
                      what: "Spirit — your inner world. Emotional intelligence, resilience, and mindfulness.",
                      fn: "Grows when you complete Creative and Social quests. Journaling, meditation, creative hobbies, and emotional regulation all feed Spirit. It measures how centered and self-aware you are.",
                      usage: "Assign quests to the Creative or Social category to raise Spirit. High Spirit means you stay grounded, react less, and remain aligned with your core self.",
                    },
                    Endurance: {
                      what: "Endurance — stamina and long-term resilience.",
                      fn: "Increases when you complete Health-related quests.",
                      usage: "Log workout, wellness, or Health-category quests to grow Endurance.",
                    },
                    Intellect: {
                      what: "Intellect — your outer world processor. Knowledge, logic, and practical skill-building.",
                      fn: "Grows when you complete Financial, Productivity, or Study quests. Reading, coding, researching, and planning all sharpen Intellect. It tracks how capable your mind is in the real world.",
                      usage: "Assign quests to the Study, Financial, or Productivity category to raise Intellect. High Intellect means faster learning, stronger problem-solving, and sharper execution.",
                    },
                    Discipline: {
                      what: "Discipline — willpower, consistency, and self-control.",
                      fn: "Grows passively with your check-in streak and completed quest volume.",
                      usage: "Maintain a daily streak and clear quests consistently to raise Discipline.",
                    },
                  };
                  const tip = statTooltips[stat.name] ?? { what: stat.name, fn: "", usage: "" };
                  return (
                    <InfoTooltip key={stat.name} what={tip.what} fn={tip.fn} usage={tip.usage}>
                      <div className="flex items-center gap-3 cursor-default">
                        <div className={`p-2 rounded-lg bg-white/5 border border-white/10 ${stat.color}`}>
                          <stat.icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between mb-1">
                            <span className={`text-sm font-semibold tracking-wide ${stat.color}`}>{stat.name}</span>
                            <span className="text-xs text-muted-foreground">{stat.val.toLocaleString()} / {STAT_CAP.toLocaleString()}</span>
                          </div>
                          <Progress value={Math.min(100, (stat.val / STAT_CAP) * 100)} className="h-1.5" indicatorClassName={stat.barColor} />
                        </div>
                      </div>
                    </InfoTooltip>
                  );
                })}
              </div>
            </CardContent>
          </Card>


          {/* Vocation Card */}
          {(() => {
            const vocationLevel = character.vocationLevel ?? 0;
            const vocationXp = character.vocationXp ?? 0;
            const isAwakened = vocationLevel >= 1;
            const vocationXpPercent = isAwakened ? 100 : Math.min(100, (vocationXp / 1000) * 100);
            return (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card
                  className="glass-panel"
                  style={isAwakened ? {
                    border: "1px solid rgba(139,92,246,0.55)",
                    boxShadow: "0 0 24px rgba(139,92,246,0.2)",
                  } : undefined}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="font-display tracking-widest text-lg flex items-center justify-between">
                      <InfoTooltip
                        what="Vocation — your specialization path earned through quest completion."
                        fn="Earn Vocation XP (VXP) by completing quests. Reach 1000 VXP to awaken Vocation Rank I: TECH_MONARCH."
                        usage="Complete missions regularly to accumulate VXP. Higher-rank quests award more VXP."
                      >
                        <span className="flex items-center gap-2 cursor-default">
                          <Zap className={`w-4 h-4 ${isAwakened ? "text-violet-400" : "text-muted-foreground"}`} />
                          Vocation
                        </span>
                      </InfoTooltip>
                      {isAwakened ? (
                        <motion.span
                          animate={!reduced ? {
                            textShadow: [
                              "0 0 6px rgba(139,92,246,0.6)",
                              "0 0 14px rgba(139,92,246,1)",
                              "0 0 6px rgba(139,92,246,0.6)",
                            ],
                          } : {}}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                          className="text-xs font-mono text-violet-300 bg-violet-950/60 border border-violet-600/50 px-2 py-0.5 rounded"
                        >
                          RANK I
                        </motion.span>
                      ) : (
                        <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded">
                          UNAWAKENED
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {isAwakened ? (
                      <div className="space-y-2">
                        <p
                          className="font-mono font-bold text-center tracking-[0.2em] text-violet-300 text-sm"
                          style={{ textShadow: "0 0 10px rgba(139,92,246,0.8)" }}
                        >
                          TECH_MONARCH
                        </p>
                        <p className="text-xs text-muted-foreground/70 text-center">
                          Vocation Rank I awakening achieved.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Vocation XP</span>
                          <span className="font-stat font-bold text-violet-400">{vocationXp} / 1000</span>
                        </div>
                        <div className="relative h-2 bg-secondary rounded-full overflow-hidden border border-white/5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${vocationXpPercent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="absolute top-0 left-0 h-full rounded-full"
                            style={{
                              background: "linear-gradient(90deg, #4c1d95, #7c3aed, #a78bfa)",
                              boxShadow: "0 0 8px rgba(139,92,246,0.6)",
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground/60 text-center">
                          {1000 - vocationXp} VXP until Rank I awakening
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}

          {/* Biographic Data */}
          <Card className="glass-panel" style={{ borderColor: "rgba(168,85,247,0.2)" }}>
            <CardHeader className="pb-2">
              <CardTitle className="font-display tracking-widest text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary/70" />
                Biographic Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-xs text-muted-foreground tracking-widest uppercase">Designation</span>
                <span className="text-sm font-semibold text-white">{character.name}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-xs text-muted-foreground tracking-widest uppercase flex items-center gap-1">
                  Age
                </span>
                {character.age != null
                  ? <span className="text-sm font-mono font-semibold text-white tracking-wider">{character.age}</span>
                  : <span className="text-xs font-mono text-muted-foreground/50 tracking-widest">— UNKNOWN —</span>
                }
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-muted-foreground tracking-widest uppercase flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Residency
                </span>
                {character.residency
                  ? <span className="text-sm font-mono font-semibold text-white tracking-wider">{character.residency}</span>
                  : <span className="text-xs font-mono text-muted-foreground/50 tracking-widest">— UNKNOWN —</span>
                }
              </div>
            </CardContent>
          </Card>

          {/* Vocation & Virtue */}
          <Card
            className="glass-panel"
            style={{
              borderColor: "rgba(168,85,247,0.25)",
              boxShadow: "0 0 16px rgba(88,28,135,0.12)",
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="font-display tracking-widest text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary/70" />
                Vocation &amp; Virtue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-white/3 border border-primary/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground tracking-widest uppercase mb-0.5">Vocation Path</p>
                    {character.vocationId
                      ? <p className="text-sm font-display font-bold tracking-wider" style={{ color: "#a855f7" }}>{character.vocationId}</p>
                      : <p className="text-sm font-display font-bold text-primary/60 tracking-wider">UNAWAKENED</p>
                    }
                  </div>
                  {character.vocationId
                    ? <Sparkles className="w-4 h-4" style={{ color: "#a855f7" }} />
                    : <Lock className="w-4 h-4 text-primary/30" />
                  }
                </div>
                {character.vocationId && (() => {
                  const VOCATION_XP_THRESHOLD = 1000;
                  const vXp = character.vocationXp ?? 0;
                  const vPct = Math.min(100, Math.floor((vXp / VOCATION_XP_THRESHOLD) * 100));
                  return (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] tracking-widest uppercase" style={{ color: "#a855f7" }}>Class XP</span>
                        <span className="text-[10px] font-mono" style={{ color: "#a855f7" }}>{vXp} / {VOCATION_XP_THRESHOLD}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${vPct}%`, background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-white/3 border border-primary/10">
                <div>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase mb-0.5">Virtue Category</p>
                  {character.virtueCategory
                    ? <p className="text-sm font-display font-bold tracking-wider" style={{ color: "#a855f7" }}>{character.virtueCategory}</p>
                    : <p className="text-sm font-display font-bold text-muted-foreground/40 tracking-wider">LOCKED</p>
                  }
                </div>
                {character.virtueCategory
                  ? <Zap className="w-4 h-4" style={{ color: "#a855f7" }} />
                  : <Lock className="w-4 h-4 text-muted-foreground/20" />
                }
              </div>
              {!character.vocationId && (
                <p className="text-[10px] text-muted-foreground/40 text-center tracking-widest pt-1">
                  Awaken your Vocation to unlock this system.
                </p>
              )}
            </CardContent>
          </Card>


          {corruption > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="glass-panel border border-red-700/50" style={{ boxShadow: "0 0 20px rgba(239,68,68,0.12)" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="font-display tracking-widest text-lg flex items-center gap-2 text-red-400">
                    <InfoTooltip
                      what="Corruption — a dark stat driven by bad habit relapses."
                      fn={`Increases when you log a relapse on a registered bad habit. High corruption degrades the status window with a visual overlay. Resets to 0 when ALL active bad habits reach a ${corruptionConfigData?.purificationStreakDays ?? 3}-day clean streak simultaneously.`}
                      usage="Register bad habits and avoid relapses to keep corruption low. Visit the Bad Habits page to manage your habits."
                    >
                      <span className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                        Corruption
                      </span>
                    </InfoTooltip>
                    <span className={`text-xs font-sans px-2 py-0.5 rounded-full ml-auto ${
                      corruptionTier === "high" ? "bg-red-900/60 text-red-300" :
                      corruptionTier === "mid" ? "bg-red-800/40 text-red-400" :
                      "bg-red-900/20 text-red-500"
                    }`}>
                      {corruptionTier === "high" ? "CRITICAL" : corruptionTier === "mid" ? "CORRUPTED" : "TAINTED"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Corruption Level</span>
                    <span className="text-2xl font-stat font-bold text-red-400">{corruption}<span className="text-base text-muted-foreground">/100</span></span>
                  </div>
                  <div className="relative h-3 bg-secondary rounded-full overflow-hidden border border-red-900/30">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${corruption}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="absolute top-0 left-0 h-full rounded-full"
                      style={{
                        background: "linear-gradient(90deg, #7f1d1d, #b91c1c, #ef4444)",
                        boxShadow: "0 0 8px rgba(239,68,68,0.6)",
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground/70 text-center">
                    Caused by bad habit relapses. Purified at {corruptionConfigData?.purificationStreakDays ?? 3}-day clean streak.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {failStreak > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={`glass-panel border ${failStreakBorderColors[failStreakTier]}`}>
                <CardHeader className="pb-2">
                  <CardTitle className={`font-display tracking-widest text-lg flex items-center gap-2 ${failStreakColors[failStreakTier]}`}>
                    <InfoTooltip
                      what="Failure Streak — how many quests you've failed in a row."
                      fn="Each failure or missed deadline adds to this counter and worsens your penalty multiplier."
                      usage="Complete any quest successfully to reset the streak and restore full XP/Gold rewards."
                    >
                      <span className="flex items-center gap-2">
                        <SkullIcon className="w-5 h-5" />
                        Failure Streak
                      </span>
                    </InfoTooltip>
                    {failStreakTier !== "none" && failStreakTier !== "low" && (
                      <span className={`text-xs font-sans px-2 py-0.5 rounded-full ml-auto ${
                        failStreakTier === "max" ? "bg-red-900/60 text-red-300" :
                        failStreakTier === "high" ? "bg-red-800/50 text-red-400" :
                        "bg-orange-800/40 text-orange-300"
                      }`}>
                        {failStreakTier === "max" ? "CRITICAL" : failStreakTier === "high" ? "DANGER" : "WARNING"}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Consecutive Failures</span>
                    <span className={`text-2xl font-stat font-bold ${failStreakColors[failStreakTier]}`}>{failStreak}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3" /> XP/Gold Penalty</span>
                    <span className={`font-bold ${failStreakColors[failStreakTier]}`}>{penaltyMultiplier}x</span>
                  </div>
                  <p className="text-xs text-muted-foreground/70 text-center">
                    Caused by manually failing a quest or letting a deadline expire.
                  </p>
                  <div className={`text-xs text-center py-2 px-3 rounded-lg ${
                    failStreakTier === "max" ? "bg-red-950/60 text-red-300" :
                    failStreakTier === "high" ? "bg-red-900/40 text-red-400" :
                    failStreakTier === "mid" ? "bg-orange-900/40 text-orange-300" :
                    "bg-amber-900/30 text-amber-300"
                  }`}>
                    Complete a quest to reset the streak.
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      <StreakMilestoneBanner
        open={streakMilestone !== null}
        streak={streakMilestone ?? 0}
        onDismiss={() => setStreakMilestone(null)}
      />

      <LevelUpCeremony
        open={levelUpData !== null}
        newLevel={levelUpData?.newLevel ?? 0}
        onDismiss={() => setLevelUpData(null)}
      />

      <AwakeningOverlay
        open={showAwakening}
        onDismiss={handleDismissAwakening}
      />
    </div>
  );
}
