import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Ghost, UserMinus, Shield, Zap, AlertTriangle, Link, Unlink, ScrollText, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Soldier {
  id: number;
  name: string;
  rank: string;
  specialAbility: string;
  assignedTaskId: number | null;
  extractedAt: string | null;
}

interface ShadowArmyResponse {
  soldiers: Soldier[];
  capacity: number;
  current: number;
}

interface ActiveQuest {
  id: number;
  name: string;
  category: string;
  difficulty: string;
  status: string;
}

const RANK_COLORS: Record<string, string> = {
  S: "border-yellow-500/60 text-yellow-300 bg-yellow-900/20",
  A: "border-purple-500/60 text-purple-300 bg-purple-900/20",
  B: "border-blue-500/60 text-blue-300 bg-blue-900/20",
  C: "border-cyan-600/60 text-cyan-300 bg-cyan-900/20",
  D: "border-zinc-600/60 text-zinc-400 bg-zinc-900/20",
};

const SHADOW_RANK_BONUS: Record<string, number> = {
  D: 5, C: 10, B: 15, A: 20, S: 30,
};

const DIFFICULTY_COLORS: Record<string, string> = {
  F: "text-zinc-500", E: "text-zinc-400", D: "text-green-400",
  C: "text-cyan-400",  B: "text-blue-400", A: "text-purple-400",
  S: "text-yellow-400", SS: "text-orange-400", SSS: "text-red-400",
};

function rankColor(rank: string) {
  return RANK_COLORS[rank] ?? RANK_COLORS["D"];
}

