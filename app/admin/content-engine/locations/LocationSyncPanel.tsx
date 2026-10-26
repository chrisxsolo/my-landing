"use client";
// Synchronization controls: last run, Resync all (with a dry-run preview),
// and every session's sync state — the "Needs a location" rows link straight
// to the session's Location panel, where the place is confirmed.
import Link from "next/link";
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card, chip, sectionTitle } from "@/app/admin/content-engine/[id]/ui";
import { libraryApi, type SyncReport, type SyncSessionDto } from "./locationLibraryApi";
import { Muted, SYNC_CHIP, formatWhen } from "./libraryUi";

function SessionLine({ s, busy, onResync }: { s: SyncSessionDto; busy: boolean; onResync: () => void }) {
  const status = s.status ? SYNC_CHIP[s.status] : { label: "Not synced", style: chip(T.inkFaint, T.neutralBg) };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "8px 0", borderTop: `1px solid ${T.rowBorder}` }}>
      <span style={{ flex: "1 1 220px", minWidth: 0 }}>
        <Link href={`/admin/content-engine/${s.id}`} style={{ color: T.ink, fontWeight: 700, fontSize: 13 }}>{s.name}</Link>
        <span style={{ color: T.inkFaint, fontSize: 12 }}> · {s.serviceType}{s.location ? ` · ${s.location}` : " · no location"}</span>
        {s.message && s.status !== "synced" ? <Muted style={{ marginTop: 2 }}>{s.message}</Muted> : null}
        {s.locations.length ? <Muted style={{ marginTop: 2 }}>→ {s.locations.map((l) => l.title).join(", ")}</Muted> : null}
      </span>
      <span style={status.style}>{status.label}</span>
      <span style={{ fontSize: 11, color: T.inkFaint, fontFamily: T.mono }}>{formatWhen(s.syncedAt)}</span>
      <button type="button" style={btn()} disabled={busy} onClick={onResync}>Resync</button>
    </div>
  );
}

function PreviewReport({ report }: { report: SyncReport }) {
  const creates = [...new Set(report.sessions.flatMap((s) => s.createdKeys))];
  const review = report.sessions.filter((s) => s.status === "needs_review").length;
  const removed = report.sessions.reduce((n, s) => n + s.removedLinks, 0);
  return (
    <div style={{ background: T.inset, borderRadius: 12, padding: 12, marginBottom: 10, fontSize: 13, color: T.inkSoft }}>
      <strong style={{ color: T.ink }}>{report.dryRun ? "Preview — nothing was written." : "Resync finished."}</strong>
      <div>New draft locations: {creates.length ? creates.join(", ") : "none"}</div>
      {report.claims?.length ? <div>Existing cards matched to places: {report.claims.map((c) => `${c.title} → ${c.key}`).join(", ")}</div> : null}
      <div>Sessions needing a location: {review} · stale links {report.dryRun ? "to remove" : "removed"}: {removed}</div>
    </div>
  );
}

export default function LocationSyncPanel({
  sessions, lastSyncedAt, onChanged, onNotice,
}: {
  sessions: SyncSessionDto[];
  lastSyncedAt: string | null;
  onChanged: () => void;
  onNotice: (msg: string, ok?: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [showAll, setShowAll] = useState(false);
  const attention = sessions.filter((s) => s.status === "needs_review" || s.status === "error");
  const listed = showAll ? sessions : attention;

  async function run(body: { sessionId?: string; dryRun?: boolean }) {
    setBusy(true);
    try {
      const result = await libraryApi.sync(body);
      if (!body.sessionId) setReport(result);
      onNotice(body.dryRun ? "Preview ready" : "Synchronized");
      if (!body.dryRun) onChanged();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "sync failed", false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={card}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={sectionTitle}>Synchronization</h2>
          <Muted>
            Runs automatically when a session is published, its location changes, or the location is confirmed — plus a
            periodic sweep. Last sync: {formatWhen(lastSyncedAt)}. {attention.length} session{attention.length === 1 ? "" : "s"} need attention.
          </Muted>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={btn()} disabled={busy} onClick={() => run({ dryRun: true })}>Preview</button>
          <button type="button" style={btn(true)} disabled={busy} onClick={() => run({})}>{busy ? "Syncing…" : "Resync all"}</button>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        {report ? <PreviewReport report={report} /> : null}
        {listed.map((s) => <SessionLine key={s.id} s={s} busy={busy} onResync={() => run({ sessionId: s.id })} />)}
        {!showAll && attention.length === 0 ? <Muted>Every session is synced.</Muted> : null}
        <button type="button" onClick={() => setShowAll((v) => !v)}
          style={{ ...btn(), marginTop: 8, background: "transparent", border: "none", color: T.action, padding: 0 }}>
          {showAll ? "Show only sessions needing attention" : `Show all ${sessions.length} sessions`}
        </button>
      </div>
    </section>
  );
}
