"use client";
// Darkroom chrome for the standalone /admin/content-engine pages — same canvas,
// safelight strip and type ramp as the main admin shell (app/admin/page.tsx),
// since these routes render outside that shell's <style>/background scope.
import Link from "next/link";
import { T } from "@/app/admin/adminTheme";

export default function EngineShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: T.page, backgroundImage: T.canvasGlow }}>
      <style>{`
        @keyframes eng-safelight { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes eng-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .eng-rise { animation: eng-rise 0.22s cubic-bezier(0.22,1,0.36,1) both; }
        @media (prefers-reduced-motion: reduce) { .eng-rise { animation-duration: 0.01ms; } }
        .eng-shell input, .eng-shell select, .eng-shell textarea { color-scheme: dark; }
        .eng-shell ::placeholder { color: rgba(184,178,168,0.45); }
        .eng-shell option { background: ${T.panelSolid}; color: ${T.ink}; }
      `}</style>
      <div className="fixed top-0 left-0 right-0 h-[2px] z-50 pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${T.action}, transparent)`, animation: "eng-safelight 5s ease-in-out infinite" }}
        aria-hidden="true" />

      <div className="sticky top-0 z-40 px-4 md:px-6 h-14 flex items-center justify-between"
        style={{ background: "rgba(19,17,20,0.82)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${T.border}` }}>
        <span className="flex items-center gap-2.5 min-w-0" style={{ color: T.ink }}>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: T.action, boxShadow: `0 0 8px ${T.action}` }} />
          <Link href="/admin" className="text-base md:text-lg font-bold hover:opacity-80 transition-opacity" style={{ fontFamily: T.display, color: T.ink }}>
            Chris<span style={{ color: T.action }}>.</span>
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] truncate" style={{ color: T.inkFaint, fontFamily: T.mono }}>
            Darkroom · Content Engine
          </span>
        </span>
        <Link href="/admin"
          className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] transition-all hover:-translate-y-px whitespace-nowrap"
          style={{ background: T.panelSolid, color: T.inkSoft, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
          ← Darkroom
        </Link>
      </div>

      <div className="eng-shell eng-rise">{children}</div>
    </div>
  );
}
