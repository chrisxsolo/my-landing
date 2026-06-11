"use client";
// Shared glass primitives for the Revenue command center: panels, animated
// numbers, deltas, sparklines, tooltips, skeletons and empty states.
// All motion respects prefers-reduced-motion.

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { fmtMoney, fmtPct } from "@/lib/revenue/format";
import type { Delta } from "@/lib/revenue/calc";
import { REV } from "./palette";

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

// ── Panels ──────────────────────────────────────────────────────────────────
export function GlassPanel({ children, className = "", hoverable = false }: {
  children: ReactNode; className?: string; hoverable?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl backdrop-blur-md transition-all duration-200 ${hoverable ? "hover:-translate-y-px" : ""} ${className}`}
      style={{ background: REV.panel, border: `1px solid ${REV.panelBorder}`, boxShadow: REV.shadow }}
      onMouseEnter={hoverable ? e => { e.currentTarget.style.background = REV.panelHover; e.currentTarget.style.borderColor = REV.panelBorderStrong; } : undefined}
      onMouseLeave={hoverable ? e => { e.currentTarget.style.background = REV.panel; e.currentTarget.style.borderColor = REV.panelBorder; } : undefined}>
      {children}
    </div>
  );
}

export function SectionHeader({ kicker, title, accent = REV.accent, right }: {
  kicker: string; title: string; accent?: string; right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] mb-1" style={{ color: accent }}>{kicker}</p>
        <h3 className="text-base font-black leading-tight" style={{ color: REV.text }}>{title}</h3>
      </div>
      {right}
    </div>
  );
}

// ── Animated money counter (150–500ms, reduced-motion aware) ────────────────
export function CountUp({ cents, className, color, formatter = fmtMoney }: {
  cents: number; className?: string; color?: string; formatter?: (cents: number) => string;
}) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (reduced) { prev.current = cents; return; }
    const from = prev.current;
    const t0 = performance.now();
    const dur = 450;
    let raf = 0;
    function tick(now: number) {
      const t = Math.min((now - t0) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (cents - from) * ease));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = cents;
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cents, reduced]);
  return <span className={className} style={color ? { color } : undefined}>{formatter(reduced ? cents : val)}</span>;
}

// ── Comparison delta chip ───────────────────────────────────────────────────
// Color is never the only signal: arrows + text carry the direction too.
export function DeltaChip({ delta, compareLabel, invert = false }: {
  delta: Delta; compareLabel: string | null; invert?: boolean;
}) {
  if (delta.kind === "none" || !compareLabel) {
    return <span className="text-[10px] font-bold" style={{ color: REV.textFaint }}>No prior-period data</span>;
  }
  if (delta.kind === "zero") {
    return <span className="text-[10px] font-bold" style={{ color: REV.textFaint }}>No activity in either period</span>;
  }
  if (delta.kind === "new") {
    return (
      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ background: REV.accentBg, color: REV.accent }}>
        New — {compareLabel} was $0
      </span>
    );
  }
  const good = invert ? delta.ratio <= 0 : delta.ratio >= 0;
  const arrow = delta.ratio > 0 ? "▲" : delta.ratio < 0 ? "▼" : "—";
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md"
      style={{ background: good ? REV.accentBg : REV.redBg, color: good ? REV.accent : REV.red }}
      aria-label={`${fmtPct(delta.ratio)} (${fmtMoney(delta.diff)}) versus ${compareLabel}`}>
      <span aria-hidden>{arrow}</span>{fmtPct(delta.ratio)}
      <span className="font-bold" style={{ color: REV.textSoft }}>({fmtMoney(delta.diff)})</span>
    </span>
  );
}

// ── Sparkline ───────────────────────────────────────────────────────────────
export function Sparkline({ values, color = REV.accent, width = 96, height = 28 }: {
  values: number[]; color?: string; width?: number; height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (width - 2) + 1;
    const y = height - 2 - (v / max) * (height - 4);
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
      <polygon points={`1,${height - 2} ${pts.join(" ")} ${width - 1},${height - 2}`} fill={color} opacity={0.12} />
    </svg>
  );
}

// ── Accessible tooltip (hover + focus) ──────────────────────────────────────
export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button type="button" aria-label={`How this is calculated: ${text}`}
        className="w-3.5 h-3.5 rounded-full text-[8px] font-black leading-none inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        style={{ background: REV.neutralBg, color: REV.textSoft }}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
        i
      </button>
      {open && (
        <span role="tooltip"
          className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-52 px-2.5 py-2 rounded-lg text-[10px] font-medium leading-snug normal-case tracking-normal text-left"
          style={{ background: "rgba(10,16,30,0.97)", border: `1px solid ${REV.panelBorderStrong}`, color: REV.textSoft, boxShadow: REV.shadow }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ── Loading / empty states ──────────────────────────────────────────────────
export function Skeleton({ className = "h-4 w-24" }: { className?: string }) {
  return <div className={`rounded-md animate-pulse ${className}`} style={{ background: "rgba(148,163,184,0.12)" }} />;
}

export function EmptyState({ message, hint }: { message: string; hint?: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-sm font-bold" style={{ color: REV.textSoft }}>{message}</p>
      {hint && <p className="text-xs mt-1" style={{ color: REV.textFaint }}>{hint}</p>}
    </div>
  );
}

// ── Section entrance (staggered, reduced-motion aware) ──────────────────────
export function Reveal({ children, delay = 0, id }: { children: ReactNode; delay?: number; id?: string }) {
  const reduced = useReducedMotion();
  return (
    <section id={id} className="scroll-mt-24"
      style={reduced ? undefined : { animation: `rev-rise 0.4s cubic-bezier(0.22,1,0.36,1) ${delay}ms both` }}>
      {children}
    </section>
  );
}

/** Keyframes used across the dashboard; rendered once by RevenueDashboard. */
export function RevStyles() {
  return (
    <style>{`
      @keyframes rev-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @keyframes rev-draw { from { stroke-dashoffset: var(--rev-len, 1200); } to { stroke-dashoffset: 0; } }
      @keyframes rev-fade { from { opacity: 0; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .rev-canvas * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
      }
    `}</style>
  );
}
