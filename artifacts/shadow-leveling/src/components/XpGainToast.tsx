import { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { Sparkles, Coins } from "lucide-react";

interface XpGainToastProps {
  xp: number;
  gold: number;
}

export function XpGainToast({ xp, gold }: XpGainToastProps) {
  const xpSpring = useSpring(0, { stiffness: 400, damping: 25 });
  const goldSpring = useSpring(0, { stiffness: 400, damping: 25 });
  const xpDisplay = useTransform(xpSpring, (v) => Math.round(v).toLocaleString());
  const goldDisplay = useTransform(goldSpring, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    xpSpring.set(xp);
    goldSpring.set(gold);
  }, [xp, gold, xpSpring, goldSpring]);

  return (
    <div className="flex items-center gap-4 font-stat">
      <span className="flex items-center gap-1.5 text-primary">
        <Sparkles className="w-4 h-4" />
        +<motion.span>{xpDisplay}</motion.span> XP
      </span>
      <span className="flex items-center gap-1.5 text-gold">
        <Coins className="w-4 h-4" />
        +<motion.span>{goldDisplay}</motion.span> G
      </span>
    </div>
  );
}
