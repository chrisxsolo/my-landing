"use client";
// One place a photo appears: what and where, whether it is live, whether a
// person or a sync put it there, whether it is still valid, and the edits
// the inspector offers for it (remove here / replace here). Presentational.
import Link from "next/link";
import { T } from "@/app/admin/adminTheme";
import { btn } from "@/app/admin/content-engine/[id]/ui";
import { PLACEMENT_TYPE_LABELS, type Placement } from "@/lib/photoSync/placements";

const pill = (color: string, bg: string): React.CSSProperties =>
  ({ padding: "1px 8px", borderRadius: 999, background: bg, color, fontWeight: 700, flexShrink: 0, fontSize: 11 });

interface Props {
  placement: Placement;
  busy: boolean;
  onRemove: () => void;
  onReplace: () => void;
}

export default function PlacementRow({ placement: p, busy, onRemove, onReplace }: Props) {
  const outdated = p.state === "outdated";
  return (
    <li style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", fontSize: 12, padding: "6px 0", borderTop: `1px solid ${T.border}` }}>
      <span style={pill(T.inkSoft, T.neutralBg)}>{PLACEMENT_TYPE_LABELS[p.type]}</span>
      <span style={{ color: T.ink, fontWeight: 700 }}>
        {p.publicPath ? <a href={p.publicPath} target="_blank" rel="noreferrer" style={{ color: T.ink }}>{p.name}</a> : p.name}
      </span>
      {p.detail && <span style={{ color: T.inkFaint }}>{p.detail}</span>}
      <span style={pill(p.published ? T.green : T.inkFaint, p.published ? T.greenBg : T.neutralBg)}>{p.published ? "published" : "unpublished"}</span>
      <span style={pill(T.inkSoft, T.neutralBg)}>{p.origin}</span>
      {outdated && <span style={pill(T.amber, T.amberBg)} title={p.stateReason ?? undefined}>outdated</span>}
      {outdated && p.stateReason && <span style={{ color: T.amber, flex: "1 1 160px" }}>{p.stateReason}</span>}
      <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
        {p.canReplace && (
          <button type="button" style={{ ...btn(false), padding: "2px 8px", fontSize: 11 }} disabled={busy} onClick={onReplace}>Replace here</button>
        )}
        {p.canRemove && (
          <button type="button" style={{ ...btn(false), padding: "2px 8px", fontSize: 11, color: T.red }} disabled={busy} onClick={onRemove}>Remove here</button>
        )}
        <Link href={p.editorHref} style={{ color: T.blue, fontWeight: 700, textDecoration: "none" }}>Edit →</Link>
      </span>
    </li>
  );
}
