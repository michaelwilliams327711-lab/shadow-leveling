import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Layers, Lock, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { listVocations, getVocXpForLevel, getEvolutionTierColor, getEvolutionTierBg } from "@/lib/vocations-client";

const VOCATION_QUERY_KEY = ["vocations"] as const;

export function VocationWidget() {
  const { data: vocations = [] } = useQuery({
    queryKey: VOCATION_QUERY_KEY,
    queryFn: listVocations,
    staleTime: 60_000,
  });

  if (vocations.length === 0) return null;

  const topVocation = vocations.sort((a, b) => b.currentLevel - a.currentLevel)[0];
  if (!topVocation) return null;

  const titleLadder = topVocation.titleLadder ?? ["Novice"];
  const currentTitle = titleLadder[topVocation.currentTitleIndex] ?? titleLadder[0];
  const xpForLevel = getVocXpForLevel(topVocation.currentLevel);
  const xpPercent = Math.min(100, Math.round((topVocation.currentXp / xpForLevel) * 100));
  const tierColor = getEvolutionTierColor(topVocation.currentTitleIndex);
  const tierBg = getEvolutionTierBg(topVocation.currentTitleIndex);

  return (
    <Link href="/vocations">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.01 }}
        className="cursor-pointer"
      >
        <Card
          className={`glass-panel border transition-all duration-300 ${
            topVocation.gateActive
              ? "border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.12)]"
              : "border-white/10 hover:border-white/20"
          }`}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">Vocation</span>
              </div>
              {topVocation.gateActive && (
                <div className="flex items-center gap-1 shrink-0">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span className="text-xs text-amber-400 font-bold tracking-widest uppercase">Gate Active</span>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 flex-wrap">
              <span className="font-display font-bold text-white text-base leading-tight truncate flex-1 min-w-0">
                {topVocation.name}
              </span>
              <Badge
                variant="outline"
                className={`text-xs shrink-0 border font-bold px-2 py-0 ${tierColor} ${tierBg}`}
              >
                {currentTitle}
              </Badge>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Lv. <strong className="text-white">{topVocation.currentLevel}</strong></span>
              <span className="text-white/20">|</span>
              <span>Gate: <strong className="text-white">{topVocation.gateThreshold}</strong></span>
              <span className="text-white/20">|</span>
              <span>{vocations.length} path{vocations.length !== 1 ? "s" : ""}</span>
            </div>

            <div className="space-y-1">
              <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div
                  className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                    topVocation.gateActive
                      ? "bg-amber-500/60"
                      : "bg-gradient-to-r from-primary/50 to-primary"
                  }`}
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </Link>
  );
}
