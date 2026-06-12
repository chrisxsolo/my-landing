"use client";
// Shared visual primitives for the client conversation workspace — Darkroom
// edition. Warm near-black canvas, amber safelight as the single action color,
// paper-white ink, Fraunces display type, mono EXIF-style labels. Every
// surface routes through adminTheme.T so this page stays in lockstep with the
// rest of the Darkroom shell.

import type { CSSProperties, ReactNode } from "react";
import { T } from "@/app/admin/adminTheme";

export { T };

// Conversation-specific extras layered on top of the shared Darkroom theme
export const CONV = {
  bar: "rgba(19,17,20,0.85)",
  barBlur: "saturate(1.4) blur(20px)",
  // Avatar gradients — amber safelight for me, violet for the client
  gradMe: `linear-gradient(135deg, ${T.actionHover}, #c97a2e)`,
  gradClient: "linear-gradient(135deg, #ab95e0, #7a64b8)",
  // My outgoing messages carry a faint safelight wash
  meBubble: "rgba(232,160,76,0.07)",
  meBubbleBorder: "rgba(232,160,76,0.22)",
} as const;

export const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  new:       { label: "New",       color: T.green,    bg: T.greenBg,   border: T.greenBorder,  dot: T.green },
  responded: { label: "Responded", color: T.blue,     bg: T.blueBg,    border: T.blueBorder,   dot: T.blue },
  archived:  { label: "Archived",  color: T.inkFaint, bg: T.neutralBg, border: T.border,       dot: T.inkFaint },
};

// ── Icons (lucide-style strokes) ─────────────────────────────────────────────
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
  zap:       <path d="M13 2 3 14h8l-1 8 11-13h-9l1-7Z" />,
  film:      <><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5" /></>,
  arrow:     <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
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

/** Inline ring spinner. */
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
      style={{ background: T.panel, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
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
          <p className="text-[15px] font-semibold leading-tight" style={{ color: T.ink, fontFamily: T.display }}>{title}</p>
          {sub && <p className="text-[11px] leading-tight mt-0.5" style={{ color: T.inkFaint }}>{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

/** Mono uppercase micro-label — the EXIF-data look used across the Darkroom. */
export function MonoLabel({ children, color = T.inkFaint, className = "" }: {
  children: ReactNode; color?: string; className?: string;
}) {
  return (
    <span className={`text-[10px] font-bold uppercase tracking-[0.14em] ${className}`}
      style={{ color, fontFamily: T.mono }}>
      {children}
    </span>
  );
}

/** Entrance keyframes, safelight pulse, dark input chrome; rendered once by the page. */
export function ConvStyles() {
  return (
    <style>{`
      @keyframes conv-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @keyframes conv-safelight { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
      @keyframes conv-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(232,160,76,0.35); } 50% { box-shadow: 0 0 0 5px rgba(232,160,76,0); } }
      .conv-rise { animation: conv-rise 0.4s cubic-bezier(0.22,1,0.36,1) both; }
      .conv-input { transition: border-color 0.15s, box-shadow 0.15s; outline: none; color-scheme: dark; }
      .conv-input:focus { border-color: rgba(232,160,76,0.55) !important; box-shadow: 0 0 0 3px rgba(232,160,76,0.14); }
      .conv-shell input, .conv-shell select, .conv-shell textarea { color-scheme: dark; }
      .conv-shell ::placeholder { color: rgba(184,178,168,0.42); }
      .conv-shell option { background: ${T.panelSolid}; color: ${T.ink}; }
      @media (prefers-reduced-motion: reduce) { .conv-rise { animation: none; } }
    `}</style>
  );
}
