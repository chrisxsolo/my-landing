"use client";
// "Content Sync Health" — a compact card on the Content Engine dashboard:
// last successful photo sync per kind, failed syncs with Retry, and the
// content gaps that need Chris, each linked to the editor that fixes it.
// A part the server could not read says "unavailable", never 0.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card, sectionTitle } from "@/app/admin/content-engine/[id]/ui";
import { workerLooksIdle, type ContentHealthReport, type SyncFailureDto, type SyncHealthDto } from "@/lib/contentHealth/report";
import type { JobsHealthDto } from "@/lib/contentHealth/jobs";
import {
  healthItems, sessionEditorPath, SYNC_EDITOR_PATHS, SYNC_KIND_LABELS, type HealthItem,
} from "@/lib/contentHealth/issues";
import type { SyncKind } from "@/lib/photoSync/runLog";

const HEALTH_PATH = "/api/admin/content-health";
const PHOTO_SYNC_PATH = "/api/admin/photo-sync";
const SYNC_KINDS = Object.keys(SYNC_KIND_LABELS) as SyncKind[];

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, credentials: "include", headers: { "content-type": "application/json" } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `request failed (${res.status})`);
  return body as T;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const muted = { margin: 0, fontSize: 12, color: T.inkFaint } as const;

function ItemTile({ item }: { item: HealthItem }) {
  const unavailable = item.count === null;
  const tone = unavailable ? T.inkFaint : item.informational ? T.ink : item.count === 0 ? T.green : T.amber;
  return (
    <Link href={item.href} title={item.detail ?? undefined} style={{
      textDecoration: "none", padding: "10px 12px", minHeight: 44, borderRadius: 12, background: T.inset, border: `1px solid ${T.border}`,
    }}>
      <span style={{ display: "block", fontSize: unavailable ? 13 : 22, fontWeight: 700, color: tone, fontFamily: T.mono }}>
        {unavailable ? "unavailable" : item.count}
      </span>
      <span style={{ fontSize: 11, color: T.inkSoft }}>{item.label}</span>
      {item.detail && !unavailable && <span style={{ display: "block", fontSize: 10, color: T.inkFaint }}>{item.detail}</span>}
    </Link>
  );
}

function FailureRow({ failure, busy, onRetry }: { failure: SyncFailureDto; busy: boolean; onRetry: () => void }) {
  const scope = failure.scope ? `session ${failure.scope.slice(0, 8)}` : "full sync";
  // A session-scoped failure is fixed in that session; a full sync in the kind's own editor.
  const href = failure.scope ? sessionEditorPath(failure.scope) : SYNC_EDITOR_PATHS[failure.kind];
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.inkSoft, flexWrap: "wrap" }}>
      <Link href={href} style={{ color: T.red, fontWeight: 700, textDecoration: "none" }}>
        {SYNC_KIND_LABELS[failure.kind]}
      </Link>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={failure.error ?? undefined}>
        {scope} · {when(failure.startedAt)}{failure.error ? ` · ${failure.error}` : ""}
      </span>
      <button type="button" style={{ ...btn(false), marginLeft: "auto", flexShrink: 0, minHeight: 44 }} disabled={busy} onClick={onRetry}>
        {busy ? "Retrying…" : "Retry"}
      </button>
    </li>
  );
}

