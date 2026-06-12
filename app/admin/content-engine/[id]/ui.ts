// Shared Darkroom-styled primitives for the engine workspace — every section
// builds its surfaces from these so the theme lives in one place (adminTheme T).
import { T } from "@/app/admin/adminTheme";
import type { CSSProperties } from "react";

export const card: CSSProperties = {
  background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16,
  marginBottom: 16, boxShadow: T.shadow,
};
export const input: CSSProperties = {
  border: `1px solid ${T.border}`, borderRadius: 10, padding: "7px 10px",
  background: T.inset, color: T.ink, fontSize: 13, width: "100%", boxSizing: "border-box",
  outline: "none", colorScheme: "dark",
};
export const label: CSSProperties = {
  fontSize: 10, color: T.inkFaint, display: "block", marginBottom: 3,
  fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: T.mono,
};
export function btn(primary = false, danger = false): CSSProperties {
  return {
    border: `1px solid ${danger ? T.redBorder : primary ? "transparent" : T.border}`,
    borderRadius: 10, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 700,
    background: danger ? T.redBg : primary ? T.action : T.inset,
    color: danger ? T.red : primary ? T.actionText : T.inkSoft,
    boxShadow: primary ? T.glow : undefined,
  };
}
export const chip = (color: string, bg: string): CSSProperties => ({
  background: bg, color, borderRadius: 999, padding: "2px 10px", fontSize: 12,
  fontWeight: 700, whiteSpace: "nowrap",
});
export const overlay: CSSProperties = {
  position: "fixed", inset: 0, background: T.scrim, backdropFilter: "blur(6px)",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
};
export const sectionTitle: CSSProperties = {
  fontSize: 16, margin: "0 0 10px", color: T.ink, fontFamily: T.display, fontWeight: 600,
};
