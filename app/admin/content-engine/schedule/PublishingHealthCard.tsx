"use client";
// Is the scheduler actually running? Shows the last observed worker tick, the
// database trigger's state, overdue work and pending refreshes. A saved
// schedule never counts as evidence; only a tick that happened does.
import { T } from "@/app/admin/adminTheme";
import type { PublishingHealth } from "@/lib/contentPublishing/types";
import { btn, card, chip } from "../[id]/ui";

interface Props {
  health: PublishingHealth | null;
  error: string | null;
  busy: boolean;
  onRunNow: () => void;
  onRefresh: () => void;
}

function ago(iso: string | null, now: number): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

export function healthVerdict(h: PublishingHealth): { label: string; color: string; detail: string } {
  const now = Date.parse(h.serverNow);
  const lastTick = h.lastRun?.started_at ? now - Date.parse(h.lastRun.started_at) : Infinity;
  if (!h.trigger.installed || !h.trigger.scheduled || h.trigger.active === false) {
    return { label: "Trigger not configured", color: T.red, detail: "The database cron job that ticks the publisher is missing or paused. Nothing publishes automatically until it runs." };
  }
  if (lastTick > 10 * 60_000) {
    return { label: "No recent tick", color: T.red, detail: `The worker last ran ${ago(h.lastRun?.started_at ?? null, now)}. Scheduled posts will wait until it runs again.` };
  }
  if (h.overdue > 0) {
    return { label: "Overdue work", color: T.amber, detail: `${h.overdue} scheduled item(s) are past due and not yet picked up.` };
  }
  return { label: "Running", color: T.green, detail: `Last tick ${ago(h.lastRun?.started_at ?? null, now)}; checks every minute.` };
}

export default function PublishingHealthCard({ health, error, busy, onRunNow, onRefresh }: Props) {
  if (error) return <section style={card}><p role="alert" style={{ color: T.red, margin: 0 }}>{error}</p></section>;
  if (!health) return <section style={card}><p style={{ color: T.inkSoft, margin: 0 }}>Checking the publisher…</p></section>;
  const verdict = healthVerdict(health);
  const now = Date.parse(health.serverNow);
  const trigger = health.trigger;
  return (
    <section style={card} aria-labelledby="pub-health">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 id="pub-health" style={{ fontSize: 16, margin: 0, fontFamily: T.display, fontWeight: 600 }}>
          Publisher <span style={{ ...chip(verdict.color, T.inset), marginLeft: 8 }}>{verdict.label}</span>
        </h2>
        <span style={{ display: "flex", gap: 8 }}>
          <button style={btn(false)} disabled={busy} onClick={onRefresh}>Refresh</button>
          <button style={btn(false)} disabled={busy} onClick={onRunNow} title="Run one tick of the publisher right now">{busy ? "Running…" : "Run a tick now"}</button>
        </span>
      </div>
      <p style={{ color: T.inkSoft, fontSize: 13, margin: "8px 0 10px" }}>{verdict.detail}</p>
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, margin: 0, fontSize: 13 }}>
        <div><dt style={{ color: T.inkFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Last worker tick</dt>
          <dd style={{ margin: 0 }}>{ago(health.lastRun?.started_at ?? null, now)}{health.lastRun ? ` · ${health.lastRun.source}` : ""}{health.lastRun?.error ? ` · error: ${health.lastRun.error}` : ""}</dd></div>
        <div><dt style={{ color: T.inkFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Database trigger</dt>
          <dd style={{ margin: 0 }}>{!trigger.installed ? "pg_cron not installed" : !trigger.scheduled ? "job missing" : `${trigger.active ? "active" : "paused"} · ${trigger.schedule}`}
            {trigger.lastRun ? ` · last fired ${ago(trigger.lastRun.started_at, now)} (${trigger.lastRun.status})` : ""}</dd></div>
        <div><dt style={{ color: T.inkFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Queue</dt>
          <dd style={{ margin: 0 }}>{health.counts.queued} queued · {health.counts.processing} publishing · {health.counts.blocked + health.counts.failed} need attention · {health.overdue} overdue</dd></div>
        <div><dt style={{ color: T.inkFaint, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>Cache refresh</dt>
          <dd style={{ margin: 0 }}>{health.refreshPending === 0 ? "nothing pending" : `${health.refreshPending} published post(s) awaiting refresh`}</dd></div>
      </dl>
    </section>
  );
}
