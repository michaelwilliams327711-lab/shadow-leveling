import { useState, useEffect, useCallback } from "react";
import { 
  useListBosses, 
  useChallengeBoss,
  useForgeBossGateKey,
  useGetCharacter,
  getListBossesQueryKey,
  getGetCharacterQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skull, Lock, Swords, ShieldAlert, AlertCircle, Ghost } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { InfoTooltip } from "@/components/InfoTooltip";
import { BossVictoryScreen } from "@/components/BossVictoryScreen";
import { LevelUpCeremony } from "@/components/LevelUpCeremony";
import { AriseRitual } from "@/components/AriseRitual";
import { ShadowIntel } from "@/components/ShadowIntel";
import { SYSTEM_INTEL } from "@/lib/systemLore";
import { motion, AnimatePresence } from "framer-motion";

const bossArenaImg = "/images/boss-arena.png";

const bossImageMap: Record<number, string> = {
  1: "/images/bosses/boss-1.png",
  2: "/images/bosses/boss-2.png",
  3: "/images/bosses/boss-3.png",
  4: "/images/bosses/boss-4.png",
  5: "/images/bosses/boss-5.png",
  6: "/images/bosses/boss-6.png",
  7: "/images/bosses/boss-7.png",
};

type RawBoss = {
  id: number;
  name: string;
  rank: string;
  description: string;
  challenge: string;
  xpThreshold: number;
  xpReward: number;
  goldReward: number;
  xpPenalty: number;
  maxHp: number;
  currentHp: number;
  isDefeated: boolean;
  isExtracted: boolean;
  isUnlocked: boolean;
  isLocked: boolean;
  gateUnlocked: boolean;
  defeatRecordedAt: string | null;
  failureRecordedAt: string | null;
};

function ShadowConfetti() {
  const particles = Array.from({ length: 48 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ["#60a5fa", "#818cf8", "#a78bfa", "#f59e0b", "#34d399"][i % 5],
    delay: Math.random() * 0.6,
    duration: 1.8 + Math.random() * 1.2,
    size: 4 + Math.random() * 6,
    drift: (Math.random() - 0.5) * 200,
  }));

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none overflow-hidden" aria-hidden="true">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 0.5,
            backgroundColor: p.color,
            boxShadow: `0 0 6px ${p.color}`,
          }}
          initial={{ y: -20, opacity: 0, rotate: 0, x: 0 }}
          animate={{
            y: "110vh",
            opacity: [0, 1, 1, 0],
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
            x: p.drift,
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeIn",
          }}
        />
      ))}
    </div>
  );
}

