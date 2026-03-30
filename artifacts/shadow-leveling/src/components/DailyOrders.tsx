import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useGetTodaysDailyOrders,
  useCreateDailyOrder,
  useCompleteDailyOrder,
  useDeleteDailyOrder,
  useClaimHiddenBox,
  getDailyOrdersTodayQueryKey,
  type DailyOrder,
  type HiddenBoxResult,
} from "@workspace/api-client-react";
import {
  getGetCharacterQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Plus, Trash2, Target, Package, Zap, Dumbbell, Brain, Shield } from "lucide-react";

const STAT_OPTIONS = [
  { value: "discipline", label: "Discipline", icon: Target, color: "text-purple-400" },
  { value: "strength", label: "Strength", icon: Dumbbell, color: "text-red-400" },
  { value: "agility", label: "Agility", icon: Zap, color: "text-yellow-400" },
  { value: "endurance", label: "Endurance", icon: Shield, color: "text-green-400" },
  { value: "intellect", label: "Intellect", icon: Brain, color: "text-blue-400" },
] as const;

type StatCategory = typeof STAT_OPTIONS[number]["value"];

function getStatOption(value: string) {
  return STAT_OPTIONS.find((s) => s.value === value) ?? STAT_OPTIONS[0];
}

interface HiddenBoxOverlayProps {
  hiddenBox: HiddenBoxResult;
  onAcknowledge: () => void;
  isClaiming: boolean;
}

function HiddenBoxOverlay({ hiddenBox, onAcknowledge, isClaiming }: HiddenBoxOverlayProps) {
  const isGold = hiddenBox.type === "gold";
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotateY: 180 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          transition={{ type: "spring", damping: 14, stiffness: 180, delay: 0.1 }}
          className="relative flex flex-col items-center gap-6 p-10 rounded-2xl max-w-sm mx-auto select-none"
          style={{
            background: "linear-gradient(135deg, #1a0a2e 0%, #0d0515 60%, #180630 100%)",
            border: "2px solid rgba(168,85,247,0.6)",
            boxShadow: "0 0 60px rgba(168,85,247,0.4), 0 0 120px rgba(168,85,247,0.15)",
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.4, 1] }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-7xl"
          >
            {isGold ? "💰" : "⚡"}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center space-y-2"
          >
            <p className="text-xs tracking-[0.3em] uppercase text-purple-400 font-bold">System Drop</p>
            <h2
              className="text-3xl font-display font-black tracking-tight"
              style={{ color: isGold ? "#facc15" : "#a855f7" }}
            >
              Hidden Box
            </h2>
            <div className="h-px w-24 mx-auto" style={{ background: isGold ? "#facc15" : "#a855f7", opacity: 0.5 }} />
            <p className="text-lg font-bold text-white mt-2">
              {isGold
                ? `+${hiddenBox.goldBonus} Gold Obtained`
                : `${hiddenBox.stat ? hiddenBox.stat.charAt(0).toUpperCase() + hiddenBox.stat.slice(1) : "Stat"} +${hiddenBox.statBoost}`}
            </p>
            <p className="text-sm text-purple-300/70">
              {isGold ? "The shadows reward your discipline." : "Your power grows in the darkness."}
            </p>
          </motion.div>

          <motion.div
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.8 }}
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ border: "2px solid rgba(168,85,247,0.3)", boxShadow: "inset 0 0 30px rgba(168,85,247,0.1)" }}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={onAcknowledge}
            disabled={isClaiming}
            className="mt-2 border-purple-500/40 text-purple-300 hover:bg-purple-900/30 hover:text-white tracking-widest text-xs"
          >
            {isClaiming ? "CLAIMING..." : "ACKNOWLEDGE"}
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

interface OrderCardProps {
  order: DailyOrder;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  isCompletingId: string | null;
  isDeletingId: string | null;
}

