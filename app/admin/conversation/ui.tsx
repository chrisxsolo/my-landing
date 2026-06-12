"use client";
// Shared visual primitives for the client conversation workspace — light
// Apple-style glass that matches the Revenue command center (payments/palette.ts).
// No hex values inline in the page component; everything routes through CONV.

import type { CSSProperties, ReactNode } from "react";
import { C } from "@/lib/colors";

export const CONV = {
  // Canvas: soft white with faint brand ambience
  canvas: "linear-gradient(168deg,#fdfdfe 0%,#f6f5f9 52%,#f3f4f7 100%)",
  glowA: "radial-gradient(640px 300px at 10% -6%, rgba(157,111,232,0.09), transparent 70%)",
  glowB: "radial-gradient(720px 340px at 92% 0%, rgba(232,121,160,0.07), transparent 70%)",

  // Surfaces. Panels skip backdrop-filter (perf) — only the sticky bar blurs.
  panel: "rgba(255,255,255,0.82)",
  panelSolid: "#ffffff",
  panelBorder: "rgba(60,60,67,0.10)",
  panelBorderStrong: "rgba(60,60,67,0.18)",
  inset: "rgba(60,60,67,0.055)",
  rowBorder: "rgba(60,60,67,0.08)",
  shadow: "0 8px 28px rgba(17,24,39,0.06)",
  shadowLg: "0 24px 60px rgba(17,24,39,0.18)",
  overlay: "rgba(255,255,255,0.97)",
  scrim: "rgba(17,24,39,0.45)",
  bar: "rgba(255,255,255,0.72)",
  barBlur: "saturate(1.8) blur(16px)",

  // Type (neutral ink)
  text: "#1d1d1f",
  textSoft: "#56565c",
  textFaint: "#8e8e93",

  // Semantics (darkened for contrast on white)
  violet: C.p1,
  violetBg: "rgba(157,111,232,0.10)",
  violetBorder: "rgba(157,111,232,0.22)",
  pink: "#d4537f",
  pinkBg: "rgba(232,121,160,0.11)",
  green: "#0a8a64",
  greenBg: "rgba(16,185,129,0.11)",
  greenBorder: "rgba(16,185,129,0.25)",
  blue: "#2f6fd6",
  blueBg: "rgba(59,123,224,0.11)",
  amber: "#b97309",
  amberBg: "rgba(217,144,12,0.12)",
  amberBorder: "rgba(217,144,12,0.28)",
  red: "#d2363c",
  redBg: "rgba(220,60,66,0.10)",
  redBorder: "rgba(220,60,66,0.30)",
  neutral: "#6e6e73",
  neutralBg: "rgba(110,110,115,0.10)",

  gradBrand: C.grad12,
} as const;

export const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  new:       { label: "New",       color: CONV.green,   bg: CONV.greenBg,   dot: "#10b981" },
  responded: { label: "Responded", color: CONV.blue,    bg: CONV.blueBg,    dot: "#3b82f6" },
  archived:  { label: "Archived",  color: CONV.neutral, bg: CONV.neutralBg, dot: "#a1a1a6" },
};

// ── Icons (lucide-style strokes — replaces emoji throughout the page) ───────
const PATHS = {
  back:      <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  refresh:   <><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></>,
  mail:      <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  phone:     <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />,
  instagram: <><rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17.5 6.5h.01" /></>,
  calendar:  <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 9h18" /></>,
  clock:     <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  pin:       <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  cap:       <><path d="m22 9-10-5L2 9l10 5 10-5Z" /><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5" /></>,
  users:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  sparkle:   <path d="m12 3 1.9 5.6 5.6 1.9-5.6 1.9L12 18l-1.9-5.6-5.6-1.9 5.6-1.9L12 3Z" />,
  mic:       <><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4" /></>,
  keyboard:  <><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" /></>,
  send:      <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
  card:      <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
  doc:       <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></>,
  bell:      <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  sun:       <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  chat:      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />,
  pen:       <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" /></>,
  check:     <path d="M20 6 9 17l-5-5" />,
  copy:      <><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  chevron:   <path d="m6 9 6 6 6-6" />,
  x:         <path d="M18 6 6 18M6 6l12 12" />,
  eye:       <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 14, className, style }: {
  name: IconName; size?: number; className?: string; style?: CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style} aria-hidden>
      {PATHS[name]}
    </svg>
  );
}

/** Inline ring spinner — replaces the old "◌" glyph. */
export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span className="inline-block rounded-full border-2 border-current border-t-transparent animate-spin flex-shrink-0"
      style={{ width: size, height: size }} aria-hidden />
  );
}

// ── Panels ──────────────────────────────────────────────────────────────────
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: CONV.panel, border: `1px solid ${CONV.panelBorder}`, boxShadow: CONV.shadow }}>
      {children}
    </div>
  );
}

export function PanelHead({ icon, tint, bg, title, sub, right }: {
  icon: IconName; tint: string; bg: string; title: string; sub?: string; right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg, color: tint }}>
          <Icon name={icon} size={14} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight" style={{ color: CONV.text }}>{title}</p>
          {sub && <p className="text-[11px] leading-tight mt-0.5" style={{ color: CONV.textFaint }}>{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/** Entrance keyframes + input focus ring; rendered once by the page. */
export function ConvStyles() {
  return (
    <style>{`
      @keyframes conv-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      .conv-rise { animation: conv-rise 0.45s cubic-bezier(0.22,1,0.36,1) both; }
      .conv-input { transition: border-color 0.15s, box-shadow 0.15s; outline: none; }
      .conv-input:focus { border-color: ${C.p1_35} !important; box-shadow: 0 0 0 3px ${C.p1_12}; }
      @media (prefers-reduced-motion: reduce) { .conv-rise { animation: none; } }
    `}</style>
  );
}
