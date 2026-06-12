import { C } from "@/lib/colors";
import type { CSSProperties } from "react";

export const card: CSSProperties = {
  background: C.white, border: `1px solid ${C.warmEdge}`, borderRadius: 12, padding: 16, marginBottom: 16,
};
export const input: CSSProperties = {
  border: `1px solid ${C.warmEdge}`, borderRadius: 8, padding: "6px 10px",
  background: C.white, color: C.ink, fontSize: 13, width: "100%", boxSizing: "border-box",
};
export const label: CSSProperties = { fontSize: 12, color: C.muted, display: "block", marginBottom: 2 };
export function btn(primary = false, danger = false): CSSProperties {
  return {
    border: `1px solid ${danger ? C.danger : C.warmEdge}`, borderRadius: 8, padding: "6px 12px",
    cursor: "pointer", fontSize: 13,
    background: danger ? C.white : primary ? C.ink : C.white,
    color: danger ? C.danger : primary ? C.white : C.ink,
  };
}
export const chip = (color: string, bg: string): CSSProperties => ({
  background: bg, color, borderRadius: 999, padding: "2px 10px", fontSize: 12, whiteSpace: "nowrap",
});
export const overlay: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex",
  alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
};
export const sectionTitle: CSSProperties = { fontSize: 16, margin: "0 0 10px" };