function OrderCard({ order, onComplete, onDelete, isCompletingId, isDeletingId }: OrderCardProps) {
  const stat = getStatOption(order.statCategory);
  const StatIcon = stat.icon;
  const isCompleting = isCompletingId === order.id;
  const isDeleting = isDeletingId === order.id;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, x: -20 }}
      transition={{ type: "spring", damping: 20, stiffness: 280 }}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 group ${
        order.completed
          ? "bg-white/2 border-white/5 opacity-60"
          : "bg-purple-950/20 border-purple-500/20 hover:border-purple-500/40 hover:bg-purple-950/30"
      }`}
    >
      <button
        onClick={() => !order.completed && onComplete(order.id)}
        disabled={order.completed || isCompleting}
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
          order.completed
            ? "bg-purple-600/30 text-purple-400 cursor-default"
            : "border-2 border-purple-500/40 hover:border-purple-400 hover:bg-purple-600/20 text-transparent hover:text-purple-400 cursor-pointer"
        }`}
      >
        {isCompleting ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
            className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full"
          />
        ) : (
          <Check className="w-4 h-4" />
        )}
      </button>

      <span className={`flex-1 text-sm font-medium ${order.completed ? "line-through text-muted-foreground" : "text-white/90"}`}>
        {order.name}
      </span>

      <div className={`flex items-center gap-1 text-xs font-semibold ${stat.color}`}>
        <StatIcon className="w-3 h-3" />
        <span className="hidden sm:inline">{stat.label}</span>
      </div>

      {!order.completed && (
        <button
          onClick={() => onDelete(order.id)}
          disabled={isDeleting}
          className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}

export function DailyOrders() {
  const [inputValue, setInputValue] = useState("");
  const [selectedStat, setSelectedStat] = useState<StatCategory>("discipline");
  const [isCompletingId, setIsCompletingId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [showHiddenBox, setShowHiddenBox] = useState<HiddenBoxResult | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data } = useGetTodaysDailyOrders();
  const orders: DailyOrder[] = data?.orders ?? [];
  const serverPendingBox = data?.pendingHiddenBox ?? null;

  const createMutation = useCreateDailyOrder();
  const completeMutation = useCompleteDailyOrder();
  const deleteMutation = useDeleteDailyOrder();
  const claimMutation = useClaimHiddenBox();

  const completedCount = orders.filter((o) => o.completed).length;

  const activeHiddenBox = showHiddenBox ?? serverPendingBox;

  const handleCreate = useCallback(() => {
    const name = inputValue.trim();
    if (!name) return;

    createMutation.mutate(
      { name, statCategory: selectedStat },
      {
        onSuccess: () => {
          setInputValue("");
          queryClient.invalidateQueries({ queryKey: getDailyOrdersTodayQueryKey() });
          inputRef.current?.focus();
        },
        onError: () => {
          toast({ title: "Error", description: "Failed to create order.", variant: "destructive" });
        },
      }
    );
  }, [inputValue, selectedStat, createMutation, queryClient, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleCreate();
    }
  };

  const handleComplete = useCallback(
    (id: string) => {
      setIsCompletingId(id);
      completeMutation.mutate(id, {
        onSuccess: (result) => {
          setIsCompletingId(null);
          queryClient.invalidateQueries({ queryKey: getDailyOrdersTodayQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });

          if (result.pendingHiddenBox) {
            setShowHiddenBox(result.pendingHiddenBox);
          } else {
            const statOpt = getStatOption(result.order.statCategory);
            toast({
              title: "Order Cleared",
              description: `+${result.xpAwarded} XP · +1 ${statOpt.label}`,
              className: "bg-purple-900/30 border-purple-500/40 text-white",
            });
          }
        },
        onError: () => {
          setIsCompletingId(null);
          toast({ title: "Error", description: "Failed to complete order.", variant: "destructive" });
        },
      });
    },
    [completeMutation, queryClient, toast]
  );

  const handleAcknowledge = useCallback(() => {
    if (!activeHiddenBox) return;
    setIsClaiming(true);

    claimMutation.mutate(undefined, {
      onSuccess: (result) => {
        setIsClaiming(false);
        setShowHiddenBox(null);
        queryClient.invalidateQueries({ queryKey: getGetCharacterQueryKey() });
        queryClient.invalidateQueries({ queryKey: getDailyOrdersTodayQueryKey() });
        toast({
          title: "Reward Claimed",
          description: activeHiddenBox.type === "gold"
            ? `+${activeHiddenBox.goldBonus} Gold deposited`
            : `${activeHiddenBox.stat} +${activeHiddenBox.statBoost} applied`,
          className: "bg-purple-900/30 border-purple-500/40 text-white",
        });
      },
      onError: () => {
        setIsClaiming(false);
        setShowHiddenBox(null);
        toast({ title: "Error", description: "Failed to claim reward.", variant: "destructive" });
      },
    });
  }, [activeHiddenBox, claimMutation, queryClient, toast]);

  const handleDelete = useCallback(
    (id: string) => {
      setIsDeletingId(id);
      deleteMutation.mutate(id, {
        onSuccess: () => {
          setIsDeletingId(null);
          queryClient.invalidateQueries({ queryKey: getDailyOrdersTodayQueryKey() });
        },
        onError: () => {
          setIsDeletingId(null);
          toast({ title: "Error", description: "Failed to delete order.", variant: "destructive" });
        },
      });
    },
    [deleteMutation, queryClient, toast]
  );

  return (
    <>
      {activeHiddenBox && (
        <HiddenBoxOverlay
          hiddenBox={activeHiddenBox}
          onAcknowledge={handleAcknowledge}
          isClaiming={isClaiming}
        />
      )}

      <Card className="glass-panel border-purple-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="font-display tracking-widest text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-400" />
              Daily Orders
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-bold text-purple-300">
                {completedCount} / 5
              </span>
              {completedCount >= 5 && (
                <Badge className="text-[10px] bg-purple-600/30 text-purple-300 border-purple-500/40 px-1.5">
                  5/5 COMPLETE
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a daily order..."
                className="bg-black/30 border-purple-500/30 focus:border-purple-400 text-white placeholder:text-muted-foreground/50 pr-3 h-9 text-sm"
                disabled={createMutation.isPending}
              />
            </div>

            <select
              value={selectedStat}
              onChange={(e) => setSelectedStat(e.target.value as StatCategory)}
              className="h-9 px-2 rounded-md text-xs font-semibold bg-black/40 border border-purple-500/30 focus:border-purple-400 focus:outline-none text-white cursor-pointer appearance-none min-w-[110px]"
              style={{
                color: selectedStat === "discipline" ? "#c084fc"
                  : selectedStat === "strength" ? "#f87171"
                  : selectedStat === "agility" ? "#facc15"
                  : selectedStat === "endurance" ? "#4ade80"
                  : "#60a5fa"
              }}
            >
              {STAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} style={{ background: "#0f0a1e", color: "white" }}>
                  {opt.label}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!inputValue.trim() || createMutation.isPending}
              className="h-9 px-3 bg-purple-700/60 hover:bg-purple-600/70 border border-purple-500/40 text-white flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {orders.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-muted-foreground text-center py-4 font-sans"
                >
                  No orders yet. Add one above — completing 5 unlocks a Hidden Box.
                </motion.p>
              )}
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onComplete={handleComplete}
                  onDelete={handleDelete}
                  isCompletingId={isCompletingId}
                  isDeletingId={isDeletingId}
                />
              ))}
            </AnimatePresence>
          </div>

          {orders.length > 0 && (
            <div className="pt-1">
              <div className="h-1.5 bg-black/30 rounded-full overflow-hidden border border-white/5">
                <motion.div
                  animate={{ width: `${Math.min(100, (completedCount / 5) * 100)}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%)",
                    boxShadow: "0 0 8px rgba(168,85,247,0.6)",
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60 text-right mt-1">
                {completedCount >= 5 ? "Hidden Box unlocked!" : `${5 - completedCount} more to unlock Hidden Box`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
