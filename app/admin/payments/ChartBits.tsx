"use client";
import { useEffect, useRef, useState } from "react";
import { fmtMoney } from "./TransactionsPanel";

// Animated counter for money amounts
export function MoneyUp({ target, className, color }: { target: number; className?: string; color?: string }) {
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const t0 = performance.now();
    const dur = 900;
    function tick(now: number) {
      const t = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(from + (target - from) * ease);
      if (t < 1) requestAnimationFrame(tick);
      else prev.current = target;
    }
    requestAnimationFrame(tick);
  }, [target]);
  return <span className={className} style={color ? { color } : undefined}>{fmtMoney(val)}</span>;
}

export function AnimBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 80);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full"
        style={{ width: `${width}%`, background: color, transition: "width 0.7s cubic-bezier(0.22,1,0.36,1)" }} />
    </div>
  );
}

export function BarCol({ pct, isCurrent, isHov, delay }: { pct: number; isCurrent: boolean; isHov: boolean; delay: number }) {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setHeight(pct), delay + 100);
    return () => clearTimeout(t);
  }, [pct, delay]);
  const base = isCurrent
    ? "linear-gradient(180deg,#10b981,#6ee7b7)"
    : "linear-gradient(180deg,rgba(16,185,129,0.35),rgba(16,185,129,0.15))";
  return (
    <div className="w-full flex items-end justify-center" style={{ height: 130 }}>
      <div className="w-full rounded-t-lg" style={{
        height: `${height}%`, minHeight: height > 0 ? 4 : 0,
        background: isHov ? "linear-gradient(180deg,#10b981,#34d399)" : base,
        transition: `height 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}ms, background 0.2s`,
        transform: isHov ? "scaleX(1.08)" : "scaleX(1)",
      }} />
    </div>
  );
}
