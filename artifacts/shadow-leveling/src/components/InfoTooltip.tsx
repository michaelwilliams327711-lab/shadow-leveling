import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  what: string;
  fn: string;
  usage: string;
  children: React.ReactNode;
  variant?: "default" | "shadow";
}

interface TooltipPos {
  x: number;
  y: number;
  anchorRect?: DOMRect;
}

const TOOLTIP_WIDTH = 260;
const TOOLTIP_OFFSET = 14;

const THEMES = {
  default: {
    panel: "rounded-xl border border-primary/30 bg-[#0d0d1a]/95 backdrop-blur-md shadow-[0_0_20px_rgba(124,58,237,0.2)] p-3 text-xs",
    dot: "#7c3aed",
    badgeLabel: "#7c3aed",
    badgeBg: "transparent",
    whatColor: "#7c3aed",
    dividerColor: "rgba(124,58,237,0.2)",
    labelColor: "#a1a1aa",
    valueColor: "#ffffff",
  },
  shadow: {
    panel: "rounded-xl p-3 text-xs backdrop-blur-md",
    panelStyle: {
      background: "#1c0a0a",
      border: "1px solid #ef4444",
      boxShadow: "0 0 20px rgba(239,68,68,0.2)",
    },
    dot: "#ef4444",
    badgeLabel: "#ef4444",
    whatColor: "#ef4444",
    dividerColor: "rgba(239,68,68,0.25)",
    labelColor: "#a1a1aa",
    valueColor: "#fca5a5",
  },
};

function flipX(cursorX: number): number {
  const rightEdge = cursorX + TOOLTIP_OFFSET + TOOLTIP_WIDTH;
  if (rightEdge > window.innerWidth) {
    return Math.max(8, cursorX - TOOLTIP_OFFSET - TOOLTIP_WIDTH);
  }
  return cursorX + TOOLTIP_OFFSET;
}

function clampY(rawY: number, height: number): number {
  const margin = 8;
  if (rawY + height > window.innerHeight - margin) {
    return Math.max(8, rawY - height - TOOLTIP_OFFSET * 2);
  }
  return rawY;
}

export function InfoTooltip({ what, fn, usage, children, variant = "default" }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<TooltipPos>({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const theme = THEMES[variant];

  useEffect(() => {
    setIsMobile(window.matchMedia("(hover: none)").matches);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const tipHeight = tooltipRef.current?.offsetHeight ?? 120;
    setPos({
      x: flipX(e.clientX),
      y: clampY(e.clientY + TOOLTIP_OFFSET, tipHeight),
    });
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const tipHeight = tooltipRef.current?.offsetHeight ?? 120;
    setPos({
      x: flipX(e.clientX),
      y: clampY(e.clientY + TOOLTIP_OFFSET, tipHeight),
    });
    setVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setVisible(false);
  }, []);

  const handleTap = useCallback((e: React.TouchEvent) => {
    e.stopPropagation();
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setPos({ x: 0, y: 0, anchorRect: rect });
    setVisible((v) => !v);
  }, []);

  useEffect(() => {
    if (!isMobile || !visible) return;
    const dismiss = (e: TouchEvent) => {
      if (
        wrapperRef.current?.contains(e.target as Node) ||
        tooltipRef.current?.contains(e.target as Node)
      )
        return;
      setVisible(false);
    };
    document.addEventListener("touchstart", dismiss);
    return () => document.removeEventListener("touchstart", dismiss);
  }, [isMobile, visible]);

  const basePositionStyle: React.CSSProperties = isMobile
    ? pos.anchorRect
      ? {
          position: "fixed",
          top: Math.min(pos.anchorRect.bottom + 8, window.innerHeight - 200),
          left: Math.max(
            8,
            Math.min(
              pos.anchorRect.left + pos.anchorRect.width / 2 - TOOLTIP_WIDTH / 2,
              window.innerWidth - TOOLTIP_WIDTH - 8
            )
          ),
          width: TOOLTIP_WIDTH,
          zIndex: 9999,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transition: "opacity 0.15s ease",
        }
      : { display: "none" }
    : {
        position: "fixed",
        top: pos.y,
        left: pos.x,
        width: TOOLTIP_WIDTH,
        zIndex: 9999,
        pointerEvents: "none",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.15s ease",
      };

  const tooltipStyle: React.CSSProperties = {
    ...basePositionStyle,
    ...(variant === "shadow" ? THEMES.shadow.panelStyle : {}),
  };

  const tooltip = (
    <div
      ref={tooltipRef}
      style={tooltipStyle}
      className={theme.panel}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full inline-block"
          style={{ background: theme.dot }}
        />
        <span
          className="font-display font-bold uppercase tracking-widest text-[10px]"
          style={{ color: theme.badgeLabel }}
        >
          {variant === "shadow" ? "Shadow Intel" : "System Info"}
        </span>
      </div>
      <div
        className="mb-2 pb-2"
        style={{ borderBottom: `1px solid ${theme.dividerColor}` }}
      >
        <span
          className="font-bold text-[11px] leading-snug"
          style={{ color: theme.whatColor }}
        >
          {what}
        </span>
      </div>
      <div className="space-y-1.5">
        <div>
          <span style={{ color: theme.labelColor }}>Function: </span>
          <span style={{ color: theme.valueColor }}>{fn}</span>
        </div>
        <div>
          <span style={{ color: theme.labelColor }}>Usage: </span>
          <span style={{ color: theme.valueColor }}>{usage}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={wrapperRef}
        className="cursor-help"
        onMouseEnter={!isMobile ? handleMouseEnter : undefined}
        onMouseMove={!isMobile ? handleMouseMove : undefined}
        onMouseLeave={!isMobile ? handleMouseLeave : undefined}
        onTouchEnd={isMobile ? handleTap : undefined}
      >
        {children}
      </div>
      {typeof document !== "undefined" && createPortal(tooltip, document.body)}
    </>
  );
}
