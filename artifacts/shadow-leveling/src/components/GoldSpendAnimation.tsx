import { motion, AnimatePresence } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { ScaleUp } from "@/components/animation-primitives";

interface Coin {
  id: number;
  x: number;
  y: number;
  rotation: number;
  size: number;
  delay: number;
}

interface GoldSpendAnimationProps {
  active: boolean;
}

export function GoldSpendAnimation({ active }: GoldSpendAnimationProps) {
  const reduced = useReducedMotion();
  if (reduced) return null;

  const coins: Coin[] = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 200,
    y: Math.random() * 120 + 40,
    rotation: (Math.random() - 0.5) * 720,
    size: Math.random() * 10 + 8,
    delay: i * 0.04,
  }));

  return (
    <AnimatePresence>
      {active && (
        <ScaleUp reduced={false} className="absolute inset-0 pointer-events-none overflow-visible z-20">
        <motion.div
          key="gold-spend"
          className="absolute inset-0 pointer-events-none overflow-visible z-20"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.8, duration: 0.2 }}
        >
          {coins.map((coin) => (
            <motion.div
              key={coin.id}
              className="absolute rounded-full"
              style={{
                width: coin.size,
                height: coin.size,
                background: "radial-gradient(circle at 35% 35%, #fde68a, #facc15, #b45309)",
                boxShadow: "0 0 6px rgba(250,204,21,0.8)",
                top: "50%",
                left: "50%",
              }}
              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
              animate={{
                x: coin.x,
                y: coin.y,
                opacity: 0,
                rotate: coin.rotation,
                scale: 0.3,
              }}
              transition={{
                duration: 0.9,
                delay: coin.delay,
                ease: [0.2, 0.8, 0.4, 1],
              }}
            />
          ))}
        </motion.div>
        </ScaleUp>
      )}
    </AnimatePresence>
  );
}
