"use client";
// The upcoming queue (/admin/content-engine/schedule): every scheduled
// publication — engine items and blog drafts alike — sorted by due time with
// state filters, the health card, and per-row Reschedule / Publish now /
// Retry / Cancel. Overdue and failed rows are called out in words, not only
// colour. Reached from the engine workspace and from the Blog tab.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { checkAuth } from "@/lib/adminAuth";
import type { PublishingHealth, ScheduleQueueEntry } from "@/lib/contentPublishing/types";
import { describeScheduledInstant } from "@/lib/contentPublishing/localTime";
import EngineShell from "@/app/admin/content-engine/EngineShell";
import { publishingApi, PublishingApiError } from "@/app/admin/publishing/publishingApi";
import ScheduleControl, { describeScheduleDraft, toScheduleWhen, type ScheduleDraft } from "@/app/admin/publishing/ScheduleControl";
import { SCHEDULE_STATE_LABEL } from "../[id]/ItemScheduleControls";
import PublishingHealthCard from "./PublishingHealthCard";
import { btn, card, chip, sectionTitle } from "../[id]/ui";

type Filter = "upcoming" | "attention" | "published" | "cancelled" | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "upcoming", label: "Upcoming" }, { key: "attention", label: "Needs attention" },
  { key: "published", label: "Published" }, { key: "cancelled", label: "Cancelled" }, { key: "all", label: "All" },
];

export function matchesFilter(e: ScheduleQueueEntry, f: Filter): boolean {
  const s = e.schedule.state;
  switch (f) {
    case "upcoming": return s === "queued" || s === "processing";
    case "attention": return s === "blocked" || s === "failed" || e.overdue;
    case "published": return s === "published";
    case "cancelled": return s === "cancelled";
    case "all": return true;
  }
}

function editHref(e: ScheduleQueueEntry): string {
  return e.source.kind === "blog_draft" ? `/admin?tab=blog&draft=${e.schedule.blog_draft_id}`
    : e.source.sessionId ? `/admin/content-engine/${e.source.sessionId}` : "/admin/content-engine";
}

function Row({ entry, onChanged }: { entry: ScheduleQueueEntry; onChanged: () => void }) {
  const s = entry.schedule;
  const [open, setOpen] = useState(false);
  const fromSchedule = (): ScheduleDraft => {
    const [date, time] = s.local_wall_time.split("T");
    return { date, time, timeZone: s.time_zone };
  };
  const [draft, setDraft] = useState<ScheduleDraft>(fromSchedule);
  const toggle = () => { if (!open) setDraft(fromSchedule()); setOpen((o) => !o); };
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const meta = SCHEDULE_STATE_LABEL[s.state];
  const actionable = s.state === "queued" || s.state === "blocked" || s.state === "failed";
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setNotice(null);
    try { await fn(); setOpen(false); }
    catch (err) { setNotice(err instanceof PublishingApiError && err.body.code === "already_published" ? "Already published." : err instanceof Error ? err.message : "action failed"); }
    finally { setBusy(false); onChanged(); }
  };
  const summary = describeScheduleDraft(draft);
  return (
    <li style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, listStyle: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong style={{ fontSize: 14 }}>{entry.title}</strong>
            <span style={chip(meta.color, T.inset)}>{meta.label}</span>
            {entry.overdue && <span style={chip(T.amber, T.amberBg)}>Overdue</span>}
            {s.refresh_pending && <span style={chip(T.inkSoft, T.inset)}>Refresh pending</span>}
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: T.inkSoft }}>
            {entry.typeLabel}
            {entry.source.kind === "content_item" ? ` · ${entry.source.sessionName ?? "Content Engine session"}` : " · Blog tab"}
            {" · "}{describeScheduledInstant(new Date(s.due_at), s.time_zone)}
            {s.state === "published" && s.published_at ? ` · went live ${new Date(s.published_at).toLocaleString()}` : ""}
            {s.attempts > 1 ? ` · attempt ${s.attempts}` : ""}
          </p>
          {s.last_error && s.state !== "published" && (
            <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: s.state === "cancelled" ? T.inkFaint : T.amber, whiteSpace: "pre-line" }}>{s.last_error}</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {entry.liveUrl && <a href={entry.liveUrl} target="_blank" rel="noreferrer" style={{ ...btn(false), textDecoration: "none" }}>View live ↗</a>}
          <Link href={editHref(entry)} style={{ ...btn(false), textDecoration: "none" }}>Edit</Link>
          {actionable && (
            <>
              <button style={btn(false)} disabled={busy} aria-expanded={open} onClick={toggle}>Reschedule</button>
              <button style={btn(true)} disabled={busy} onClick={() => { if (confirm(`Publish "${entry.title}" now?`)) void run(() => publishingApi.publishNow(s.id, s.schedule_version)); }}>Publish now</button>
              {(s.state === "blocked" || s.state === "failed") && (
                <button style={btn(false)} disabled={busy} onClick={() => void run(() => publishingApi.retry(s.id, s.schedule_version))}>Retry</button>
              )}
              <button style={btn(false, true)} disabled={busy} onClick={() => { if (confirm(`Cancel the schedule for "${entry.title}"? It returns to a draft you can reschedule.`)) void run(() => publishingApi.cancel(s.id, s.schedule_version)); }}>Cancel</button>
            </>
          )}
        </div>
      </div>
      {open && (
        <div style={{ marginTop: 10, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
          <ScheduleControl value={draft} onChange={setDraft} theme="dark" />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button style={btn(true)} disabled={busy || !summary.ok} onClick={() => void run(() => publishingApi.reschedule(s.id, s.schedule_version, toScheduleWhen(draft)))}>Confirm new time</button>
            <button style={btn(false)} disabled={busy} onClick={() => setOpen(false)}>Back</button>
          </div>
        </div>
      )}
      {notice && <p role="alert" style={{ color: T.red, fontSize: 12, margin: "6px 0 0" }}>{notice}</p>}
    </li>
  );
}

