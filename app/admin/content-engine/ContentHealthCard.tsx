"use client";
// "Content Sync Health" — a compact card on the Content Engine dashboard:
// last successful photo sync per kind, failed syncs with Retry, and the
// content gaps that need Chris, each linked to the editor that fixes it.
// A part the server could not read says "unavailable", never 0.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card, sectionTitle } from "@/app/admin/content-engine/[id]/ui";
import type { ContentHealthReport, SyncFailureDto, SyncHealthDto } from "@/lib/contentHealth/report";
import { healthItems, SYNC_EDITOR_PATHS, SYNC_KIND_LABELS, type HealthItem } from "@/lib/contentHealth/issues";
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
  const tone = unavailable ? T.inkFaint : item.count === 0 ? T.green : T.amber;
  return (
    <Link href={item.href} title={item.detail ?? undefined} style={{
      textDecoration: "none", padding: "8px 10px", borderRadius: 12, background: T.inset, border: `1px solid ${T.border}`,
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
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.inkSoft }}>
      <Link href={SYNC_EDITOR_PATHS[failure.kind]} style={{ color: T.red, fontWeight: 700, textDecoration: "none" }}>
        {SYNC_KIND_LABELS[failure.kind]}
      </Link>
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={failure.error ?? undefined}>
        {scope} · {when(failure.startedAt)}{failure.error ? ` · ${failure.error}` : ""}
      </span>
      <button type="button" style={{ ...btn(false), marginLeft: "auto", flexShrink: 0 }} disabled={busy} onClick={onRetry}>
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
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <p style={muted}>
        Last successful sync — {SYNC_KINDS.map((k) => `${SYNC_KIND_LABELS[k]}: ${value.lastOk[k] ? when(value.lastOk[k]) : "never"}`).join(" · ")}
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

export default function ContentHealthCard() {
  const [report, setReport] = useState<ContentHealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    try {
      const res = await fetchJson<{ ok: boolean; runId: number; error?: string }>(PHOTO_SYNC_PATH, {
        method: "POST", body: JSON.stringify({ action: "retry", runId }),
      });
      if (!res.ok) setError(`Retry failed: ${res.error ?? "unknown error"}`);
    } catch (err) {
      console.error(`[content-health] retry of sync run ${runId} failed`, err);
      setError(`Retry failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setRetrying(null);
      await load();
    }
  }, [load]);

  const failures = report?.sync.ok ? report.sync.value.failures.length : 0;
  return (
    <section style={{ ...card, display: "grid", gap: 10 }} aria-labelledby="content-health-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <h2 id="content-health-title" style={{ ...sectionTitle, margin: 0 }}>Content Sync Health</h2>
        {failures > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: T.red }}>{failures} failed sync{failures === 1 ? "" : "s"}</span>}
      </div>
      {error && <p role="alert" style={{ ...muted, color: T.red }}>{report ? error : `Content health unavailable: ${error}`}</p>}
      {!report && !error && <p style={muted}>Loading…</p>}
      {report && (
        <>
          <SyncSection sync={report.sync} retrying={retrying} onRetry={(id) => void retry(id)} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {healthItems(report).map((item) => <ItemTile key={item.key} item={item} />)}
          </div>
        </>
      )}
    </section>
  );
}
