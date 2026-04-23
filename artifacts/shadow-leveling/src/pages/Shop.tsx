import { useState, useEffect, useRef, useCallback } from "react";
import {
  useListShopItems,
  usePurchaseShopItem,
  useGetCharacter,
  useGetShopHistory,
  getListShopItemsQueryKey,
  getGetCharacterQueryKey,
  getGetShopHistoryQueryKey,
  type ShopItem,
  type ShopPurchaseHistoryEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, useSpring, useTransform, AnimatePresence } from "framer-motion";
import {
  ShoppingBag,
  Coins,
  AlertCircle,
  BookOpen,
  Cpu,
  UtensilsCrossed,
  Package,
  Lock,
  History,
  Zap,
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

const HOLD_THRESHOLD_GOLD = 2500;
const HOLD_DURATION_MS = 1500;
const HISTORY_LIMIT = 5;

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

function formatHistoryDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

interface HoldPurchaseButtonProps {
  item: ShopItem;
  canAfford: boolean;
  isPurchasing: boolean;
  disabled: boolean;
  onTrigger: () => void;
  reduced: boolean;
}

function HoldPurchaseButton({
  item,
  canAfford,
  isPurchasing,
  disabled,
  onTrigger,
  reduced,
}: HoldPurchaseButtonProps) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const cancelHold = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startedAtRef.current = null;
    firedRef.current = false;
    setIsHolding(false);
    setProgress(0);
  }, []);

  useEffect(() => () => cancelHold(), [cancelHold]);

  const tick = useCallback(() => {
    if (startedAtRef.current === null) return;
    const elapsed = performance.now() - startedAtRef.current;
    const next = Math.min(1, elapsed / HOLD_DURATION_MS);
    setProgress(next);
    if (next >= 1) {
      if (!firedRef.current) {
        firedRef.current = true;
        onTrigger();
      }
      cancelHold();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [cancelHold, onTrigger]);

  const startHold = useCallback(() => {
    if (disabled || !canAfford || isPurchasing) return;
    if (reduced) {
      onTrigger();
      return;
    }
    firedRef.current = false;
    startedAtRef.current = performance.now();
    setIsHolding(true);
    setProgress(0);
    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, canAfford, isPurchasing, reduced, onTrigger, tick]);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
    startHold();
  };
  const onPointerUp = () => cancelHold();
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) {
      e.preventDefault();
      startHold();
    }
  };
  const onKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === " " || e.key === "Enter") cancelHold();
  };

  const ringSize = 22;
  const ringStroke = 2.5;
  const radius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  const glitch = isHolding && progress > 0.15;
  const glowOpacity = 0.2 + progress * 0.6;

  return (
    <button
      type="button"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      disabled={disabled || !canAfford || isPurchasing}
      data-testid={`button-hold-purchase-${item.id}`}
      aria-label={`Hold to authorize purchase of ${item.name} for ${item.cost} gold`}
      className={`relative w-full font-bold tracking-widest transition-all overflow-hidden select-none rounded-md py-2 px-3 text-sm border ${
        canAfford
          ? "bg-primary/20 text-primary border-primary/50 hover:bg-primary/30"
          : "bg-background text-muted-foreground border-border cursor-not-allowed"
      } ${glitch ? "animate-pulse" : ""}`}
      style={
        isHolding
          ? {
              boxShadow: `0 0 ${8 + progress * 24}px rgba(124,58,237,${glowOpacity}), inset 0 0 ${
                4 + progress * 16
              }px rgba(250,204,21,${progress * 0.5})`,
              transform: glitch
                ? `translate(${(Math.random() - 0.5) * 1.5}px, ${(Math.random() - 0.5) * 1.5}px)`
                : undefined,
              backgroundColor: `rgba(124,58,237,${0.2 + progress * 0.25})`,
            }
          : undefined
      }
    >
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isHolding
            ? `linear-gradient(90deg, rgba(250,204,21,${progress * 0.35}) ${
                progress * 100
              }%, transparent ${progress * 100}%)`
            : undefined,
        }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {!canAfford ? (
          <>
            <Lock className="w-3.5 h-3.5" />
            [ INSUFFICIENT GOLD ]
          </>
        ) : isPurchasing ? (
          "[ AUTHORIZING... ]"
        ) : isHolding ? (
          <>
            <svg width={ringSize} height={ringSize} className="-ml-1">
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={ringStroke}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={ringStroke}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              />
            </svg>
            HOLD TO AUTHORIZE — {Math.round(progress * 100)}%
          </>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5" />[ HOLD TO CLAIM ]
          </>
        )}
      </span>
    </button>
  );
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
  const { data: history = [] } = useGetShopHistory();
  const visibleHistory: ShopPurchaseHistoryEntry[] = history.slice(0, HISTORY_LIMIT);

  const goldSpring = useSpring(character?.gold ?? 0, { stiffness: 400, damping: 25 });
  const goldDisplay = useTransform(goldSpring, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    goldSpring.set(character?.gold ?? 0);
  }, [character?.gold, goldSpring]);

  const executePurchase = useCallback(
    (target: PendingPurchase) => {
      const { id } = target;
      setPurchasingId(id);

      purchaseItem.mutate(
        { id },
        {
          onSuccess: (res) => {
            if (!reduced) playGoldSpend();
            queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListShopItemsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetShopHistoryQueryKey() });
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
    },
    [purchaseItem, reduced, queryClient, toast],
  );

  const requestPurchase = (item: PendingPurchase) => {
    if ((character?.gold || 0) < item.cost) {
      toast({
        title: "Insufficient Gold",
        description: `You need ${item.cost.toLocaleString()} G to redeem ${item.name}.`,
        variant: "destructive",
      });
      return;
    }

    if (item.cost >= HOLD_THRESHOLD_GOLD) {
      executePurchase(item);
    } else {
      setPending(item);
    }
  };

  const confirmPurchase = () => {
    if (!pending) return;
    const target = pending;
    setPending(null);
    executePurchase(target);
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
        <Button
          onClick={() => refetch()}
          variant="outline"
          className="border-white/20 tracking-widest"
        >
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
          <motion.span className="text-gold font-stat font-bold text-2xl">
            {goldDisplay}
          </motion.span>
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
            const requiresHold = item.cost >= HOLD_THRESHOLD_GOLD;

            return (
              <Card
                key={item.id}
                className={`glass-panel overflow-hidden transition-all duration-300 relative border ${
                  canAfford
                    ? "border-primary/30 hover:border-primary/70 hover:shadow-[0_0_24px_rgba(124,58,237,0.25)]"
                    : "border-white/5 opacity-60 grayscale"
                }`}
              >
                <GoldSpendAnimation active={isPurchasing} />

                {!canAfford && (
                  <div
                    className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-[1px]"
                    aria-hidden
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/10 bg-background/70 text-muted-foreground text-[10px] tracking-widest uppercase">
                      <Lock className="w-3.5 h-3.5" />
                      Locked — Earn More Gold
                    </div>
                  </div>
                )}

                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/15 border border-primary/40">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-white/5 px-2 py-1 rounded">
                        {item.category}
                      </span>
                      {requiresHold && (
                        <span className="text-[10px] uppercase tracking-widest text-gold/90 bg-gold/10 border border-gold/30 px-2 py-0.5 rounded flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          High-Cost
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-white mb-2 tracking-wide">
                    {item.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 flex-1">
                    {item.description}
                  </p>

                  <div className="flex items-center gap-2 mb-4 bg-gold/10 px-3 py-2 rounded-lg border border-gold/20 w-fit">
                    <Coins className="w-5 h-5 text-gold" />
                    <span className="font-stat font-bold text-gold text-lg">
                      {item.cost.toLocaleString()}
                    </span>
                    <span className="text-gold/70 font-stat font-bold">G</span>
                  </div>

                  {requiresHold ? (
                    <HoldPurchaseButton
                      item={item}
                      canAfford={canAfford}
                      isPurchasing={isPurchasing}
                      disabled={purchaseItem.isPending}
                      reduced={reduced}
                      onTrigger={() =>
                        requestPurchase({
                          id: item.id,
                          name: item.name,
                          cost: item.cost,
                          description: item.description,
                        })
                      }
                    />
                  ) : (
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
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <section className="mt-12" data-testid="section-purchase-history">
        <div className="flex items-center gap-3 mb-4">
          <History className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-bold text-white tracking-widest uppercase">
            Purchase History — Vault
          </h2>
          <span className="text-xs text-muted-foreground tracking-wider uppercase">
            Last {HISTORY_LIMIT} Redeems
          </span>
        </div>
        <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
          {visibleHistory.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm tracking-widest uppercase">
              No redemptions logged yet.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              <AnimatePresence initial={false}>
                {visibleHistory.map((entry) => (
                  <motion.li
                    key={entry.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="flex items-center justify-between px-4 py-3"
                    data-testid={`history-row-${entry.id}`}
                  >
                    <div className="flex flex-col">
                      <span className="text-white font-bold text-sm tracking-wide">
                        {entry.itemName}
                      </span>
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
                        {formatHistoryDate(entry.redeemedAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-gold/10 border border-gold/20 px-2.5 py-1 rounded-md">
                      <Coins className="w-3.5 h-3.5 text-gold" />
                      <span className="font-stat font-bold text-gold text-sm">
                        {entry.goldSpent.toLocaleString()}
                      </span>
                      <span className="text-gold/70 font-stat font-bold text-xs">G</span>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </section>

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
                  <span className="text-gold font-bold">
                    {pending.cost.toLocaleString()} G
                  </span>{" "}
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
