import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useListQuests, 
  useCompleteQuest, 
  useFailQuest,
  useCreateQuest,
  useUpdateQuest,
  useDeleteQuest,
  getListQuestsQueryKey,
  getGetCharacterQueryKey,
  QuestCategory,
  QuestDifficulty
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollText, Clock, Trophy, Plus, CheckCircle2, XCircle, Pencil, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Quest } from "@workspace/api-client-react";

const STAT_BOOST_MAP: Record<string, string> = {
  Financial: "Discipline",
  Productivity: "Intellect",
  Study: "Intellect",
  Health: "Endurance",
  Creative: "Agility",
  Social: "Agility",
  Other: "Strength",
};

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.nativeEnum(QuestCategory),
  difficulty: z.nativeEnum(QuestDifficulty),
  durationMinutes: z.coerce.number().min(1),
  isDaily: z.boolean(),
});

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.nativeEnum(QuestCategory),
  difficulty: z.nativeEnum(QuestDifficulty),
  durationMinutes: z.coerce.number().min(1),
  isDaily: z.boolean(),
});

function StatBoostBadge({ category }: { category: string }) {
  const stat = STAT_BOOST_MAP[category] ?? "Strength";
  return (
    <div className="flex items-center gap-2 mt-1">
      <Zap className="w-3.5 h-3.5 text-primary" />
      <span className="text-xs text-muted-foreground">Stat Boost:</span>
      <span className="text-xs font-bold text-primary tracking-wider">{stat}</span>
    </div>
  );
}