export default function BossArena() {
  const { data: character } = useGetCharacter();
  const { data: rawBosses = [], isLoading, isError, refetch } = useListBosses();
  const bosses = rawBosses as unknown as RawBoss[];
  const challengeBoss = useChallengeBoss();
  const forgeBossKey = useForgeBossGateKey();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [victoryData, setVictoryData] = useState<{
    bossName: string;
    xpGained: number;
    goldGained: number;
    statDeltas: Array<{ name: string; value: number }>;
  } | null>(null);
  const [levelUpData, setLevelUpData] = useState<{ newLevel: number; statDeltas?: Array<{ name: string; value: number }> } | null>(null);

  const [showRitual, setShowRitual] = useState(false);
  const [ritualBoss, setRitualBoss] = useState<{ id: number; name: string } | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [extractedBossIds, setExtractedBossIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isLoading || bosses.length === 0) return;
    const candidate = bosses.find(
      (b) => b.isDefeated && b.currentHp === 0 && !b.isExtracted && !extractedBossIds.has(b.id)
    );
    if (candidate && !showRitual) {
      setRitualBoss({ id: candidate.id, name: candidate.name });
      setShowRitual(true);
    }
  }, [bosses, isLoading]);

  const handleRitualSuccess = useCallback((shadowName: string) => {
    if (ritualBoss) {
      setExtractedBossIds((prev) => new Set([...prev, ritualBoss.id]));
    }
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3500);

    queryClient.invalidateQueries({ queryKey: getListBossesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });

    toast({
      title: "SHADOW EXTRACTED",
      description: `${shadowName} has joined your army.`,
      className: "border-blue-700/60 shadow-[0_0_20px_rgba(96,165,250,0.4)] bg-background/95",
    });

    setTimeout(() => {
      setShowRitual(false);
      setRitualBoss(null);
    }, 3800);
  }, [ritualBoss, queryClient, toast]);

  const handleRitualClose = useCallback(() => {
    if (ritualBoss) {
      setExtractedBossIds((prev) => new Set([...prev, ritualBoss.id]));
    }
    setShowRitual(false);
    setRitualBoss(null);
  }, [ritualBoss]);

  const handleChallenge = (id: number) => {
    const statNames = ["strength", "agility", "endurance", "intellect", "discipline"] as const;

    challengeBoss.mutate({ id }, {
      onSuccess: (res) => {
        const preCharacter = queryClient.getQueryData<typeof character>(getGetCharacterQueryKey());
        queryClient.invalidateQueries({ queryKey: getListBossesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        
        if (res.victory) {
          const boss = bosses.find(b => b.id === id);
          const statDeltas: Array<{ name: string; value: number }> = [];
          if (preCharacter && res.character) {
            for (const stat of statNames) {
              const delta = ((res.character as Record<string, number>)[stat] ?? 0) - ((preCharacter as Record<string, number>)[stat] ?? 0);
              if (delta > 0) {
                statDeltas.push({ name: stat.charAt(0).toUpperCase() + stat.slice(1), value: delta });
              }
            }
          }
          setVictoryData({
            bossName: boss?.name ?? "The Boss",
            xpGained: res.xpChange > 0 ? res.xpChange : (boss?.xpReward ?? 0),
            goldGained: res.goldChange > 0 ? res.goldChange : (boss?.goldReward ?? 0),
            statDeltas,
          });

          if (res.leveledUp && res.newLevel) {
            setTimeout(() => {
              setLevelUpData({ newLevel: res.newLevel!, statDeltas });
            }, 4000);
          }
        } else {
          toast({ 
            title: "DEFEAT", 
            description: res.message,
            variant: "destructive",
            className: "shadow-[0_0_20px_rgba(220,38,38,0.5)]"
          });
        }
      }
    });
  };

  const handleForgeKey = (id: number) => {
    forgeBossKey.mutate({ id }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListBossesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        toast({
          title: "GATE KEY FORGED",
          description: `${data.name ?? "The boss gate"} is now open.`,
          className: "border-yellow-700/60 shadow-[0_0_20px_rgba(234,179,8,0.35)] bg-background/95",
        });
      },
      onError: (err) => {
        const errorData = err as { data?: { error?: string }; message?: string };
        toast({
          title: "FORGE FAILED",
          description: errorData.data?.error ?? errorData.message ?? "Unable to forge Gate Key.",
          variant: "destructive",
        });
      },
    });
  };

  if (isLoading) return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <Skeleton className="h-16 w-64 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-panel rounded-xl p-6 space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-6 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );

  if (isError) return (
    <div className="p-8 flex flex-col items-center justify-center h-full gap-4">
      <AlertCircle className="w-12 h-12 text-destructive" />
      <p className="text-muted-foreground tracking-widest uppercase text-sm">System Error — Boss Arena Offline</p>
      <Button onClick={() => refetch()} variant="outline" className="border-white/20 tracking-widest">
        Retry Connection
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen relative">
      <AnimatePresence>
        {showConfetti && <ShadowConfetti key="confetti" />}
      </AnimatePresence>

      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: `url(${bossArenaImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      
      <div className="relative z-10 p-6 md:p-8 max-w-6xl mx-auto space-y-8">
        <div>
          <InfoTooltip
            what="Boss Arena — high-stakes real-world challenges."
            fn="Each boss represents a significant challenge you must complete in the real world. Victory rewards you with large XP and Gold; defeat penalizes you."
            usage="Only initiate a challenge when you are truly ready to attempt it. Bosses unlock as your total XP crosses certain thresholds."
          >
            <h1 className="text-5xl font-display font-black text-destructive tracking-widest flex items-center gap-4 drop-shadow-[0_0_15px_rgba(220,38,38,0.6)]">
              <Skull className="w-10 h-10" />
              BOSS ARENA
            </h1>
          </InfoTooltip>
          <p className="text-red-400/70 mt-2 tracking-widest uppercase text-sm">High stakes challenges. Victory brings massive rewards. Failure brings severe penalties.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {bosses.map((boss) => {
            const bossImage = bossImageMap[boss.id];
            const isExtractable = boss.isDefeated && boss.currentHp === 0 && !boss.isExtracted;
            const isForgingThisBoss = forgeBossKey.isPending && forgeBossKey.variables?.id === boss.id;

            return (
              <Card key={boss.id} className={`glass-panel overflow-hidden border-destructive/20 relative group ${!boss.isUnlocked ? 'opacity-70' : ''}`}>
                {!boss.isUnlocked && (
                  <ShadowIntel
                    title="Shadow Intel"
                    intel={SYSTEM_INTEL.LEVEL_GATE}
                    detail={`Required threshold: ${boss.xpThreshold.toLocaleString()} total XP. Level and accumulated XP now govern Boss visibility; no stat requirement is checked.`}
                    side="bottom"
                  >
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center border border-white/5">
                      <Lock className="w-12 h-12 text-muted-foreground mb-4" />
                      <p className="font-display tracking-widest text-lg text-white font-bold">LOCKED</p>
                      <p className="text-sm text-muted-foreground mt-2">Requires {boss.xpThreshold.toLocaleString()} total XP</p>
                    </div>
                  </ShadowIntel>
                )}

                {bossImage && (
                  <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16/9" }}>
                    <img
                      src={bossImage}
                      alt={boss.name}
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${boss.isExtracted ? 'grayscale opacity-60' : ''}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/90" />
                    <div className="absolute bottom-0 left-0 p-4 flex items-end justify-between w-full">
                      <div>
                        <InfoTooltip
                          what={`Rank ${boss.rank} Boss — difficulty tier of this encounter.`}
                          fn="Higher rank bosses require more XP to unlock and offer greater rewards, but also harsher defeat penalties."
                          usage="Attempt lower-rank bosses first to build experience and XP before taking on elite-rank encounters."
                        >
                          <Badge className="bg-destructive/70 text-white border-destructive/50 mb-1 px-3 tracking-widest font-bold text-xs backdrop-blur-sm">
                            RANK {boss.rank}
                          </Badge>
                        </InfoTooltip>
                        <h2 className="text-2xl font-black font-display text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{boss.name}</h2>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {boss.isExtracted && (
                          <Badge className="bg-blue-900/70 text-blue-200 border-blue-700/50 backdrop-blur-sm flex items-center gap-1">
                            <Ghost className="w-3 h-3" /> EXTRACTED
                          </Badge>
                        )}
                        {boss.isDefeated && !boss.isExtracted && (
                          <Badge className="bg-green-500/70 text-green-100 border-green-500/50 backdrop-blur-sm">DEFEATED</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <CardContent className="p-6 relative z-10">
                  {!bossImage && (
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <Badge className="bg-destructive/20 text-destructive border-destructive/30 mb-2 px-3 tracking-widest font-bold">
                          RANK {boss.rank}
                        </Badge>
                        <h2 className="text-2xl font-black font-display text-white">{boss.name}</h2>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        {boss.isExtracted && (
                          <Badge className="bg-blue-900/30 text-blue-300 border-blue-700/30 flex items-center gap-1">
                            <Ghost className="w-3 h-3" /> EXTRACTED
                          </Badge>
                        )}
                        {boss.isDefeated && !boss.isExtracted && (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">DEFEATED</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {!bossImage && (
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none transition-opacity group-hover:opacity-20">
                      <Skull className="w-32 h-32 text-destructive" />
                    </div>
                  )}

                  <p className="text-muted-foreground mb-6 font-sans leading-relaxed">{boss.description}</p>

                  <div className="bg-background/50 border border-white/5 rounded-lg p-4 mb-6">
                    <p className="text-sm font-semibold text-white mb-1 tracking-wider uppercase flex items-center gap-2">
                      <Swords className="w-4 h-4 text-primary" /> Challenge
                    </p>
                    <p className="text-muted-foreground text-sm">{boss.challenge}</p>
                  </div>

                  {(boss.maxHp > 0) && (
                    <div className="mb-6">
                      <ShadowIntel
                        title="Shadow Intel"
                        intel={SYSTEM_INTEL.ENRAGE_TIMER}
                        detail="Keep pressure on active bosses. The Archive treats long silence as retreat."
                      >
                        <div className="flex justify-between text-xs text-muted-foreground mb-1 tracking-widest uppercase font-bold">
                          <span>Boss HP</span>
                          <span>{boss.isExtracted ? "Extracted" : `${boss.currentHp.toLocaleString()} / ${boss.maxHp.toLocaleString()}`}</span>
                        </div>
                      </ShadowIntel>
                      <div className="w-full h-2 rounded-full bg-zinc-800/60 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            boss.isExtracted
                              ? "bg-blue-700/60"
                              : boss.currentHp === 0
                              ? "w-0"
                              : "bg-gradient-to-r from-red-700 to-red-500"
                          }`}
                          style={{ width: boss.isExtracted ? "100%" : `${(boss.currentHp / boss.maxHp) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm mb-6 border-t border-b border-white/5 py-4">
                    <InfoTooltip
                      what="Victory Reward — what you earn if you win."
                      fn={`Defeating this boss awards +${boss.xpReward} XP and +${boss.goldReward} Gold. These are credited immediately after you confirm success.`}
                      usage="Only confirm victory if you genuinely completed the real-world challenge. Integrity is the foundation of the system."
                    >
                      <div className="space-y-1">
                        <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest">Victory</p>
                        <p className="text-primary font-stat font-bold">+{boss.xpReward} XP</p>
                        <p className="text-gold font-stat font-bold">+{boss.goldReward} G</p>
                      </div>
                    </InfoTooltip>
                    <InfoTooltip
                      what="Victory Chance — your calculated odds of winning based on your current streak and level."
                      fn={`Formula: min(85%, 40% + streak×2% + level×1%). Your streak is ${character?.streak ?? 0}, level is ${character?.level ?? 1}.`}
                      usage="Higher streaks and levels improve your odds. Maximises at 85% — there is always risk."
                    >
                      <div className="text-center space-y-1">
                        <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest">Win Chance</p>
                        <p className="text-yellow-400 font-stat font-bold text-lg">
                          ~{Math.round(Math.min(0.85, 0.4 + (character?.streak ?? 0) * 0.02 + (character?.level ?? 1) * 0.01) * 100)}%
                        </p>
                      </div>
                    </InfoTooltip>
                    <InfoTooltip
                      what="Defeat Penalty — what you lose if you fail."
                      fn={`Failing this boss costs ${boss.xpPenalty} XP and randomly reduces one or more character stats.`}
                      usage="The penalty is applied automatically when you click ENTER DUNGEON and later admit defeat. This risk/reward mechanic makes victories meaningful."
                    >
                      <div className="text-right space-y-1">
                        <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest">Defeat</p>
                        <p className="text-destructive font-stat font-bold">-{boss.xpPenalty} XP</p>
                        <p className="text-muted-foreground">- Stats drop</p>
                      </div>
                    </InfoTooltip>
                  </div>

                  {isExtractable ? (
                    <Button
                      className="w-full h-12 bg-blue-900/30 text-blue-300 hover:bg-blue-800/50 border border-blue-700/50 tracking-widest font-bold font-display arise-mana transition-all"
                      onClick={() => {
                        setRitualBoss({ id: boss.id, name: boss.name });
                        setShowRitual(true);
                      }}
                    >
                      <Ghost className="w-4 h-4 mr-2" />
                      ARISE — EXTRACTION RITUAL
                    </Button>
                  ) : (
                    boss.isLocked ? (
                      <ShadowIntel
                        title="Shadow Intel"
                        intel={SYSTEM_INTEL.GATE_FRAGMENTS}
                        detail={`Current fragments: ${character?.gateFragments ?? 0} / 3.`}
                      >
                        <Button
                          className="w-full h-12 bg-yellow-900/20 text-yellow-300 hover:bg-yellow-800/40 border border-yellow-700/50 tracking-widest font-bold font-display"
                          disabled={(character?.gateFragments ?? 0) < 3 || forgeBossKey.isPending || boss.isDefeated || boss.isExtracted}
                          onClick={() => handleForgeKey(boss.id)}
                        >
                          {isForgingThisBoss ? "FORGING KEY..." : "FORGE GATE KEY (3 FRAGMENTS REQUIRED)"}
                        </Button>
                      </ShadowIntel>
                    ) : (
                    <Dialog>
                      <InfoTooltip
                        what={
                          boss.isExtracted
                            ? "Shadow Extracted — this boss now serves in your army."
                            : boss.isDefeated
                            ? "Already Conquered — this boss has been defeated."
                            : "Initiate Challenge — start this boss encounter."
                        }
                        fn={
                          boss.isExtracted
                            ? "The shadow of this boss has been extracted and added to your Shadow Army."
                            : boss.isDefeated
                            ? "You have already proven yourself against this boss. Each boss can only be defeated once."
                            : "Opens a confirmation dialog. If you proceed, you are committing to attempt the real-world challenge."
                        }
                        usage={
                          boss.isExtracted
                            ? "Visit the Shadow Army section to manage your extracted soldiers."
                            : boss.isDefeated
                            ? "Look for higher-rank bosses to continue pushing your limits."
                            : "Press only when you are ready to start the challenge immediately in the real world. Back out if you are not prepared."
                        }
                      >
                        <DialogTrigger asChild>
                          <Button 
                            className="w-full h-12 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30 tracking-widest font-bold font-display"
                            disabled={!boss.isUnlocked || !boss.gateUnlocked || boss.isDefeated || boss.isExtracted}
                          >
                            {boss.isExtracted
                              ? "SHADOW EXTRACTED"
                              : boss.isDefeated
                              ? "ALREADY CONQUERED"
                              : "INITIATE CHALLENGE"}
                          </Button>
                        </DialogTrigger>
                      </InfoTooltip>
                      <DialogContent className="glass-panel border-destructive/50 bg-background/95">
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-display font-black text-destructive flex items-center gap-3">
                            <ShieldAlert className="w-6 h-6" /> WARNING
                          </DialogTitle>
                          <DialogDescription className="text-base text-white/80 pt-4">
                            You are about to challenge <strong className="text-white">{boss.name}</strong>.
                            This is a high-stakes encounter. If you fail to complete the real-world challenge, you will lose {boss.xpPenalty} XP and random attributes may decrease.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="mt-6">
                          <Button variant="outline" className="border-white/20">RETREAT</Button>
                          <Button 
                            variant="destructive" 
                            className="bg-destructive hover:bg-destructive/90 text-white font-bold tracking-widest"
                            onClick={() => handleChallenge(boss.id)}
                            disabled={challengeBoss.isPending}
                          >
                            {challengeBoss.isPending ? "FIGHTING..." : "ENTER DUNGEON"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    )
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <BossVictoryScreen
        open={victoryData !== null}
        bossName={victoryData?.bossName ?? ""}
        xpGained={victoryData?.xpGained ?? 0}
        goldGained={victoryData?.goldGained ?? 0}
        statDeltas={victoryData?.statDeltas}
        onDismiss={() => setVictoryData(null)}
      />

      <LevelUpCeremony
        open={levelUpData !== null}
        newLevel={levelUpData?.newLevel ?? 0}
        statDeltas={levelUpData?.statDeltas}
        onDismiss={() => setLevelUpData(null)}
      />

      {showRitual && ritualBoss && (
        <AriseRitual
          bossId={ritualBoss.id}
          bossName={ritualBoss.name}
          onClose={handleRitualClose}
          onSuccess={handleRitualSuccess}
        />
      )}
    </div>
  );
}
