import { 
  useGetCharacter, 
  useGetActivityHeatmap, 
  useGetDailyRngEvent, 
  useDailyCheckin,
  getGetCharacterQueryKey,
  getGetActivityHeatmapQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, Coins, Shield, Zap, Brain, Dumbbell, Target, Sparkles, AlertCircle, Sword, SkullIcon, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StatRadar } from "@/components/StatRadar";
import { Heatmap } from "@/components/Heatmap";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: character, isLoading: charLoading } = useGetCharacter();
  const { data: heatmap } = useGetActivityHeatmap();
  const { data: rngEvent } = useGetDailyRngEvent();
  const checkinMutation = useDailyCheckin();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleCheckin = () => {
    checkinMutation.mutate(undefined, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetActivityHeatmapQueryKey() });
        
        if (res.alreadyCheckedIn) {
          toast({ title: "Already Checked In", description: "You have already claimed your daily rewards." });
          return;
        }

        toast({
          title: "Check-in Successful!",
          description: `Streak: ${res.streak} | Multiplier: ${res.multiplier}x`,
          className: "bg-primary/20 border-primary text-primary-foreground",
        });

        if (res.milestoneBonus) {
          setTimeout(() => {
            toast({
              title: "🔥 Milestone Reached! 🔥",
              description: `Bonus Rewards: +${res.milestoneBonusXp} XP | +${res.milestoneBonusGold} Gold`,
              className: "bg-destructive/20 border-destructive text-destructive-foreground",
            });
          }, 1000);
        }
      }
    });
  };

  if (charLoading || !character) {
    return <div className="p-8 flex items-center justify-center h-full"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary"></div></div>;
  }

  const xpPercent = (character.xp / (character.xp + character.xpToNextLevel)) * 100;

  const failStreak = character.failStreak ?? 0;
  const penaltyMultiplier = character.penaltyMultiplier ?? 1.0;

  const failStreakTier = failStreak >= 10 ? "max" : failStreak >= 7 ? "high" : failStreak >= 4 ? "mid" : failStreak >= 2 ? "low" : "none";

  const failStreakColors: Record<string, string> = {
    none: "text-muted-foreground",
    low: "text-yellow-400",
    mid: "text-orange-400",
    high: "text-red-500",
    max: "text-red-600",
  };

  const failStreakBorderColors: Record<string, string> = {
    none: "border-white/10",
    low: "border-yellow-500/30",
    mid: "border-orange-500/40",
    high: "border-red-500/50",
    max: "border-red-600/60",
  };

  const stats = [
    { name: "Strength", val: character.strength, icon: Dumbbell, color: "text-red-400" },
    { name: "Agility", val: character.agility, icon: Zap, color: "text-yellow-400" },
    { name: "Endurance", val: character.endurance, icon: Shield, color: "text-green-400" },
    { name: "Intellect", val: character.intellect, icon: Brain, color: "text-blue-400" },
    { name: "Discipline", val: character.discipline, icon: Target, color: "text-purple-400" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header & Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight mb-2">STATUS WINDOW</h1>
          <p className="text-muted-foreground text-lg tracking-widest uppercase">Player: <span className="text-primary">{character.name}</span></p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3">
            <Coins className="text-gold w-5 h-5" />
            <span className="text-gold font-bold text-xl">{character.gold.toLocaleString()} G</span>
          </div>
          <div className="glass-panel px-4 py-2 rounded-xl flex items-center gap-3 border-orange-500/30">
            <Flame className="text-orange-500 w-5 h-5" />
            <span className="text-orange-500 font-bold text-xl">{character.streak} Day</span>
            {character.multiplier > 1 && (
              <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
                {character.multiplier}x
              </span>
            )}
          </div>
          {failStreak > 0 && (
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
          <Card className="glass-panel overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Sword className="w-48 h-48" />
            </div>
            <CardContent className="p-8 relative z-10">
              <div className="flex justify-between items-baseline mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl text-muted-foreground font-display tracking-widest">LEVEL</span>
                  <span className="text-6xl font-display font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">{character.level}</span>
                </div>
                <div className="text-right">
                  <span className="text-primary font-bold text-xl">{character.xp.toLocaleString()}</span>
                  <span className="text-muted-foreground text-sm"> / {(character.xp + character.xpToNextLevel).toLocaleString()} XP</span>
                </div>
              </div>
              
              <div className="relative h-4 bg-secondary rounded-full overflow-hidden mb-8 border border-white/5 shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPercent}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary/50 to-primary rounded-full shadow-[0_0_10px_rgba(124,58,237,0.8)]"
                />
              </div>

              <Button 
                onClick={handleCheckin}
                disabled={checkinMutation.isPending}
                className="w-full h-14 text-lg font-bold tracking-widest uppercase bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(124,58,237,0.4)] hover:shadow-[0_0_30px_rgba(124,58,237,0.6)] transition-all duration-300"
              >
                {checkinMutation.isPending ? "Connecting..." : "Daily Arise (Check-In)"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-panel">
            <CardHeader>
              <CardTitle className="font-display tracking-widest text-lg">Activity Record</CardTitle>
            </CardHeader>
            <CardContent>
              <Heatmap data={heatmap || []} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Stats */}
        <div className="space-y-8">
          <Card className="glass-panel">
            <CardHeader className="pb-2">
              <CardTitle className="font-display tracking-widest text-lg flex items-center justify-between">
                Attributes
                <span className="text-xs font-sans text-muted-foreground bg-white/5 px-2 py-1 rounded">Rank: E</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StatRadar character={character} />
              
              <div className="space-y-4 mt-6">
                <TooltipProvider>
                  {stats.map((stat) => (
                    <Tooltip key={stat.name}>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-3 cursor-default">
                          <div className={`p-2 rounded-lg bg-white/5 border border-white/10 ${stat.color}`}>
                            <stat.icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-semibold tracking-wide text-gray-300">{stat.name}</span>
                            </div>
                            <Progress value={Math.min(100, (stat.val / 110000) * 100)} className="h-1.5" indicatorColor="bg-white/70" />
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>{stat.val.toLocaleString()} / 110,000</TooltipContent>
                    </Tooltip>
                  ))}
                </TooltipProvider>
              </div>
            </CardContent>
          </Card>

          {failStreak > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={`glass-panel border ${failStreakBorderColors[failStreakTier]}`}>
                <CardHeader className="pb-2">
                  <CardTitle className={`font-display tracking-widest text-lg flex items-center gap-2 ${failStreakColors[failStreakTier]}`}>
                    <SkullIcon className="w-5 h-5" />
                    Failure Streak
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
                    <span className={`text-2xl font-display font-bold ${failStreakColors[failStreakTier]}`}>{failStreak}</span>
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
                    "bg-yellow-900/30 text-yellow-300"
                  }`}>
                    Complete a quest to reset the streak.
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
