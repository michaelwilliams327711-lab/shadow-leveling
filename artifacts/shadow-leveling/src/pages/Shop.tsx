import {
  useListShopItems,
  usePurchaseShopItem,
  useGetCharacter,
  getListShopItemsQueryKey,
  getGetCharacterQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ShoppingBag,
  Coins,
  AlertCircle,
  BookOpen,
  Cpu,
  UtensilsCrossed,
  Package,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { GoldSpendAnimation } from "@/components/GoldSpendAnimation";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { playGoldSpend } from "@/lib/sounds";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Cpu,
  UtensilsCrossed,
};

function getIcon(name: string) {
  return iconMap[name] ?? Package;
}

interface PendingPurchase {
  id: string;
  name: string;
  cost: number;
  description: string;
}

export default function Shop() {
  const { data: character } = useGetCharacter();
  const { data: items = [], isLoading, isError, refetch } = useListShopItems();
  const purchaseItem = usePurchaseShopItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const reduced = useReducedMotion();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPurchase | null>(null);

  const requestPurchase = (item: PendingPurchase) => {
    if ((character?.gold || 0) < item.cost) {
      toast({
        title: "Insufficient Gold",
        description: `You need ${item.cost.toLocaleString()} G to redeem ${item.name}.`,
        variant: "destructive",
      });
      return;
    }
    setPending(item);
  };

  const confirmPurchase = () => {
    if (!pending) return;
    const { id } = pending;
    setPurchasingId(id);
    setPending(null);

    purchaseItem.mutate(
      { id },
      {
        onSuccess: (res) => {
          if (!reduced) playGoldSpend();
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListShopItemsQueryKey() });
          toast({
            title: "TRANSACTION COMPLETE: Reward Authorized.",
            description: `${res.itemName} — Spent ${res.goldSpent.toLocaleString()} G. Remaining: ${res.goldRemaining.toLocaleString()} G`,
            className: "bg-gold/20 border-gold text-gold",
          });
          setTimeout(() => setPurchasingId(null), 1000);
        },
        onError: (err) => {
          setPurchasingId(null);
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 402) {
            toast({
              title: "Not enough Gold",
              description: "Complete more quests to earn Gold, Hunter.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Purchase Failed",
              description: "An error occurred. Please try again.",
              variant: "destructive",
            });
          }
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <Skeleton className="h-12 w-72 rounded-xl" />
          <Skeleton className="h-12 w-40 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <p className="text-muted-foreground tracking-widest uppercase text-sm">
          System Error — Shop Offline
        </p>
        <Button onClick={() => refetch()} variant="outline" className="border-white/20 tracking-widest">
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-white tracking-tight flex items-center gap-3">
            <ShoppingBag className="w-8 h-8 text-primary" />
            SHADOW SHOP
          </h1>
          <p className="text-muted-foreground mt-1 tracking-wider uppercase text-sm">
            Convert Gold into real-world redeems.
          </p>
        </div>

        <div className="glass-panel px-6 py-3 rounded-xl flex items-center gap-3 border-gold/30 shadow-[0_0_15px_rgba(250,204,21,0.1)]">
          <Coins className="text-gold w-6 h-6" />
          <span className="text-gold font-stat font-bold text-2xl">
            {character?.gold?.toLocaleString() || 0}
          </span>
          <span className="text-gold/70 font-stat font-bold text-lg">G</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-xl glass-panel">
          <p className="text-muted-foreground tracking-widest">SHOP INVENTORY EMPTY</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const canAfford = (character?.gold || 0) >= item.cost;
            const Icon = getIcon(item.icon);
            const isPurchasing = purchasingId === item.id;

            return (
              <Card
                key={item.id}
                className={`glass-panel overflow-hidden transition-all duration-300 relative border border-primary/30 ${
                  canAfford
                    ? "hover:border-primary/70 hover:shadow-[0_0_24px_rgba(124,58,237,0.25)]"
                    : "opacity-70 grayscale-[0.3]"
                }`}
              >
                <GoldSpendAnimation active={isPurchasing} />
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/15 border border-primary/40">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-white/5 px-2 py-1 rounded">
                      {item.category}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2 tracking-wide">{item.name}</h3>
                  <p className="text-sm text-muted-foreground mb-6 flex-1">{item.description}</p>

                  <div className="flex items-center gap-2 mb-4 bg-gold/10 px-3 py-2 rounded-lg border border-gold/20 w-fit">
                    <Coins className="w-5 h-5 text-gold" />
                    <span className="font-stat font-bold text-gold text-lg">
                      {item.cost.toLocaleString()}
                    </span>
                    <span className="text-gold/70 font-stat font-bold">G</span>
                  </div>

                  <Button
                    onClick={() =>
                      requestPurchase({
                        id: item.id,
                        name: item.name,
                        cost: item.cost,
                        description: item.description,
                      })
                    }
                    disabled={!canAfford || purchaseItem.isPending}
                    data-testid={`button-purchase-${item.id}`}
                    className={`w-full font-bold tracking-widest transition-all ${
                      canAfford
                        ? "bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30"
                        : "bg-background text-muted-foreground border border-border"
                    }`}
                  >
                    {canAfford ? "[ PURCHASE ]" : "[ INSUFFICIENT GOLD ]"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent className="glass-panel border border-primary/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display tracking-widest text-xl text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-primary" />
              CONFIRM REDEMPTION
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground pt-2">
              {pending && (
                <>
                  Authorize the system to deduct{" "}
                  <span className="text-gold font-bold">{pending.cost.toLocaleString()} G</span>{" "}
                  in exchange for{" "}
                  <span className="text-white font-bold">{pending.name}</span>.
                  <br />
                  <span className="block mt-2 text-xs uppercase tracking-widest text-muted-foreground/80">
                    {pending.description}
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-background border-white/20 text-muted-foreground hover:bg-white/5"
              data-testid="button-cancel-purchase"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPurchase}
              className="bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30 tracking-widest font-bold"
              data-testid="button-confirm-purchase"
            >
              [ AUTHORIZE ]
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
