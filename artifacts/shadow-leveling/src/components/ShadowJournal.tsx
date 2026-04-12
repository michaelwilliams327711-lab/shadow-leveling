import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { BookOpen, Ghost, Star, Zap, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface JournalEntry {
  id: number;
  shadowId: number | null;
  shadowName: string;
  shadowRank: string;
  questId: number | null;
  questName: string;
  questCategory: string;
  questDifficulty: string;
  shadowBonusPct: number;
  xpAwarded: number;
  goldAwarded: number;
  occurredAt: string;
}

const RANK_COLORS: Record<string, string> = {
  S: "border-yellow-500/50 text-yellow-300 bg-yellow-900/20",
  A: "border-purple-500/50 text-purple-300 bg-purple-900/20",
  B: "border-blue-500/50 text-blue-300 bg-blue-900/20",
  C: "border-cyan-600/50 text-cyan-300 bg-cyan-900/20",
  D: "border-zinc-600/50 text-zinc-400 bg-zinc-900/20",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  F: "text-zinc-500", E: "text-zinc-400", D: "text-green-400",
  C: "text-cyan-400",  B: "text-blue-400", A: "text-purple-400",
  S: "text-yellow-400", SS: "text-orange-400", SSS: "text-red-400",
};

function rankColor(rank: string) {
  return RANK_COLORS[rank] ?? RANK_COLORS["D"];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ShadowJournal() {
  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["shadow-journal"],
    queryFn: ({ signal }) => customFetch<JournalEntry[]>("/api/shadows/journal", { signal }),
    staleTime: 60_000,
  });

  return (
    <Card className="glass-panel border border-blue-900/40 mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="font-display tracking-widest text-lg text-blue-300 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          SHADOW JOURNAL
          {entries.length > 0 && (
            <span className="ml-auto text-xs font-mono text-muted-foreground font-normal">
              {entries.length} record{entries.length !== 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <BookOpen className="w-10 h-10 text-blue-900/50" />
            <p className="text-muted-foreground text-sm tracking-wide">
              No shadow-assisted completions yet. Assign a soldier to a quest and complete it to begin the record.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-start gap-3 p-3 rounded-lg border border-blue-900/20 bg-blue-950/10 hover:bg-blue-950/20 transition-colors"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-900/20 border border-blue-800/30 flex items-center justify-center mt-0.5">
                  <Ghost className="w-4 h-4 text-blue-400/70" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-sm font-bold text-white truncate">{entry.shadowName}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 font-bold border ${rankColor(entry.shadowRank)}`}>
                      {entry.shadowRank}
                    </Badge>
                    <span className="text-[10px] text-blue-300 font-mono bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-800/30 flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5" />
                      +{Math.round(entry.shadowBonusPct * 100)}% XP
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground truncate mb-1.5">
                    <span className="text-white/60">Quest:</span>{" "}
                    <span className={`font-semibold ${DIFFICULTY_COLORS[entry.questDifficulty] ?? "text-zinc-400"}`}>
                      [{entry.questDifficulty}]
                    </span>{" "}
                    {entry.questName}
                  </p>

                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-primary font-mono font-bold">
                      <Zap className="w-3 h-3" />
                      +{entry.xpAwarded.toLocaleString()} XP
                    </span>
                    <span className="flex items-center gap-1 text-xs text-yellow-400 font-mono font-bold">
                      <Coins className="w-3 h-3" />
                      +{entry.goldAwarded.toLocaleString()} G
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {timeAgo(entry.occurredAt)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
