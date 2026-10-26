"use client";
// Featured session/photo choice plus every associated session with its
// photos. Photos come straight from the Content Engine (no re-upload): pick
// any of them as the card's hero, hide one from this place, or assign one
// from a multi-location session. Sessions can be removed, restored or moved.
import Link from "next/link";
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card, chip, sectionTitle } from "@/app/admin/content-engine/[id]/ui";
import type { DetailPhotoDto, DetailSessionDto, LocationSummaryDto } from "./locationLibraryApi";
import { Muted, selectStyle } from "./libraryUi";

export type SessionOp =
  | { action: "photo"; photoId: string; mode: "include" | "hide" | null }
  | { action: "exclude_session" | "attach_session"; sessionId: string }
  | { action: "move_session"; sessionId: string; targetId: number };

const STATE_BADGE: Record<DetailPhotoDto["state"], { text: string; color: string; bg: string } | null> = {
  public: null,
  not_public: { text: "Not public yet", color: T.blue, bg: T.blueBg },
  hidden: { text: "Hidden here", color: T.red, bg: T.redBg },
  unassigned: { text: "Other place?", color: T.amber, bg: T.amberBg },
  excluded: { text: "Excluded in engine", color: T.inkFaint, bg: T.neutralBg },
};

function PhotoTile({ p, isHero, busy, onHero, onOp }: {
  p: DetailPhotoDto; isHero: boolean; busy: boolean;
  onHero: (p: DetailPhotoDto) => void; onOp: (op: SessionOp) => void;
}) {
  const badge = STATE_BADGE[p.state];
  const canHero = p.state === "public" || p.state === "not_public";
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", background: T.inset, border: `2px solid ${isHero ? T.action : "transparent"}` }}>
      <div style={{ position: "relative", aspectRatio: "4 / 3", opacity: p.state === "public" || p.state === "not_public" ? 1 : 0.45 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnails are already resized render/signed URLs */}
        {p.thumbUrl ? <img src={p.thumbUrl} alt={p.alt ?? ""} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
        {isHero ? <span style={{ ...chip(T.actionText, T.action), position: "absolute", top: 6, left: 6, fontSize: 10 }}>Hero</span> : null}
        {badge ? <span style={{ ...chip(badge.color, badge.bg), position: "absolute", bottom: 6, left: 6, fontSize: 10, backdropFilter: "blur(6px)" }}>{badge.text}</span> : null}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 6 }}>
        {canHero && !isHero ? <button type="button" style={{ ...btn(), fontSize: 11, padding: "3px 8px" }} disabled={busy} onClick={() => onHero(p)}>Set as hero</button> : null}
        {p.state === "hidden" || p.state === "unassigned"
          ? <button type="button" style={{ ...btn(), fontSize: 11, padding: "3px 8px" }} disabled={busy}
              onClick={() => onOp({ action: "photo", photoId: p.id, mode: p.state === "hidden" ? null : "include" })}>
              {p.state === "hidden" ? "Unhide" : "Assign here"}
            </button>
          : null}
        {canHero ? <button type="button" style={{ ...btn(false, true), fontSize: 11, padding: "3px 8px" }} disabled={busy}
          onClick={() => onOp({ action: "photo", photoId: p.id, mode: "hide" })}>Hide</button> : null}
      </div>
    </div>
  );
}

function SessionCard({ s, heroId, busy, others, onHero, onOp }: {
  s: DetailSessionDto; heroId: string | null; busy: boolean; others: LocationSummaryDto[];
  onHero: (p: DetailPhotoDto) => void; onOp: (op: SessionOp) => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const publicCount = s.photos.filter((p) => p.state === "public").length;
  const shown = open ? s.photos : s.photos.slice(0, 8);
  return (
    <div style={{ borderTop: `1px solid ${T.rowBorder}`, padding: "12px 0", opacity: s.excluded ? 0.6 : 1 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <span style={{ flex: "1 1 220px", minWidth: 0 }}>
          <Link href={`/admin/content-engine/${s.id}`} style={{ color: T.ink, fontWeight: 700, fontSize: 14 }}>{s.name}</Link>
          <Muted>{[s.kinds.join(" + ") || s.serviceType, s.date, s.location].filter(Boolean).join(" · ")} · {publicCount} public photo{publicCount === 1 ? "" : "s"}</Muted>
          {s.multiLocation ? <Muted>Shot at several places — only photos with matching GPS (or assigned by you) count here.</Muted> : null}
          {!s.permissionOk ? <Muted style={{ color: T.red }}>No marketing permission — none of its photos are shown publicly.</Muted> : null}
        </span>
        <span style={chip(s.source === "manual" ? T.violet : T.inkSoft, s.source === "manual" ? T.violetBg : T.neutralBg)}>
          {s.excluded ? "Removed" : s.source === "manual" ? "Added by you" : "Matched automatically"}
        </span>
        {s.excluded
          ? <button type="button" style={btn()} disabled={busy} onClick={() => onOp({ action: "attach_session", sessionId: s.id })}>Restore</button>
          : <button type="button" style={btn(false, true)} disabled={busy} onClick={() => onOp({ action: "exclude_session", sessionId: s.id })}>Remove</button>}
        <select value={target} onChange={(e) => setTarget(e.target.value)} style={selectStyle} aria-label="Move session to">
          <option value="">Move to…</option>
          {others.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
        </select>
        {target ? <button type="button" style={btn()} disabled={busy}
          onClick={() => onOp({ action: "move_session", sessionId: s.id, targetId: Number(target) })}>Move</button> : null}
      </div>
      {!s.excluded && s.photos.length > 0 ? (
        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", marginTop: 10 }}>
          {shown.map((p) => <PhotoTile key={p.id} p={p} isHero={p.id === heroId} busy={busy} onHero={onHero} onOp={onOp} />)}
        </div>
      ) : null}
      {!s.excluded && s.photos.length > shown.length ? (
        <button type="button" style={{ ...btn(), marginTop: 8 }} onClick={() => setOpen(true)}>Show all {s.photos.length} photos</button>
      ) : null}
    </div>
  );
}

export default function LocationSessionsPanel({
  sessions, heroId, featuredSessionId, busy, others, onFeaturedSession, onHero, onOp,
}: {
  sessions: DetailSessionDto[];
  heroId: string | null;
  featuredSessionId: string | null;
  busy: boolean;
  others: LocationSummaryDto[];
  onFeaturedSession: (sessionId: string | null) => void;
  onHero: (p: DetailPhotoDto) => void;
  onOp: (op: SessionOp) => void;
}) {
  const live = sessions.filter((s) => !s.excluded);
  return (
    <section style={card}>
      <h2 style={sectionTitle}>Sessions &amp; photos</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
        <label style={{ fontSize: 13, color: T.inkSoft }} htmlFor="featured-session">Featured session</label>
        <select id="featured-session" value={featuredSessionId ?? ""} disabled={busy} style={selectStyle}
          onChange={(e) => onFeaturedSession(e.target.value || null)}>
          <option value="">Automatic (best photo overall)</option>
          {live.map((s) => <option key={s.id} value={s.id}>{s.name}{s.date ? ` · ${s.date}` : ""}</option>)}
        </select>
      </div>
      <Muted>Pick a hero from any session below. New sessions never replace a hero you chose.</Muted>
      {sessions.length === 0
        ? <Muted style={{ marginTop: 10 }}>No sessions yet. Sessions join automatically once they are published with this location.</Muted>
        : sessions.map((s) => (
          <SessionCard key={s.id} s={s} heroId={heroId} busy={busy} others={others} onHero={onHero} onOp={onOp} />
        ))}
    </section>
  );
}
