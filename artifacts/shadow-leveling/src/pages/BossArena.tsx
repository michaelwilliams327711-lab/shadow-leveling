import { 
  useListBosses, 
  useChallengeBoss,
  useGetCharacter,
  getListBossesQueryKey,
  getGetCharacterQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Skull, Lock, Swords, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
const bossArenaImg = "/images/boss-arena.png";

export default function BossArena() {
  const { data: character } = useGetCharacter();
  const { data: bosses = [], isLoading } = useListBosses();
  const challengeBoss = useChallengeBoss();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleChallenge = (id: number) => {
    challengeBoss.mutate({ id }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListBossesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        
        if (res.victory) {
          toast({ 
            title: "BOSS DEFEATED!", 
            description: res.message,
            className: "bg-primary/20 border-primary text-primary shadow-[0_0_20px_rgba(124,58,237,0.5)]"
          });
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

  if (isLoading) return <div className="p-8">Loading Boss Data...</div>;

  return (
    <div className="min-h-screen relative">
      <div 
        className="absolute inset-0 z-0 opacity-20 pointer-events-none mix-blend-overlay"
        style={{ backgroundImage: `url(${bossArenaImg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      
      <div className="relative z-10 p-6 md:p-8 max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-5xl font-display font-black text-destructive tracking-widest flex items-center gap-4 drop-shadow-[0_0_15px_rgba(220,38,38,0.6)]">
            <Skull className="w-10 h-10" />
            BOSS ARENA
          </h1>
          <p className="text-red-400/70 mt-2 tracking-widest uppercase text-sm">High stakes challenges. Victory brings massive rewards. Failure brings severe penalties.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {bosses.map((boss) => (
            <Card key={boss.id} className={`glass-panel overflow-hidden border-destructive/20 relative group ${!boss.isUnlocked ? 'opacity-70' : ''}`}>
              {!boss.isUnlocked && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center border border-white/5">
                  <Lock className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="font-display tracking-widest text-lg text-white font-bold">LOCKED</p>
                  <p className="text-sm text-muted-foreground mt-2">Requires {boss.xpThreshold.toLocaleString()} total XP</p>
                </div>
              )}
              
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none transition-opacity group-hover:opacity-20">
                <Skull className="w-32 h-32 text-destructive" />
              </div>

              <CardContent className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <Badge className="bg-destructive/20 text-destructive border-destructive/30 mb-2 px-3 tracking-widest font-bold">
                      RANK {boss.rank}
                    </Badge>
                    <h2 className="text-2xl font-black font-display text-white">{boss.name}</h2>
                  </div>
                  {boss.isDefeated && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">DEFEATED</Badge>
                  )}
                </div>

                <p className="text-muted-foreground mb-6 font-sans leading-relaxed">{boss.description}</p>

                <div className="bg-background/50 border border-white/5 rounded-lg p-4 mb-6">
                  <p className="text-sm font-semibold text-white mb-1 tracking-wider uppercase flex items-center gap-2">
                    <Swords className="w-4 h-4 text-primary" /> Challenge
                  </p>
                  <p className="text-muted-foreground text-sm">{boss.challenge}</p>
                </div>

                <div className="flex items-center justify-between text-sm mb-6 border-t border-b border-white/5 py-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest">Victory</p>
                    <p className="text-primary font-bold">+{boss.xpReward} XP</p>
                    <p className="text-gold font-bold">+{boss.goldReward} G</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest">Defeat</p>
                    <p className="text-destructive font-bold">-{boss.xpPenalty} XP</p>
                    <p className="text-muted-foreground">- Stats drop</p>
                  </div>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full h-12 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30 tracking-widest font-bold font-display"
                      disabled={!boss.isUnlocked || boss.isDefeated}
                    >
                      {boss.isDefeated ? "ALREADY CONQUERED" : "INITIATE CHALLENGE"}
                    </Button>
                  </DialogTrigger>
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
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