export default function Quests() {
  const { data: quests = [], isLoading } = useListQuests();
  const createQuest = useCreateQuest();
  const updateQuest = useUpdateQuest();
  const deleteQuest = useDeleteQuest();
  const completeQuest = useCompleteQuest();
  const failQuest = useFailQuest();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null);

  const createForm = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      description: "",
      category: QuestCategory.Productivity,
      difficulty: QuestDifficulty.E,
      durationMinutes: 30,
      isDaily: true
    }
  });

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "",
      description: "",
      category: QuestCategory.Productivity,
      difficulty: QuestDifficulty.E,
      durationMinutes: 30,
      isDaily: false,
    }
  });

  useEffect(() => {
    if (editingQuest) {
      editForm.reset({
        name: editingQuest.name,
        description: editingQuest.description ?? "",
        category: editingQuest.category as QuestCategory,
        difficulty: editingQuest.difficulty as QuestDifficulty,
        durationMinutes: editingQuest.durationMinutes,
        isDaily: editingQuest.isDaily,
      });
    }
  }, [editingQuest, editForm]);

  const invalidateQuests = () => {
    queryClient.invalidateQueries({ queryKey: getListQuestsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
  };

  const onComplete = (id: number) => {
    completeQuest.mutate({ id }, {
      onSuccess: (res) => {
        invalidateQuests();
        toast({ title: "Quest Cleared", description: `+${res.xpAwarded} XP | +${res.goldAwarded} Gold` });
        if (res.leveledUp) {
          setTimeout(() => toast({ title: "LEVEL UP!", description: `You reached Level ${res.newLevel}!` }), 1000);
        }
      }
    });
  };

  const onFail = (id: number) => {
    failQuest.mutate({ id }, {
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

  const onCreateSubmit = (data: z.infer<typeof createSchema>) => {
    createQuest.mutate({ data: { ...data, description: data.description || null } }, {
      onSuccess: () => {
        invalidateQuests();
        setIsCreateOpen(false);
        createForm.reset();
        toast({ title: "Quest Registered", description: "A new mission has been added to the system." });
      }
    });
  };

  const onEditSubmit = (data: z.infer<typeof editSchema>) => {
    if (!editingQuest) return;
    updateQuest.mutate(
      { id: editingQuest.id, data: { ...data, description: data.description || null } },
      {
        onSuccess: () => {
          invalidateQuests();
          setEditingQuest(null);
          toast({ title: "Quest Updated", description: "Mission parameters have been updated." });
        }
      }
    );
  };

  const watchedCreateCategory = createForm.watch("category");
  const watchedEditCategory = editForm.watch("category");

  const difficultyColors: Record<string, string> = {
    F: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    E: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    D: "bg-green-500/20 text-green-400 border-green-500/30",
    C: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    B: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    A: "bg-red-500/20 text-red-400 border-red-500/30",
    S: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    SS: "bg-pink-500/20 text-pink-400 border-pink-500/30 shadow-[0_0_10px_rgba(236,72,153,0.5)]",
    SSS: "bg-primary/20 text-primary border-primary/50 shadow-[0_0_15px_rgba(124,58,237,0.6)] animate-pulse",
  };

  if (isLoading) return <div className="p-8">Loading System Data...</div>;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            <ScrollText className="w-8 h-8 text-primary" />
            QUEST LOG
          </h1>
          <p className="text-muted-foreground mt-1 tracking-wider uppercase text-sm">System missions and daily tasks</p>
        </div>

        {/* Create Quest Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider hover-glow">
              <Plus className="w-4 h-4 mr-2" /> ADD QUEST
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-white/10 sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="font-display tracking-widest text-xl">Register Mission</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4 pt-4">
                <FormField control={createForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quest Objective</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. 1 Hour of C++ Programming" className="bg-background/50" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={createForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description <span className="text-muted-foreground">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="What does this mission entail?" className="bg-background/50 resize-none" rows={2} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={createForm.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.values(QuestCategory).map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <StatBoostBadge category={watchedCreateCategory} />
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={createForm.control} name="difficulty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rank</FormLabel>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={createForm.control} name="durationMinutes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (minutes)</FormLabel>
                      <FormControl><Input type="number" min={1} {...field} className="bg-background/50" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={createForm.control} name="isDaily" render={({ field }) => (
                    <FormItem className="flex flex-col justify-center">
                      <FormLabel>Daily Quest</FormLabel>
                      <div className="flex items-center gap-3 pt-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <span className="text-sm text-muted-foreground">{field.value ? "Yes" : "No"}</span>
                      </div>
                    </FormItem>
                  )} />
                </div>

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
        <DialogContent className="glass-panel border-white/10 sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest text-xl">Edit Mission</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quest Objective</FormLabel>
                  <FormControl><Input {...field} className="bg-background/50" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={editForm.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description <span className="text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea {...field} value={field.value ?? ""} placeholder="What does this mission entail?" className="bg-background/50 resize-none" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {Object.values(QuestCategory).map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <StatBoostBadge category={watchedEditCategory} />
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="difficulty" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rank</FormLabel>
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

              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="durationMinutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl><Input type="number" min={1} {...field} className="bg-background/50" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="isDaily" render={({ field }) => (
                  <FormItem className="flex flex-col justify-center">
                    <FormLabel>Daily Quest</FormLabel>
                    <div className="flex items-center gap-3 pt-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <span className="text-sm text-muted-foreground">{field.value ? "Yes" : "No"}</span>
                    </div>
                  </FormItem>
                )} />
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 mt-4" disabled={updateQuest.isPending}>
                {updateQuest.isPending ? "Updating..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="bg-card border border-white/5 mb-6 w-full justify-start rounded-xl p-1">
          <TabsTrigger value="active" className="rounded-lg tracking-widest font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-primary">ACTIVE</TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg tracking-widest font-semibold data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">CLEARED</TabsTrigger>
          <TabsTrigger value="failed" className="rounded-lg tracking-widest font-semibold data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive">FAILED</TabsTrigger>
        </TabsList>

        {(['active', 'completed', 'failed'] as const).map((status) => (
          <TabsContent key={status} value={status} className="space-y-4">
            {quests.filter(q => q.status === status).length === 0 ? (
              <div className="text-center py-16 border border-dashed border-white/10 rounded-xl glass-panel">
                <p className="text-muted-foreground tracking-widest">NO MISSIONS FOUND</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {quests.filter(q => q.status === status).map(quest => (
                  <Card key={quest.id} className="glass-panel overflow-hidden group">
                    <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <Badge className={`${difficultyColors[quest.difficulty]} px-2 py-0 uppercase tracking-widest font-bold border rounded-sm`}>
                            Rank {quest.difficulty}
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground border-white/10 bg-white/5">
                            {quest.category}
                          </Badge>
                          {quest.isDaily && <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-none">Daily</Badge>}
                          <span className="flex items-center gap-1 text-xs text-primary/70">
                            <Zap className="w-3 h-3" />
                            {STAT_BOOST_MAP[quest.category] ?? "Strength"}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white font-sans">{quest.name}</h3>
                        {quest.description && (
                          <p className="text-sm text-muted-foreground leading-relaxed">{quest.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium flex-wrap">
                          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {quest.durationMinutes}m</span>
                          <span className="flex items-center gap-1.5 text-primary"><Trophy className="w-4 h-4" /> {quest.xpReward} XP</span>
                          <span className="flex items-center gap-1.5 text-yellow-400"><Trophy className="w-4 h-4" /> {quest.goldReward} G</span>
                        </div>
                      </div>

                      <div className="flex w-full sm:w-auto gap-2 flex-wrap sm:flex-nowrap">
                        {status === 'active' && (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              className="border-white/10 text-muted-foreground hover:text-white hover:border-white/30 hover:bg-white/5"
                              onClick={() => setEditingQuest(quest)}
                              title="Edit quest"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              className="flex-1 sm:flex-none border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                              onClick={() => onFail(quest.id)}
                              disabled={failQuest.isPending || completeQuest.isPending}
                            >
                              <XCircle className="w-4 h-4 sm:mr-2" />
                              <span className="hidden sm:inline">Fail</span>
                            </Button>
                            <Button
                              className="flex-1 sm:flex-none bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 hover:text-green-300"
                              onClick={() => onComplete(quest.id)}
                              disabled={failQuest.isPending || completeQuest.isPending}
                            >
                              <CheckCircle2 className="w-4 h-4 sm:mr-2" />
                              <span className="hidden sm:inline">Clear</span>
                            </Button>
                          </>
                        )}
                        {(status === 'completed' || status === 'failed') && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="border-destructive/20 text-destructive/60 hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10"
                            onClick={() => onDelete(quest.id)}
                            title="Delete quest"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
