import { motion, type Variants, type MotionProps } from "framer-motion";
import type { ReactNode } from "react";

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const scaleUpVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 },
};

export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const slideDownVariants: Variants = {
  hidden: { opacity: 0, y: -60 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -60 },
};

export const glowPulseVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: [0, 1, 0.7, 1],
    scale: [0.9, 1.05, 1.0, 1.05],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

interface FadeInProps extends MotionProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  reduced?: boolean;
}

export function FadeIn({ children, delay = 0, duration = 0.35, className, reduced, ...rest }: FadeInProps) {
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={fadeInVariants}
      transition={{ delay, duration }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function ScaleUp({ children, delay = 0, duration = 0.4, className, reduced, ...rest }: FadeInProps) {
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={scaleUpVariants}
      transition={{ delay, duration, type: "spring", stiffness: 200, damping: 15 }}
      className={className}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

interface ParticleBurstProps {
  count?: number;
  colors?: string[];
  spread?: number;
  reduced?: boolean;
}

export function ParticleBurst({ count = 16, colors = ["#a855f7", "#22d3ee", "#facc15", "#4ade80"], spread = 180, reduced }: ParticleBurstProps) {
  if (reduced) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const distance = spread * (0.6 + Math.random() * 0.4);
        return (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: Math.random() * 6 + 3,
              height: Math.random() * 6 + 3,
              background: colors[i % colors.length],
              boxShadow: `0 0 6px ${colors[i % colors.length]}`,
              top: "50%",
              left: "50%",
            }}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{
              x: Math.cos(angle) * distance,
              y: Math.sin(angle) * distance,
              opacity: 0,
              scale: 0,
            }}
            transition={{ duration: 0.8 + Math.random() * 0.4, ease: "easeOut" }}
          />
        );
      })}
    </>
  );
}

interface GlowPulseProps {
  color?: string;
  className?: string;
  reduced?: boolean;
  children?: ReactNode;
}

export function GlowPulse({ color = "rgba(124,58,237,0.6)", className, reduced, children }: GlowPulseProps) {
  if (children) {
    return (
      <div className={`relative ${className ?? ""}`}>
        {children}
        {!reduced && (
          <motion.div
            className="absolute inset-0 rounded-lg pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.6, 0.3, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{ background: `radial-gradient(ellipse at center, ${color} 0%, transparent 70%)` }}
          />
        )}
      </div>
    );
  }
  if (reduced) return null;
  return (
    <motion.div
      className={`absolute inset-0 rounded-lg pointer-events-none ${className ?? ""}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: [0, 1, 0.6, 1], scale: [0.95, 1.05, 1.0, 1.05] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      style={{ background: `radial-gradient(ellipse at center, ${color} 0%, transparent 70%)` }}
    />
  );
}