function SyncSection({ sync, retrying, onRetry }: {
  sync: ContentHealthReport["sync"]; retrying: number | null; onRetry: (runId: number) => void;
}) {
  if (!sync.ok) return <p style={{ ...muted, color: T.red }}>Photo sync status unavailable: {sync.error}</p>;
  const value: SyncHealthDto = sync.value;
  const idle = workerLooksIdle(value.lastWorkerRun);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <p style={{ ...muted, color: idle ? T.amber : T.inkFaint }}
        title="The background worker is scheduled every 5 minutes by GitHub Actions, which often runs it hours late. Admin actions still sync right away.">
        Background worker last ran: {value.lastWorkerRun ? when(value.lastWorkerRun) : "no run recorded yet"}
        {idle && " — quiet for over 6 hours; automatic fills wait for the next run"}
      </p>
      <p style={muted}>
        Last successful sync — {SYNC_KINDS.map((k) => `${SYNC_KIND_LABELS[k]}: ${value.lastOk[k] ? when(value.lastOk[k]) : "never"}`).join(" · ")}
      </p>
      <p style={muted}>
        Last attempt — {SYNC_KINDS.map((k) => `${SYNC_KIND_LABELS[k]}: ${value.lastAttempt[k] ? when(value.lastAttempt[k]) : "never"}`).join(" · ")}
      </p>
      {value.failures.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }}>
          {value.failures.map((f) => (
            <FailureRow key={f.runId} failure={f} busy={retrying === f.runId} onRetry={() => onRetry(f.runId)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function JobFailures({ jobs }: { jobs: ContentHealthReport["jobs"] }) {
  if (!jobs.ok) return <p style={{ ...muted, color: T.red }}>Content run status unavailable: {jobs.error}</p>;
  const value: JobsHealthDto = jobs.value;
  if (!value.recentFailures.length) return null;
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }} aria-label="Failed content runs">
      {value.recentFailures.map((f) => (
        <li key={f.jobId} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.inkSoft, flexWrap: "wrap" }}>
          <span style={{ color: T.red, fontWeight: 700 }}>Run failed</span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
            title={f.error ?? undefined}>
            {when(f.at)} · {f.attempts} attempt{f.attempts === 1 ? "" : "s"}{f.error ? ` · ${f.error}` : ""}
          </span>
          <Link href={sessionEditorPath(f.sessionId)}
            style={{ ...btn(false), textDecoration: "none", minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            Open session to retry
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ContentHealthCard() {
  const [report, setReport] = useState<ContentHealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept apart from the load error: reloading after a retry must not wipe the retry's own failure.
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setReport(await fetchJson<ContentHealthReport>(HEALTH_PATH));
      setError(null);
    } catch (err) {
      console.error("[content-health] card failed to load", err);
      setError(err instanceof Error ? err.message : "could not load");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const retry = useCallback(async (runId: number) => {
    setRetrying(runId);
    setRetryError(null);
    try {
      const res = await fetchJson<{ ok: boolean; runId: number; error?: string }>(PHOTO_SYNC_PATH, {
        method: "POST", body: JSON.stringify({ action: "retry", runId }),
      });
      if (!res.ok) setRetryError(`Retry failed: ${res.error ?? "unknown error"}`);
    } catch (err) {
      console.error(`[content-health] retry of sync run ${runId} failed`, err);
      setRetryError(`Retry failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setRetrying(null);
      await load();
    }
  }, [load]);

  const failures = (report?.sync.ok ? report.sync.value.failures.length : 0)
    + (report?.jobs.ok ? report.jobs.value.recentFailures.length : 0);
  return (
    <section style={{ ...card, display: "grid", gap: 10 }} aria-labelledby="content-health-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 id="content-health-title" style={{ ...sectionTitle, margin: 0 }}>Content Sync Health</h2>
        {failures > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: T.red }}>{failures} failure{failures === 1 ? "" : "s"} to look at</span>}
      </div>
      {error && <p role="alert" style={{ ...muted, color: T.red }}>{report ? error : `Content health unavailable: ${error}`}</p>}
      {retryError && <p role="alert" style={{ ...muted, color: T.red }}>{retryError}</p>}
      {!report && !error && <p style={muted}>Loading…</p>}
      {report && (
        <>
          <SyncSection sync={report.sync} retrying={retrying} onRetry={(id) => void retry(id)} />
          <JobFailures jobs={report.jobs} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {healthItems(report).map((item) => <ItemTile key={item.key} item={item} />)}
          </div>
        </>
      )}
    </section>
  );
}
