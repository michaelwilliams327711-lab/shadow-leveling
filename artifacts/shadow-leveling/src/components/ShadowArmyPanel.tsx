import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Ghost, UserMinus, Shield, Zap, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Soldier {
  id: number;
  name: string;
  rank: string;
  specialAbility: string;
  extractedAt: string | null;
}

interface ShadowArmyResponse {
  soldiers: Soldier[];
  capacity: number;
  current: number;
}

const RANK_COLORS: Record<string, string> = {
  S: "border-yellow-500/60 text-yellow-300 bg-yellow-900/20",
  A: "border-purple-500/60 text-purple-300 bg-purple-900/20",
  B: "border-blue-500/60 text-blue-300 bg-blue-900/20",
  C: "border-cyan-600/60 text-cyan-300 bg-cyan-900/20",
  D: "border-zinc-600/60 text-zinc-400 bg-zinc-900/20",
};

function rankColor(rank: string) {
  return RANK_COLORS[rank] ?? RANK_COLORS["D"];
}

export function ShadowArmyPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [releaseTarget, setReleaseTarget] = useState<Soldier | null>(null);

  const { data, isLoading } = useQuery<ShadowArmyResponse>({
    queryKey: ["shadow-army"],
    queryFn: ({ signal }) => customFetch<ShadowArmyResponse>("/api/shadows", { signal }),
    staleTime: 30_000,
  });

  const releaseMutation = useMutation<{ message: string; releasedName: string }, Error, number>({
    mutationFn: (id) =>
      customFetch<{ message: string; releasedName: string }>(`/api/shadows/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (result) => {
      toast({
        title: "Soldier Released",
        description: result.message,
        className: "border-blue-700/50 bg-background/95",
      });
      queryClient.invalidateQueries({ queryKey: ["shadow-army"] });
      setReleaseTarget(null);
    },
    onError: (err) => {
      toast({
        title: "Release Failed",
        description: err.message,
        variant: "destructive",
      });
      setReleaseTarget(null);
    },
  });

  const soldiers = data?.soldiers ?? [];
  const capacity = data?.capacity ?? 0;
  const current = data?.current ?? 0;
  const isFull = current >= capacity;

  return (
    <>
      <Card className="glass-panel border border-blue-900/40 mt-10">
        <CardHeader className="pb-3">
          <CardTitle className="font-display tracking-widest text-lg text-blue-300 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Ghost className="w-5 h-5 text-blue-400" />
              SHADOW ARMY
            </span>
            {!isLoading && (
              <span className={`text-sm font-mono px-2 py-0.5 rounded border ${
                isFull
                  ? "border-red-700/50 text-red-400 bg-red-900/10"
                  : "border-blue-700/40 text-blue-400 bg-blue-900/10"
              }`}>
                {current} / {capacity}
                {isFull && <span className="ml-1 text-xs">FULL</span>}
              </span>
            )}
          </CardTitle>
          {isFull && (
            <p className="text-xs text-red-400/80 mt-1">
              <AlertTriangle className="inline w-3 h-3 mr-1" />
              Army at capacity. Release a soldier to enable further extractions.
            </p>
          )}
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
          ) : soldiers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
              <Ghost className="w-10 h-10 text-blue-900/60" />
              <p className="text-muted-foreground text-sm tracking-wide">
                No shadows extracted yet. Defeat a boss and issue the ARISE command.
              </p>
            </div>
          ) : (
            <AnimatePresence>
              <div className="space-y-3">
                {soldiers.map((soldier, i) => (
                  <motion.div
                    key={soldier.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 p-3 rounded-lg border border-blue-900/30 bg-blue-950/10 hover:bg-blue-950/20 transition-colors group"
                  >
                    <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-blue-900/20 border border-blue-800/30 flex items-center justify-center">
                      <Ghost className="w-5 h-5 text-blue-400/70" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-white text-sm truncate">{soldier.name}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 font-bold border ${rankColor(soldier.rank)}`}>
                          {soldier.rank}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-blue-400/70">
                        <Zap className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{soldier.specialAbility}</span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-8 px-2 text-red-400/70 hover:text-red-300 hover:bg-red-900/20 border border-transparent hover:border-red-800/40"
                      onClick={() => setReleaseTarget(soldier)}
                      title="Release soldier"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </Button>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </CardContent>
      </Card>

      <Dialog open={releaseTarget !== null} onOpenChange={(open) => { if (!open) setReleaseTarget(null); }}>
        <DialogContent className="glass-panel border-blue-900/50 bg-background/95 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest text-blue-300 flex items-center gap-2">
              <Shield className="w-5 h-5" /> Release Soldier
            </DialogTitle>
            <DialogDescription className="text-white/70 pt-2">
              Release <strong className="text-white">{releaseTarget?.name}</strong>{" "}
              <span className="text-xs text-blue-400">(Rank {releaseTarget?.rank})</span> from the Shadow Army?
              This action is permanent. The slot will free up for a new extraction.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row">
            <Button
              variant="ghost"
              className="border border-white/10 text-muted-foreground hover:text-white"
              onClick={() => setReleaseTarget(null)}
              disabled={releaseMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-900/40 text-red-300 hover:bg-red-800/60 border border-red-700/50 font-bold tracking-widest"
              onClick={() => releaseTarget && releaseMutation.mutate(releaseTarget.id)}
              disabled={releaseMutation.isPending}
            >
              {releaseMutation.isPending ? "Releasing..." : "RELEASE"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
