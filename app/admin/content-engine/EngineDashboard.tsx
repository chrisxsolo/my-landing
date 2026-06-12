"use client";
// Session list (spec §7.1): derived-state badges, filters, actionability sort,
// "New from client session" picker (conflict opens the existing workspace) and
// "Blank session" — restyled to the Darkroom theme with pipeline totals up top.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { checkAuth } from "@/lib/adminAuth";
import { engineApi, EngineApiError } from "./engineApi";
import { STATE_BADGES, sortByActionability } from "./stateBadge";
import EngineShell from "./EngineShell";
import { WORKFLOW_STEPS, stepFromState } from "./WorkflowStepper";
import { SERVICE_TYPES } from "@/lib/contentEngine/taxonomy";
import { btn, card, input as inputStyle, overlay as overlayStyle } from "./[id]/ui";
import type { EngineSessionRow, SessionEngineState } from "./engineTypes";

type ClientSessionOption = {
  id: string;
  clientName: string | null;
  sessionType: string | null;
  currentStatus: string;
};

export default function EngineDashboard() {
  const router = useRouter();
  const [rows, setRows] = useState<EngineSessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState<SessionEngineState | "all">("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [showPicker, setShowPicker] = useState(false);
  const [clientSessions, setClientSessions] = useState<ClientSessionOption[]>([]);
  const [blankType, setBlankType] = useState<string>("grads");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { sessions } = await engineApi.listSessions();
      setRows(sessions);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "could not load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!checkAuth()) {
      router.replace("/admin");
      return;
    }
    void load();
  }, [router, load]);

  const openPicker = useCallback(async () => {
    setShowPicker(true);
    try {
      const res = await fetch("/api/admin/sessions");
      const body = (await res.json()) as {
        sessions?: { id: string; clientName: string | null; sessionType: string | null; currentStatus: string }[];
      };
      // session_completed and later are eligible (spec §7.1)
      const DONE = [
        "session_completed", "photos_backed_up", "culling",
        "editing", "final_review", "delivered",
      ];
      setClientSessions(
        (body.sessions ?? [])
          .filter((s) => DONE.includes(s.currentStatus))
          .map((s) => ({
            id: s.id,
            clientName: s.clientName,
            sessionType: s.sessionType,
            currentStatus: s.currentStatus,
          })),
      );
    } catch {
      setNotice("could not load client sessions");
    }
  }, []);

  const createFrom = useCallback(async (clientSessionId?: string) => {
    try {
      const created = clientSessionId
        ? await engineApi.createSession({ clientSessionId })
        : await engineApi.createSession({ serviceType: blankType });
      router.push(`/admin/content-engine/${created.sessionId}`);
    } catch (err) {
      if (
        err instanceof EngineApiError
        && err.status === 409
        && typeof err.body.existingSessionId === "string"
      ) {
        // DB-enforced: open the existing session (spec §7.1)
        router.push(`/admin/content-engine/${err.body.existingSessionId}`);
        return;
      }
      setNotice(err instanceof Error ? err.message : "could not create session");
    }
  }, [router, blankType]);

  const visible = useMemo(() => {
    const filtered = rows.filter(
      (r) =>
        (stateFilter === "all" || r.state === stateFilter)
        && (serviceFilter === "all" || r.service_type === serviceFilter),
    );
    return sortByActionability(filtered);
  }, [rows, stateFilter, serviceFilter]);

  // Pipeline totals across every session's active package items
  const totals = useMemo(() => rows.reduce(
    (acc, r) => ({
      draft: acc.draft + (r.itemCounts.draft ?? 0),
      approved: acc.approved + (r.itemCounts.approved ?? 0),
      published: acc.published + (r.itemCounts.published ?? 0),
      failed: acc.failed + (r.itemCounts.failed ?? 0) + (r.state === "failed" ? 1 : 0),
    }),
    { draft: 0, approved: 0, published: 0, failed: 0 },
  ), [rows]);

  const tiles = [
    { label: "Drafts", sub: "awaiting approval", value: totals.draft, accent: T.amber },
    { label: "Approved", sub: "ready to publish", value: totals.approved, accent: T.violet },
    { label: "Published", sub: "live on the site", value: totals.published, accent: T.green },
    { label: "Attention", sub: "failed items", value: totals.failed, accent: T.red },
  ];

  return (
    <EngineShell>
    <main className="px-4" style={{ maxWidth: 980, margin: "0 auto", padding: 24, color: T.ink }}>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] mb-2" style={{ color: T.action, fontFamily: T.mono }}>
            Session → Marketing Pipeline
          </p>
          <h1 className="text-[28px] font-semibold leading-none m-0" style={{ color: T.ink, fontFamily: T.display }}>
            Content Engine
          </h1>
          <p className="text-[11px] mt-2 font-bold uppercase tracking-[0.14em]" style={{ color: T.inkFaint, fontFamily: T.mono }}>
            {WORKFLOW_STEPS.join(" → ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void openPicker()} style={btn(true)}>
            + New from client session
          </button>
          <select value={blankType} onChange={(e) => setBlankType(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => void createFrom()} style={btn(false)}>Blank session</button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
        {tiles.map((s) => (
          <div key={s.label} className="rounded-2xl p-4"
            style={{ background: T.panel, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] m-0" style={{ color: T.inkSoft, fontFamily: T.mono }}>{s.label}</p>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.accent, boxShadow: `0 0 6px ${s.accent}` }} />
            </div>
            <p className="text-[26px] font-bold leading-none tabular-nums m-0" style={{ color: T.ink, fontFamily: T.mono }}>{s.value}</p>
            <p className="text-[11px] mt-1.5 font-medium m-0" style={{ color: T.inkFaint }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {notice && (
        <p role="alert" className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-[13px] font-semibold"
          style={{ color: T.red, background: T.redBg, border: `1px solid ${T.redBorder}` }}>
          {notice}
          <button onClick={() => setNotice(null)} style={{ ...btn(false), marginLeft: "auto" }}>dismiss</button>
        </p>
      )}

      <div className="flex gap-2 mb-3">
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as SessionEngineState | "all")}
          style={{ ...inputStyle, width: "auto" }}
        >
          <option value="all">All states</option>
          {Object.entries(STATE_BADGES).map(([s, b]) => (
            <option key={s} value={s}>{b.label}</option>
          ))}
        </select>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          style={{ ...inputStyle, width: "auto" }}
        >
          <option value="all">All services</option>
          {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? <p style={{ color: T.inkSoft }}>Loading…</p> : visible.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: T.inkFaint }}>
          No sessions yet — create one from a completed client session.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {visible.map((row) => {
            const badge = STATE_BADGES[row.state];
            const step = stepFromState(row.state);
            return (
              <Link
                key={row.id}
                href={`/admin/content-engine/${row.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div className="transition-all hover:-translate-y-px"
                  style={{ ...card, marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <strong style={{ color: T.ink }}>
                      {row.public_display_name ?? row.internal_client_name ?? "Untitled session"}
                    </strong>
                    <span style={{ color: T.inkFaint, marginLeft: 8, fontSize: 13 }}>
                      {row.service_type}
                      {row.school_slug ? ` · ${row.school_slug}` : ""}
                      {row.session_date ? ` · ${row.session_date}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
                    <span style={{ color: T.inkFaint, fontSize: 11, fontFamily: T.mono }}>
                      {row.photoCount} photos
                      {step < 6 && ` · step ${step + 1}/6 ${WORKFLOW_STEPS[step]}`}
                      {!row.marketing_permission && " · no marketing ✋"}
                      {!row.ai_processing_allowed && " · no AI"}
                    </span>
                    <span style={{
                      background: badge.bg, color: badge.color,
                      borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700,
                    }}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {showPicker && (
        <div style={overlayStyle} onClick={() => setShowPicker(false)}>
          <div
            style={{ ...card, background: T.panelSolid, maxWidth: 520, width: "100%", maxHeight: "70vh", overflowY: "auto", marginBottom: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, fontSize: 16, color: T.ink, fontFamily: T.display }}>Pick a completed client session</h2>
            {clientSessions.length === 0 ? (
              <p style={{ color: T.inkFaint }}>No completed client sessions found.</p>
            ) : (
              clientSessions.map((cs) => (
                <button
                  key={cs.id}
                  onClick={() => void createFrom(cs.id)}
                  style={{ ...btn(false), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}
                >
                  {cs.clientName ?? "Unnamed"} — {cs.sessionType ?? "?"}{" "}
                  <span style={{ color: T.inkFaint }}>({cs.currentStatus})</span>
                </button>
              ))
            )}
            <button onClick={() => setShowPicker(false)} style={btn(false)}>Close</button>
          </div>
        </div>
      )}
    </main>
    </EngineShell>
  );
}