export default function ScheduleQueue() {
  const router = useRouter();
  const [entries, setEntries] = useState<ScheduleQueueEntry[]>([]);
  const [health, setHealth] = useState<PublishingHealth | null>(null);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [queue, h] = await Promise.all([publishingApi.listQueue(), publishingApi.health()]);
      setEntries(queue.entries);
      setHealth(h);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not load the queue");
    }
  }, []);

  useEffect(() => {
    if (!checkAuth()) { router.replace("/admin"); return; }
    void load();
    const timer = setInterval(() => { void load(); }, 30_000);
    return () => clearInterval(timer);
  }, [router, load]);

  const runNow = async () => {
    setBusy(true); setStatus(null);
    try {
      const r = await publishingApi.runWorkerNow();
      setStatus(`Tick done: ${r.claimed} claimed, ${r.published} published, ${r.blocked} blocked, ${r.retried} retrying, ${r.refreshed} refreshed.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "tick failed");
    } finally { setBusy(false); void load(); }
  };

  const visible = entries.filter((e) => matchesFilter(e, filter));
  return (
    <EngineShell>
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "16px 24px 64px", color: T.ink }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, margin: 0, fontFamily: T.display, fontWeight: 600 }}>Publishing queue</h1>
          <span style={{ display: "flex", gap: 10, fontSize: 13 }}>
            <Link href="/admin/content-engine" style={{ color: T.inkSoft }}>Content Engine</Link>
            <Link href="/admin?tab=blog" style={{ color: T.inkSoft }}>Blog tab</Link>
          </span>
        </header>
        <PublishingHealthCard health={health} error={error} busy={busy} onRunNow={() => void runNow()} onRefresh={() => void load()} />
        {status && <p role="status" style={{ color: T.inkSoft, fontSize: 13 }}>{status}</p>}
        <section style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={sectionTitle}>Schedules ({visible.length})</h2>
            <div role="group" aria-label="Filter schedules" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FILTERS.map((f) => (
                <button key={f.key} aria-pressed={filter === f.key}
                  style={{ ...btn(filter === f.key), padding: "4px 12px" }} onClick={() => setFilter(f.key)}>
                  {f.label} ({entries.filter((e) => matchesFilter(e, f.key)).length})
                </button>
              ))}
            </div>
          </div>
          {visible.length === 0 ? (
            <p style={{ color: T.inkSoft, textAlign: "center", padding: 16 }}>Nothing here. Schedule an approved item from a session, or a draft from the Blog tab.</p>
          ) : (
            <ul style={{ display: "grid", gap: 10, padding: 0, margin: 0 }}>
              {visible.map((e) => <Row key={e.schedule.id} entry={e} onChanged={() => void load()} />)}
            </ul>
          )}
        </section>
      </main>
    </EngineShell>
  );
}
