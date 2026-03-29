import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  what: string;
  fn: string;
  usage: string;
  children: React.ReactNode;
}

interface TooltipPos {
  x: number;
  y: number;
  anchorRect?: DOMRect;
}

const TOOLTIP_WIDTH = 260;
const TOOLTIP_OFFSET = 14;

export function InfoTooltip({ what, fn, usage, children }: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<TooltipPos>({ x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile(window.matchMedia("(hover: none)").matches);
  }, []);

  const clampX = (rawX: number) => {
    const margin = 8;
    const maxX = window.innerWidth - TOOLTIP_WIDTH - margin;
    return Math.max(margin, Math.min(rawX, maxX));
  };

  const clampY = (rawY: number, height: number) => {
    const margin = 8;
    if (rawY + height > window.innerHeight - margin) {
      return Math.max(8, rawY - height - TOOLTIP_OFFSET * 2);
    }
    return rawY;
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const tipHeight = tooltipRef.current?.offsetHeight ?? 120;
    setPos({
      x: clampX(e.clientX + TOOLTIP_OFFSET),
      y: clampY(e.clientY + TOOLTIP_OFFSET, tipHeight),
    });
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const tipHeight = tooltipRef.current?.offsetHeight ?? 120;
    setPos({
      x: clampX(e.clientX + TOOLTIP_OFFSET),
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

  const tooltipStyle: React.CSSProperties = isMobile
    ? pos.anchorRect
      ? {
          position: "fixed",
          top: Math.min(
            pos.anchorRect.bottom + 8,
            window.innerHeight - 200
          ),
          left: Math.max(
            8,
            Math.min(
              pos.anchorRect.left + pos.anchorRect.width / 2 - TOOLTIP_WIDTH / 2,
              window.innerWidth - TOOLTIP_WIDTH - 8
            )
          ),
          width: TOOLTIP_WIDTH,
          zIndex: 9999,
        }
      : { display: "none" }
    : {
        position: "fixed",
        top: pos.y,
        left: pos.x,
        width: TOOLTIP_WIDTH,
        zIndex: 9999,
        pointerEvents: "none",
      };

  const tooltip = visible ? (
    <div
      ref={tooltipRef}
      style={tooltipStyle}
      className="rounded-xl border border-primary/30 bg-[#0d0d1a]/95 backdrop-blur-md shadow-[0_0_20px_rgba(124,58,237,0.2)] p-3 text-xs"
    >
      <div className="mb-2 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-primary inline-block" />
        <span className="font-display font-bold uppercase tracking-widest text-primary text-[10px]">
          System Info
        </span>
      </div>
      <div className="space-y-1.5">
        <div>
          <span className="text-muted-foreground">What: </span>
          <span className="text-white">{what}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Function: </span>
          <span className="text-white">{fn}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Usage: </span>
          <span className="text-white">{usage}</span>
        </div>
      </div>
    </div>
  ) : null;

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
