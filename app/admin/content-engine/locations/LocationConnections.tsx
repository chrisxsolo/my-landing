"use client";
// Connections: add a session by hand, merge a duplicate location into this
// one, and the live pages this card links to on the public guide.
import Link from "next/link";
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card, sectionTitle } from "@/app/admin/content-engine/[id]/ui";
import type { Detail, Overview } from "./locationLibraryApi";
import { Muted, selectStyle } from "./libraryUi";

export default function LocationConnections({ detail, overview, busy, onAttach, onMerge }: {
  detail: Detail; overview: Overview; busy: boolean;
  onAttach: (sessionId: string) => void; onMerge: (sourceId: number) => void;
}) {
  const [sessionId, setSessionId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const linked = new Set(detail.sessions.filter((s) => !s.excluded).map((s) => s.id));
  const candidates = overview.sessions.filter((s) => !linked.has(s.id));
  const others = overview.locations.filter((l) => l.id !== detail.row.id);

  return (
    <section style={card}>
      <h2 style={sectionTitle}>Connections</h2>
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div>
          <Muted style={{ marginBottom: 6 }}>Add a session that was shot here but wasn&apos;t matched.</Muted>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} style={{ ...selectStyle, flex: 1 }} aria-label="Session to add">
              <option value="">Choose a session…</option>
              {candidates.map((s) => <option key={s.id} value={s.id}>{s.name}{s.location ? ` · ${s.location}` : ""}</option>)}
            </select>
            <button type="button" style={btn()} disabled={busy || !sessionId} onClick={() => { onAttach(sessionId); setSessionId(""); }}>Add</button>
          </div>
        </div>
        <div>
          <Muted style={{ marginBottom: 6 }}>Same physical place listed twice? Merge the other one into this card.</Muted>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} style={{ ...selectStyle, flex: 1 }} aria-label="Location to merge">
              <option value="">Choose a duplicate…</option>
              {others.map((o) => <option key={o.id} value={o.id}>{o.title} · {o.city}</option>)}
            </select>
            <button type="button" style={btn()} disabled={busy || !sourceId} onClick={() => { onMerge(Number(sourceId)); setSourceId(""); }}>Merge</button>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <Muted style={{ marginBottom: 6 }}>Linked from the public card (live pages only):</Muted>
        {detail.related.length === 0
          ? <Muted>None yet — guide pages for this place and journal posts from its sessions appear here automatically.</Muted>
          : (
            <ul style={{ margin: 0, paddingLeft: 18, color: T.inkSoft, fontSize: 13, lineHeight: 1.7 }}>
              {detail.related.map((r) => (
                <li key={r.href}><Link href={r.href} target="_blank" style={{ color: T.action }}>{r.label}</Link> <span style={{ color: T.inkFaint }}>{r.href}</span></li>
              ))}
            </ul>
          )}
      </div>
    </section>
  );
}
