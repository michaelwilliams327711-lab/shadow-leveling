import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown, X, Zap, CheckCircle2, Clock, Layers,
  GripVertical, Star, Lock, History, TrendingUp, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  listVocations, createVocation, updateVocation, deleteVocation, completeMilestone,
  getVocationLog, getVocXpForLevel, getEvolutionTierColor, getEvolutionTierBg,
  type VocationPath, type VocationLog, type CreateVocationPayload, type UpdateVocationPayload,
} from "@/lib/vocations-client";
import { EvolutionAnimation } from "@/components/EvolutionAnimation";
import { InfoTooltip } from "@/components/InfoTooltip";

const VOCATION_QUERY_KEY = ["vocations"] as const;

function useTitleLadderEditor(initial: string[]) {
  const [titles, setTitles] = useState<string[]>(initial.length > 0 ? initial : ["Novice"]);

  const add = () => setTitles((prev) => [...prev, ""]);
  const remove = (i: number) => setTitles((prev) => prev.filter((_, idx) => idx !== i));
  const update = (i: number, val: string) =>
    setTitles((prev) => prev.map((t, idx) => (idx === i ? val : t)));
  const moveUp = (i: number) => {
    if (i === 0) return;
    setTitles((prev) => {
      const copy = [...prev];
      [copy[i - 1], copy[i]] = [copy[i], copy[i - 1]];
      return copy;
    });
  };
  const moveDown = (i: number) => {
    setTitles((prev) => {
      if (i === prev.length - 1) return prev;
      const copy = [...prev];
      [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
      return copy;
    });
  };
  const reset = (newTitles: string[]) => setTitles(newTitles);

  return { titles, add, remove, update, moveUp, moveDown, reset };
}

interface VocationFormData {
  name: string;
  description: string;
  gateThreshold: number;
  milestoneQuestDescription: string;
}

const DEFAULT_FORM: VocationFormData = {
  name: "",
  description: "",
  gateThreshold: 20,
  milestoneQuestDescription: "",
};

function VocationForm({
  initial,
  initialTitles,
  onSubmit,
  onCancel,
  isSubmitting,
  mode,
}: {
  initial: VocationFormData;
  initialTitles: string[];
  onSubmit: (data: VocationFormData, titles: string[]) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  mode: "create" | "edit";
}) {
  const [form, setForm] = useState<VocationFormData>(initial);
  const ladder = useTitleLadderEditor(initialTitles);

  const set = (field: keyof VocationFormData, val: string | number) =>
    setForm((prev) => ({ ...prev, [field]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validTitles = ladder.titles.filter((t) => t.trim().length > 0);
    if (validTitles.length === 0) return;
    onSubmit(form, validTitles);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-xs tracking-widest uppercase text-muted-foreground">Vocation Name *</Label>
        <Input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g., Web Development, Fitness, Finance"
          className="bg-white/5 border-white/10 text-white"
          required
          maxLength={100}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs tracking-widest uppercase text-muted-foreground">Description</Label>
        <Textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What is this vocation path about?"
          className="bg-white/5 border-white/10 text-white resize-none"
          rows={2}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs tracking-widest uppercase text-muted-foreground">
          Gate Threshold (Level)
        </Label>
        <Input
          type="number"
          min={1}
          max={999}
          value={form.gateThreshold}
          onChange={(e) => set("gateThreshold", parseInt(e.target.value) || 20)}
          className="bg-white/5 border-white/10 text-white w-32"
        />
        <p className="text-xs text-muted-foreground">XP gate activates at every multiple of this level</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs tracking-widest uppercase text-muted-foreground">
          Milestone Quest Description
        </Label>
        <Textarea
          value={form.milestoneQuestDescription}
          onChange={(e) => set("milestoneQuestDescription", e.target.value)}
          placeholder="What must you complete to evolve? e.g., 'Deploy a full-stack project'"
          className="bg-white/5 border-white/10 text-white resize-none"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs tracking-widest uppercase text-muted-foreground">Evolution Title Ladder</Label>
          <Button type="button" variant="ghost" size="sm" onClick={ladder.add} className="h-7 text-xs text-primary">
            <Plus className="w-3 h-3 mr-1" /> Add Title
          </Button>
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {ladder.titles.map((title, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => ladder.moveUp(i)}
                  disabled={i === 0}
                  className="p-0.5 text-muted-foreground hover:text-white disabled:opacity-20"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => ladder.moveDown(i)}
                  disabled={i === ladder.titles.length - 1}
                  className="p-0.5 text-muted-foreground hover:text-white disabled:opacity-20"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <span className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</span>
              <Input
                value={title}
                onChange={(e) => ladder.update(i, e.target.value)}
                placeholder={`Title ${i + 1}`}
                className="bg-white/5 border-white/10 text-white flex-1 h-8 text-sm"
                maxLength={60}
              />
              <button
                type="button"
                onClick={() => ladder.remove(i)}
                disabled={ladder.titles.length <= 1}
                className="p-1 text-muted-foreground hover:text-red-400 disabled:opacity-20"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isSubmitting || !form.name.trim()}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          {isSubmitting ? "Saving..." : mode === "create" ? "Create Vocation Path" : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="border-white/20 text-white hover:bg-white/5">
          Cancel
        </Button>
      </div>
    </form>
  );
}

function formatLogEvent(entry: VocationLog): { icon: React.ReactNode; text: string } {
  const type = entry.eventType;
  if (type === "XP_AWARDED") {
    return {
      icon: <TrendingUp className="w-3 h-3 text-primary shrink-0" />,
      text: `+${entry.delta} VOC XP`,
    };
  }
  if (type === "EVOLUTION") {
    const meta = entry.metadata as { oldTitle?: string; newTitle?: string } | null;
    return {
      icon: <Award className="w-3 h-3 text-amber-400 shrink-0" />,
      text: meta?.oldTitle && meta?.newTitle
        ? `Evolved: ${meta.oldTitle} → ${meta.newTitle}`
        : "Evolved to next title",
    };
  }
  if (type === "GATE_ACTIVATED" || type === "GATE_TRIGGERED") {
    return {
      icon: <Lock className="w-3 h-3 text-amber-400 shrink-0" />,
      text: "Gate activated — XP frozen",
    };
  }
  if (type === "GATE_RESET") {
    return {
      icon: <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />,
      text: "Milestone complete — gate reset",
    };
  }
  if (type === "XP_GAINED") {
    return {
      icon: <TrendingUp className="w-3 h-3 text-primary shrink-0" />,
      text: `+${entry.delta} VOC XP`,
    };
  }
  if (type === "CREATED") {
    return {
      icon: <Award className="w-3 h-3 text-primary shrink-0" />,
      text: "Vocation path created",
    };
  }
  return {
    icon: <Clock className="w-3 h-3 text-muted-foreground shrink-0" />,
    text: type.replace(/_/g, " "),
  };
}

function VocationCard({
  vocation,
  onEdit,
  onDelete,
  onCompleteMilestone,
}: {
  vocation: VocationPath;
  onEdit: (v: VocationPath) => void;
  onDelete: (v: VocationPath) => void;
  onCompleteMilestone: (v: VocationPath) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const titleLadder = vocation.titleLadder ?? ["Novice"];
  const currentTitle = titleLadder[vocation.currentTitleIndex] ?? titleLadder[0];
  const xpForLevel = getVocXpForLevel(vocation.currentLevel);
  const xpPercent = Math.min(100, Math.round((vocation.currentXp / xpForLevel) * 100));
  const tierColor = getEvolutionTierColor(vocation.currentTitleIndex);
  const tierBg = getEvolutionTierBg(vocation.currentTitleIndex);
  const isMaxTitle = vocation.currentTitleIndex >= titleLadder.length - 1;

  const { data: logEntries = [] } = useQuery<VocationLog[]>({
    queryKey: ["vocation-log", vocation.id],
    queryFn: () => getVocationLog(vocation.id),
    enabled: showHistory,
    staleTime: 30_000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <Card
        className={`glass-panel border transition-all duration-300 ${
          vocation.gateActive
            ? "border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
            : "border-white/10 hover:border-white/20"
        }`}
      >
        {vocation.gateActive && (
          <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/40 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">Gate Active — XP Frozen</span>
          </div>
        )}

        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="font-display font-bold text-lg text-white truncate">{vocation.name}</h3>
                <Badge
                  variant="outline"
                  className={`text-xs font-bold border px-2 py-0.5 shrink-0 ${tierColor} ${tierBg}`}
                >
                  {currentTitle}
                </Badge>
              </div>
              {vocation.description && (
                <p className="text-sm text-muted-foreground truncate">{vocation.description}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onEdit(vocation)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(vocation)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/3 rounded-lg p-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Level</p>
              <p className="text-xl font-stat font-bold text-white">{vocation.currentLevel}</p>
            </div>
            <div className="bg-white/3 rounded-lg p-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Gate At</p>
              <p className="text-xl font-stat font-bold text-white">{vocation.gateThreshold}</p>
            </div>
            <div className="bg-white/3 rounded-lg p-2">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Quests</p>
              <p className="text-xl font-stat font-bold text-white">{vocation.linkedQuestCount}</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">
                {vocation.gateActive ? (
                  <span className="text-amber-400 font-bold">XP FROZEN</span>
                ) : (
                  <>VOC XP</>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                {vocation.currentXp.toLocaleString()} / {xpForLevel.toLocaleString()}
              </span>
            </div>
            <div className="relative h-2 bg-white/5 rounded-full overflow-hidden border border-white/5">
              <div
                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                  vocation.gateActive
                    ? "bg-amber-500/60"
                    : "bg-gradient-to-r from-primary/60 to-primary"
                }`}
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>

          {!isMaxTitle && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>
                {vocation.currentTitleIndex + 1} / {titleLadder.length} titles unlocked
              </span>
            </div>
          )}
          {isMaxTitle && (
            <div className="flex items-center gap-2 text-xs text-amber-400">
              <Star className="w-3.5 h-3.5 shrink-0" />
              <span>Maximum title reached</span>
            </div>
          )}

          {vocation.gateActive && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-1">
                    {isMaxTitle ? "Mastery Milestone" : "Custom Milestone Quest"}
                  </p>
                  <p className="text-sm text-amber-200/80">
                    {isMaxTitle
                      ? (vocation.milestoneQuestDescription ?? "Complete your mastery milestone to unfreeze VOC XP.")
                      : (vocation.milestoneQuestDescription ?? "Complete your milestone quest to evolve.")}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => onCompleteMilestone(vocation)}
                className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold tracking-widest"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                MARK MILESTONE COMPLETE
              </Button>
            </div>
          )}

          <div className="border-t border-white/5 pt-3">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors w-full"
            >
              <History className="w-3.5 h-3.5" />
              <span>{showHistory ? "Hide" : "Show"} Evolution History</span>
            </button>
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
                    {logEntries.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-1">No history yet.</p>
                    ) : (
                      logEntries.slice(0, 20).map((entry) => {
                        const { icon, text } = formatLogEvent(entry);
                        return (
                          <div key={entry.id} className="flex items-center gap-2 py-0.5">
                            {icon}
                            <span className="text-xs text-muted-foreground flex-1 truncate">{text}</span>
                            <span className="text-xs text-muted-foreground/50 shrink-0">
                              {new Date(entry.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function VocationPaths() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<VocationPath | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VocationPath | null>(null);
  const [evolutionState, setEvolutionState] = useState<{ oldTitle: string; newTitle: string } | null>(null);

  const { data: vocations = [], isLoading } = useQuery({
    queryKey: VOCATION_QUERY_KEY,
    queryFn: listVocations,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: createVocation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VOCATION_QUERY_KEY });
      setShowForm(false);
      toast({ title: "Vocation path created", description: "Start linking quests to earn VOC XP." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateVocationPayload }) =>
      updateVocation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VOCATION_QUERY_KEY });
      setEditTarget(null);
      toast({ title: "Vocation updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VOCATION_QUERY_KEY });
      setDeleteTarget(null);
      toast({ title: "Vocation path deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const milestoneMutation = useMutation({
    mutationFn: (id: string) => completeMilestone(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: VOCATION_QUERY_KEY });
      if (result.evolved && result.oldTitle !== result.newTitle) {
        setEvolutionState({ oldTitle: result.oldTitle, newTitle: result.newTitle });
      } else {
        toast({ title: "Milestone complete!", description: "Gate reset. VOC XP resumes." });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleCreate = useCallback((data: VocationFormData, titles: string[]) => {
    const payload: CreateVocationPayload = {
      name: data.name,
      description: data.description || undefined,
      gateThreshold: data.gateThreshold,
      milestoneQuestDescription: data.milestoneQuestDescription || undefined,
      titleLadder: titles,
    };
    createMutation.mutate(payload);
  }, [createMutation]);

  const handleUpdate = useCallback((data: VocationFormData, titles: string[]) => {
    if (!editTarget) return;
    const payload: UpdateVocationPayload = {
      name: data.name,
      description: data.description || null,
      gateThreshold: data.gateThreshold,
      milestoneQuestDescription: data.milestoneQuestDescription || null,
      titleLadder: titles,
    };
    updateMutation.mutate({ id: editTarget.id, payload });
  }, [editTarget, updateMutation]);

  const gateActiveCount = vocations.filter((v) => v.gateActive).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <InfoTooltip
              variant="default"
              what="Vocation Paths — your class progression system."
              fn="Create fully custom Vocation Paths (e.g., Web Dev, Fitness, Finance). Link quests to earn VOC XP and evolve through your personal title ladder."
              usage="Create a path, define your title ladder, and link quests. When you hit the gate level, complete your milestone quest to evolve your class."
            >
              <h1 className="text-4xl md:text-5xl font-display font-bold text-white tracking-tight mb-1">
                VOCATION PATHS
              </h1>
            </InfoTooltip>
            <p className="text-muted-foreground text-lg tracking-widest uppercase">
              <Layers className="inline w-4 h-4 mr-2 text-primary" />
              Class Progression Engine
            </p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-primary hover:bg-primary/90 shadow-[0_0_15px_rgba(124,58,237,0.3)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Vocation Path
          </Button>
        </div>

        {gateActiveCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 flex items-center gap-3"
          >
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <p className="text-amber-300 text-sm font-semibold">
              {gateActiveCount} vocation{gateActiveCount !== 1 ? "s have" : " has"} an active gate. Complete your milestone quest to evolve.
            </p>
          </motion.div>
        )}
      </motion.div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
        </div>
      )}

      {!isLoading && vocations.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="glass-panel border border-white/10">
            <CardContent className="p-16 text-center space-y-4">
              <Layers className="w-16 h-16 text-muted-foreground mx-auto opacity-30" />
              <h3 className="font-display text-xl text-muted-foreground">No Vocation Paths yet</h3>
              <p className="text-muted-foreground/70 text-sm max-w-sm mx-auto">
                Create your first Vocation Path to start class progression. Define a custom title ladder and link quests to earn VOC XP.
              </p>
              <Button onClick={() => setShowForm(true)} className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" /> Create First Path
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!isLoading && vocations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {vocations.map((v) => (
            <VocationCard
              key={v.id}
              vocation={v}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
              onCompleteMilestone={(voc) => milestoneMutation.mutate(voc.id)}
            />
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) setShowForm(false); }}>
        <DialogContent className="bg-background border border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest text-xl text-white">
              New Vocation Path
            </DialogTitle>
          </DialogHeader>
          <VocationForm
            initial={DEFAULT_FORM}
            initialTitles={["Novice", "Apprentice", "Journeyman"]}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            isSubmitting={createMutation.isPending}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => { if (!open) setEditTarget(null); }}
      >
        <DialogContent className="bg-background border border-white/10 max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest text-xl text-white">
              Edit Vocation Path
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <VocationForm
              initial={{
                name: editTarget.name,
                description: editTarget.description ?? "",
                gateThreshold: editTarget.gateThreshold,
                milestoneQuestDescription: editTarget.milestoneQuestDescription ?? "",
              }}
              initialTitles={editTarget.titleLadder}
              onSubmit={handleUpdate}
              onCancel={() => setEditTarget(null)}
              isSubmitting={updateMutation.isPending}
              mode="edit"
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="bg-background border border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Vocation Path</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              This will unlink all associated quests. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AnimatePresence>
        {evolutionState && (
          <EvolutionAnimation
            oldTitle={evolutionState.oldTitle}
            newTitle={evolutionState.newTitle}
            onComplete={() => setEvolutionState(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
