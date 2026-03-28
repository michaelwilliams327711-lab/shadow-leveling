import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useListQuests, 
  useCompleteQuest, 
  useFailQuest,
  useCreateQuest,
  getListQuestsQueryKey,
  getGetCharacterQueryKey,
  QuestCategory,
  QuestDifficulty
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollText, Clock, Trophy, Plus, CheckCircle2, XCircle } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.nativeEnum(QuestCategory),
  difficulty: z.nativeEnum(QuestDifficulty),
  durationMinutes: z.coerce.number().min(1),
  isDaily: z.boolean(),
});

export default function Quests() {
  const { data: quests = [], isLoading } = useListQuests();
  const createQuest = useCreateQuest();
  const completeQuest = useCompleteQuest();
  const failQuest = useFailQuest();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      category: QuestCategory.Productivity,
      difficulty: QuestDifficulty.E,
      durationMinutes: 30,
      isDaily: true
    }
  });

  const invalidateAndToast = (title: string, desc: string, variant: "default" | "destructive" = "default") => {
    queryClient.invalidateQueries({ queryKey: getListQuestsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
    toast({ title, description: desc, variant });
  };

  const onComplete = (id: number) => {
    completeQuest.mutate({ id }, {
      onSuccess: (res) => {
        invalidateAndToast(
          "Quest Cleared", 
          `Reward: +${res.xpAwarded} XP | +${res.goldAwarded} Gold`
        );
        if (res.leveledUp) {
          setTimeout(() => toast({ title: "LEVEL UP!", description: `You reached Level ${res.newLevel}!`, variant: "default" }), 1000);
        }
      }
    });
  };

  const onFail = (id: number) => {
    failQuest.mutate({ id }, {
      onSuccess: (res) => invalidateAndToast("Quest Failed", `Penalty: -${res.xpDeducted} XP | -${res.goldDeducted} Gold`, "destructive")
    });
  };

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    createQuest.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListQuestsQueryKey() });
        setIsDialogOpen(false);
        form.reset();
        toast({ title: "Quest Registered", description: "A new mission has been added to the system." });
      }
    });
  };

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

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold tracking-wider hover-glow">
              <Plus className="w-4 h-4 mr-2" /> ADD QUEST
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-white/10 sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-display tracking-widest text-xl">Register Mission</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quest Objective</FormLabel>
                    <FormControl><Input {...field} className="bg-background/50" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {Object.values(QuestCategory).map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="difficulty" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rank</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <FormField control={form.control} name="durationMinutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Est. Duration (mins)</FormLabel>
                    <FormControl><Input type="number" {...field} className="bg-background/50" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 mt-4" disabled={createQuest.isPending}>
                  {createQuest.isPending ? "Registering..." : "Submit Mission"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="bg-card border border-white/5 mb-6 w-full justify-start rounded-xl p-1">
          <TabsTrigger value="active" className="rounded-lg tracking-widest font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-primary">ACTIVE</TabsTrigger>
          <TabsTrigger value="completed" className="rounded-lg tracking-widest font-semibold data-[state=active]:bg-green-500/20 data-[state=active]:text-green-400">CLEARED</TabsTrigger>
          <TabsTrigger value="failed" className="rounded-lg tracking-widest font-semibold data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive">FAILED</TabsTrigger>
        </TabsList>

        {['active', 'completed', 'failed'].map((status) => (
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
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <Badge className={`${difficultyColors[quest.difficulty]} px-2 py-0 uppercase tracking-widest font-bold border rounded-sm`}>
                            Rank {quest.difficulty}
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground border-white/10 bg-white/5">
                            {quest.category}
                          </Badge>
                          {quest.isDaily && <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-none">Daily</Badge>}
                        </div>
                        <h3 className="text-xl font-bold text-white font-sans">{quest.name}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
                          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {quest.durationMinutes}m</span>
                          <span className="flex items-center gap-1.5 text-primary"><Trophy className="w-4 h-4" /> {quest.xpReward} XP</span>
                          <span className="flex items-center gap-1.5 text-gold"><Trophy className="w-4 h-4" /> {quest.goldReward} G</span>
                        </div>
                      </div>

                      {status === 'active' && (
                        <div className="flex w-full sm:w-auto gap-2">
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
                        </div>
                      )}
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
