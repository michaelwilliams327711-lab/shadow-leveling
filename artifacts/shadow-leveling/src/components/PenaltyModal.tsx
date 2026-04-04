import { AlertTriangle, Skull, Zap, Coins } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PenaltyEvent {
  type: string;
  description: string;
  xpDeducted: number;
  goldDeducted: number;
  occurredAt: string;
}

interface PenaltyModalProps {
  penalties: PenaltyEvent[];
  onDismiss: () => void;
}

export function PenaltyModal({ penalties, onDismiss }: PenaltyModalProps) {
  if (penalties.length === 0) return null;

  const totalXp = penalties.reduce((sum, p) => sum + p.xpDeducted, 0);
  const totalGold = penalties.reduce((sum, p) => sum + p.goldDeducted, 0);

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg border-2 border-destructive/60 bg-[#0d0608] shadow-[0_0_60px_rgba(220,38,38,0.3)] [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center pb-2 border-b border-destructive/30">
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse rounded-full bg-destructive/20 blur-xl scale-150" />
              <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 border-2 border-destructive/50">
                <Skull className="w-8 h-8 text-destructive" />
              </div>
            </div>
          </div>
          <DialogTitle className="text-destructive font-display tracking-widest uppercase text-xl">
            ⚠ System Alert ⚠
          </DialogTitle>
          <DialogDescription className="text-destructive/70 text-sm tracking-wider uppercase mt-1">
            Penalties Applied — Weakness Has a Price
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-64 overflow-y-auto">
          {penalties.map((penalty) => (
            <div
              key={`${penalty.occurredAt}-${penalty.type}-${penalty.description}`}
              className="rounded border border-destructive/30 bg-destructive/5 p-3"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white/90 leading-snug">{penalty.description}</p>
                  <div className="flex items-center gap-4 mt-2">
                    {penalty.xpDeducted > 0 && (
                      <span className="flex items-center gap-1 text-destructive font-bold text-sm">
                        <Zap className="w-3.5 h-3.5" />
                        −{penalty.xpDeducted} XP
                      </span>
                    )}
                    {penalty.goldDeducted > 0 && (
                      <span className="flex items-center gap-1 text-destructive font-bold text-sm">
                        <Coins className="w-3.5 h-3.5" />
                        −{penalty.goldDeducted} G
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {(totalXp > 0 || totalGold > 0) && (
          <div className="rounded border border-destructive/50 bg-destructive/10 p-3 flex items-center justify-between">
            <span className="text-sm text-white/70 tracking-wider uppercase font-bold">Total Lost</span>
            <div className="flex items-center gap-4">
              {totalXp > 0 && (
                <span className="flex items-center gap-1 text-destructive font-bold text-base">
                  <Zap className="w-4 h-4" />
                  −{totalXp} XP
                </span>
              )}
              {totalGold > 0 && (
                <span className="flex items-center gap-1 text-gold font-bold text-base">
                  <Coins className="w-4 h-4" />
                  −{totalGold} G
                </span>
              )}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground tracking-wider italic">
          The weak are punished. Rise stronger — or be consumed.
        </p>

        <Button
          onClick={onDismiss}
          className="w-full bg-destructive/20 hover:bg-destructive/40 border border-destructive/50 text-destructive hover:text-white font-display tracking-widest uppercase transition-all duration-200"
          variant="outline"
        >
          Acknowledge & Rise
        </Button>
      </DialogContent>
    </Dialog>
  );
}
