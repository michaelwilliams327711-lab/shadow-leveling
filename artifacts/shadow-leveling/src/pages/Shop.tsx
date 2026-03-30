import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useListRewards, 
  useCreateReward, 
  usePurchaseReward,
  useGetCharacter,
  getListRewardsQueryKey,
  getGetCharacterQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Store, Coins, Plus, ShoppingCart } from "lucide-react";
import { InfoTooltip } from "@/components/InfoTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  goldCost: z.coerce.number().min(1),
  category: z.string().min(1)
});

export default function Shop() {
  const { data: character } = useGetCharacter();
  const { data: rewards = [], isLoading } = useListRewards();
  const createReward = useCreateReward();
  const purchaseReward = usePurchaseReward();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", description: "", goldCost: 100, category: "Leisure" }
  });

  const onPurchase = (id: number, cost: number) => {
    if ((character?.gold || 0) < cost) {
      toast({ title: "Insufficient Gold", description: "You cannot afford this item.", variant: "destructive" });
      return;
    }

    purchaseReward.mutate({ id }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListRewardsQueryKey() });
        toast({ 
          title: "Item Purchased!", 
          description: `Spent ${res.goldSpent} G. Remaining: ${res.goldRemaining} G`,
          className: "bg-gold/20 border-gold text-gold"
        });
      }
    });
  };

  const onSubmit = (data: z.infer<typeof createSchema>) => {
    createReward.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListRewardsQueryKey() });
        setIsDialogOpen(false);
        form.reset();
        toast({ title: "Item Added", description: "New item registered to the shop." });
      }
    });
  };

  if (isLoading) return <div className="p-8">Loading Shop Data...</div>;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <InfoTooltip
            what="System Shop — exchange Gold for real-life rewards."
            fn="A catalog of rewards you define. Each item has a Gold cost. Purchasing deducts Gold from your treasury."
            usage="Add rewards with the + button. Complete quests to earn Gold, then spend it here on treats you've decided to allow yourself."
          >
            <h1 className="text-4xl font-display font-bold text-white tracking-tight flex items-center gap-3">
              <Store className="w-8 h-8 text-primary" />
              SYSTEM SHOP
            </h1>
          </InfoTooltip>
          <p className="text-muted-foreground mt-1 tracking-wider uppercase text-sm">Spend your Gold. Claim what you've earned.</p>
        </div>

        <div className="flex items-center gap-4">
          <InfoTooltip
            what="Gold — the in-game currency of the System Shop."
            fn="Earned by completing quests. Higher-rank quests and streak multipliers yield more Gold."
            usage="Spend it here to purchase real-life rewards you've defined. Add new rewards with the + button."
          >
            <div className="glass-panel px-6 py-3 rounded-xl flex items-center gap-3 border-gold/30 shadow-[0_0_15px_rgba(250,204,21,0.1)]">
              <Coins className="text-gold w-6 h-6" />
              <span className="text-gold font-stat font-bold text-2xl">{character?.gold?.toLocaleString() || 0}</span>
            </div>
          </InfoTooltip>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="icon" className="h-12 w-12 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/20 hover-glow">
                <Plus className="w-6 h-6" />
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-white/10">
              <DialogHeader>
                <DialogTitle className="font-display tracking-widest text-xl">Register Reward</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reward Name</FormLabel>
                      <FormControl><Input {...field} className="bg-background/50" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="goldCost" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (Gold)</FormLabel>
                      <FormControl><Input type="number" {...field} className="bg-background/50" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl><Input {...field} className="bg-background/50" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full bg-primary hover:bg-primary/90 mt-4" disabled={createReward.isPending}>
                    {createReward.isPending ? "Inscribing..." : "Inscribe to Shop"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {rewards.map(reward => {
          const canAfford = (character?.gold || 0) >= reward.goldCost;
          return (
            <Card key={reward.id} className={`glass-panel overflow-hidden transition-all duration-300 ${canAfford ? 'hover:border-primary/50 hover:shadow-[0_0_20px_rgba(124,58,237,0.15)]' : 'opacity-70 grayscale-[0.3]'}`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{reward.name}</h3>
                    <InfoTooltip
                      what={`Category: ${reward.category} — the type of real-life reward.`}
                      fn="Organizes rewards so you can spot which areas you are rewarding yourself in."
                      usage="Set the category when adding a reward to group similar items together in your shop."
                    >
                      <span className="text-xs uppercase tracking-widest text-muted-foreground bg-white/5 px-2 py-1 rounded">{reward.category}</span>
                    </InfoTooltip>
                  </div>
                  <InfoTooltip
                    what="Gold Cost — the price of this reward."
                    fn="The number of Gold coins required to purchase this item. Deducted from your treasury on purchase."
                    usage="Set prices that feel proportional to the real value of the reward. Higher prices make rewards feel more earned."
                  >
                    <div className="flex items-center gap-1.5 bg-gold/10 px-3 py-1.5 rounded-lg border border-gold/20">
                      <Coins className="w-4 h-4 text-gold" />
                      <span className="font-stat font-bold text-gold">{reward.goldCost}</span>
                    </div>
                  </InfoTooltip>
                </div>
                
                <InfoTooltip
                  what={canAfford ? "Purchase — buy this reward with your Gold." : "Insufficient Gold — you cannot afford this item yet."}
                  fn={canAfford ? "Deducts the Gold cost from your treasury and records the purchase." : "You need more Gold to buy this. Complete more quests to earn Gold."}
                  usage={canAfford ? "Click to redeem this reward. Only buy it when you've truly earned it — this is part of the system." : "Keep completing quests to accumulate the Gold needed. Check the Quest Log to find high-reward missions."}
                >
                  <Button 
                    onClick={() => onPurchase(reward.id, reward.goldCost)}
                    disabled={!canAfford || purchaseReward.isPending}
                    className={`w-full mt-4 flex items-center justify-center gap-2 font-bold tracking-widest transition-all ${
                      canAfford 
                        ? 'bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30' 
                        : 'bg-background text-muted-foreground border border-border'
                    }`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {canAfford ? "CLAIM REWARD" : "INSUFFICIENT GOLD"}
                  </Button>
                </InfoTooltip>
              </CardContent>
            </Card>
          );
        })}
        {rewards.length === 0 && (
          <div className="col-span-full text-center py-20 border border-dashed border-white/10 rounded-xl glass-panel">
            <p className="text-muted-foreground tracking-widest">SHOP INVENTORY EMPTY</p>
          </div>
        )}
      </div>
    </div>
  );
}