export function ShadowArmyPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [releaseTarget, setReleaseTarget] = useState<Soldier | null>(null);
  const [assignTarget, setAssignTarget] = useState<Soldier | null>(null);
  const [questSearch, setQuestSearch] = useState("");

  const { data, isLoading } = useQuery<ShadowArmyResponse>({
    queryKey: ["shadow-army"],
    queryFn: ({ signal }) => customFetch<ShadowArmyResponse>("/api/shadows", { signal }),
    staleTime: 30_000,
  });

  const { data: questsData } = useQuery<ActiveQuest[]>({
    queryKey: ["active-quests-for-assign"],
    queryFn: ({ signal }) => customFetch<ActiveQuest[]>("/api/quests", { signal }),
    enabled: assignTarget !== null,
    staleTime: 60_000,
    select: (quests) => quests.filter((q) => q.status === "active"),
  });

  const releaseMutation = useMutation<{ message: string; releasedName: string }, Error, number>({
    mutationFn: (id) =>
      customFetch<{ message: string; releasedName: string }>(`/api/shadows/${id}`, { method: "DELETE" }),
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
      toast({ title: "Release Failed", description: err.message, variant: "destructive" });
      setReleaseTarget(null);
    },
  });

  const assignMutation = useMutation<{ questName: string }, Error, { shadowId: number; questId: number }>({
    mutationFn: ({ shadowId, questId }) =>
      customFetch<{ questName: string }>(`/api/shadows/${shadowId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questId }),
      }),
    onSuccess: (result) => {
      toast({
        title: "Shadow Assigned",
        description: `Soldier deployed to "${result.questName}". +${SHADOW_RANK_BONUS[assignTarget?.rank ?? "D"] ?? 5}% XP bonus on completion.`,
        className: "border-blue-700/50 bg-background/95",
      });
      queryClient.invalidateQueries({ queryKey: ["shadow-army"] });
      setAssignTarget(null);
      setQuestSearch("");
    },
    onError: (err) => {
      toast({ title: "Assignment Failed", description: err.message, variant: "destructive" });
    },
  });

  const unassignMutation = useMutation<unknown, Error, number>({
    mutationFn: (shadowId) =>
      customFetch<unknown>(`/api/shadows/${shadowId}/unassign`, { method: "PATCH" }),
    onSuccess: () => {
      toast({
        title: "Assignment Cleared",
        description: "The soldier is standing by.",
        className: "border-blue-700/50 bg-background/95",
      });
      queryClient.invalidateQueries({ queryKey: ["shadow-army"] });
    },
    onError: (err) => {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    },
  });

  const soldiers = data?.soldiers ?? [];
  const capacity = data?.capacity ?? 0;
  const current = data?.current ?? 0;
  const isFull = current >= capacity;

  const assignedIds = new Set(soldiers.map((s) => s.assignedTaskId).filter(Boolean));

  const filteredQuests = (questsData ?? []).filter((q) =>
    q.name.toLowerCase().includes(questSearch.toLowerCase()) ||
    q.category.toLowerCase().includes(questSearch.toLowerCase())
  );

  function getAssignedQuestName(soldier: Soldier): string | null {
    if (!soldier.assignedTaskId) return null;
    return questsData?.find((q) => q.id === soldier.assignedTaskId)?.name ?? `Quest #${soldier.assignedTaskId}`;
  }

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
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
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
                {soldiers.map((soldier, i) => {
                  const bonus = SHADOW_RANK_BONUS[soldier.rank] ?? 5;
                  const isAssigned = !!soldier.assignedTaskId;

                  return (
                    <motion.div
                      key={soldier.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex flex-col gap-2 p-3 rounded-lg border border-blue-900/30 bg-blue-950/10 hover:bg-blue-950/20 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-blue-900/20 border border-blue-800/30 flex items-center justify-center">
                          <Ghost className="w-5 h-5 text-blue-400/70" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-bold text-white text-sm truncate">{soldier.name}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 font-bold border ${rankColor(soldier.rank)}`}>
                              {soldier.rank}
                            </Badge>
                            <span className="text-[10px] text-blue-400/70 font-mono">+{bonus}% XP</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-blue-400/70">
                            <Zap className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">{soldier.specialAbility}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-blue-400/70 hover:text-blue-300 hover:bg-blue-900/30 border border-transparent hover:border-blue-800/40"
                            onClick={() => { setAssignTarget(soldier); setQuestSearch(""); }}
                            title="Assign to quest"
                          >
                            <Link className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2 text-red-400/70 hover:text-red-300 hover:bg-red-900/20 border border-transparent hover:border-red-800/40"
                            onClick={() => setReleaseTarget(soldier)}
                            title="Release soldier"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {isAssigned && (
                        <div className="flex items-center justify-between gap-2 px-1 py-1.5 rounded-md bg-blue-900/20 border border-blue-800/30">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ScrollText className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="text-xs text-blue-300 truncate">
                              {getAssignedQuestName(soldier) ?? `Quest #${soldier.assignedTaskId}`}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-red-300 hover:bg-red-900/20 flex-shrink-0"
                            onClick={() => unassignMutation.mutate(soldier.id)}
                            disabled={unassignMutation.isPending}
                          >
                            <Unlink className="w-3 h-3 mr-1" />
                            Unassign
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </CardContent>
      </Card>

      {/* Assign dialog */}
      <Dialog open={assignTarget !== null} onOpenChange={(open) => { if (!open) { setAssignTarget(null); setQuestSearch(""); } }}>
        <DialogContent className="glass-panel border-blue-900/50 bg-background/95 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest text-blue-300 flex items-center gap-2">
              <Link className="w-4 h-4" /> Assign {assignTarget?.name}
            </DialogTitle>
            <DialogDescription className="text-white/60 pt-1 text-sm">
              Deploy this soldier to an active quest.
              On completion you gain a{" "}
              <span className="text-blue-300 font-bold">
                +{SHADOW_RANK_BONUS[assignTarget?.rank ?? "D"] ?? 5}% XP bonus
              </span>{" "}
              (Rank {assignTarget?.rank}). The soldier auto-unassigns after the quest is completed.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search quests..."
              value={questSearch}
              onChange={(e) => setQuestSearch(e.target.value)}
              className="pl-9 bg-background/50 border-white/10 text-sm"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {filteredQuests.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-6">
                {questsData === undefined ? "Loading quests..." : "No active quests found."}
              </p>
            ) : (
              filteredQuests.map((quest) => {
                const alreadyAssigned = assignedIds.has(quest.id);
                return (
                  <button
                    key={quest.id}
                    disabled={assignMutation.isPending || alreadyAssigned}
                    onClick={() => assignTarget && assignMutation.mutate({ shadowId: assignTarget.id, questId: quest.id })}
                    className={cn(
                      "w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all",
                      alreadyAssigned
                        ? "border-blue-800/30 bg-blue-900/10 opacity-50 cursor-not-allowed"
                        : "border-white/5 bg-white/5 hover:bg-blue-900/20 hover:border-blue-700/40 cursor-pointer"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{quest.name}</p>
                      <p className="text-xs text-muted-foreground">{quest.category}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {alreadyAssigned && (
                        <span className="text-[10px] text-blue-400">Assigned</span>
                      )}
                      <span className={`text-xs font-bold ${DIFFICULTY_COLORS[quest.difficulty] ?? "text-zinc-400"}`}>
                        {quest.difficulty}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              className="border border-white/10 text-muted-foreground hover:text-white"
              onClick={() => { setAssignTarget(null); setQuestSearch(""); }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release dialog */}
      <Dialog open={releaseTarget !== null} onOpenChange={(open) => { if (!open) setReleaseTarget(null); }}>
        <DialogContent className="glass-panel border-blue-900/50 bg-background/95 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest text-blue-300 flex items-center gap-2">
              <Shield className="w-5 h-5" /> Release Soldier
            </DialogTitle>
            <DialogDescription className="text-white/70 pt-2">
              Release <strong className="text-white">{releaseTarget?.name}</strong>{" "}
              <span className="text-xs text-blue-400">(Rank {releaseTarget?.rank})</span> from the Shadow Army?
              This is permanent. The slot opens for new extractions.
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
