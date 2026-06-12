"use client";
// Session list (spec §7.1): derived-state badges, filters, actionability sort,
// "New from client session" picker (conflict opens the existing workspace) and
// "Blank session". Mirrors the /admin/sessions dashboard conventions.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { C } from "@/lib/colors";
import { checkAuth } from "@/lib/adminAuth";
import { engineApi, EngineApiError } from "./engineApi";
import { STATE_BADGES, sortByActionability } from "./stateBadge";
import { SERVICE_TYPES } from "@/lib/contentEngine/taxonomy";
import type { EngineSessionRow, SessionEngineState } from "./engineTypes";

type ClientSessionOption = {
  id: string;
  clientName: string | null;
  sessionType: string | null;
  currentStatus: string;
};

const card: React.CSSProperties = {
  background: C.white, border: `1px solid ${C.warmEdge}`, borderRadius: 12, padding: 16,
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

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24, color: C.ink }}>
      <header style={{
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16,
      }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Content Engine</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => void openPicker()} style={btn(true)}>
            New from client session
          </button>
          <select
            value={blankType}
            onChange={(e) => setBlankType(e.target.value)}
            style={inputStyle}
          >
            {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={() => void createFrom()} style={btn(false)}>Blank session</button>
        </div>
      </header>

      {notice && (
        <p role="alert" style={{ color: C.danger, marginBottom: 12 }}>
          {notice}{" "}
          <button onClick={() => setNotice(null)} style={btn(false)}>dismiss</button>
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value as SessionEngineState | "all")}
          style={inputStyle}
        >
          <option value="all">All states</option>
          {Object.entries(STATE_BADGES).map(([s, b]) => (
            <option key={s} value={s}>{b.label}</option>
          ))}
        </select>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          style={inputStyle}
        >
          <option value="all">All services</option>
          {SERVICE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {loading ? <p>Loading…</p> : visible.length === 0 ? (
        <div style={{ ...card, textAlign: "center", color: C.muted }}>
          No sessions yet — create one from a completed client session.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {visible.map((row) => {
            const badge = STATE_BADGES[row.state];
            return (
              <Link
                key={row.id}
                href={`/admin/content-engine/${row.id}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <div style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>
                      {row.public_display_name ?? row.internal_client_name ?? "Untitled session"}
                    </strong>
                    <span style={{ color: C.muted, marginLeft: 8 }}>
                      {row.service_type}
                      {row.school_slug ? ` · ${row.school_slug}` : ""}
                      {row.session_date ? ` · ${row.session_date}` : ""}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: C.muted, fontSize: 12 }}>
                      {row.photoCount} photos
                      {!row.marketing_permission && " · no marketing ✋"}
                      {!row.ai_processing_allowed && " · no AI"}
                    </span>
                    <span style={{
                      background: badge.bg, color: badge.color,
                      borderRadius: 999, padding: "2px 10px", fontSize: 12,
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
            style={{ ...card, maxWidth: 520, width: "100%", maxHeight: "70vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, fontSize: 16 }}>Pick a completed client session</h2>
            {clientSessions.length === 0 ? (
              <p style={{ color: C.muted }}>No completed client sessions found.</p>
            ) : (
              clientSessions.map((cs) => (
                <button
                  key={cs.id}
                  onClick={() => void createFrom(cs.id)}
                  style={{ ...btn(false), display: "block", width: "100%", textAlign: "left", marginBottom: 6 }}
                >
                  {cs.clientName ?? "Unnamed"} — {cs.sessionType ?? "?"}{" "}
                  <span style={{ color: C.muted }}>({cs.currentStatus})</span>
                </button>
              ))
            )}
            <button onClick={() => setShowPicker(false)} style={btn(false)}>Close</button>
          </div>
        </div>
      )}
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  border: `1px solid ${C.warmEdge}`, borderRadius: 8, padding: "6px 10px",
  background: C.white, color: C.ink,
};

const overlayStyle: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex",
  alignItems: "center", justifyContent: "center", padding: 24, zIndex: 50,
};

function btn(primary: boolean): React.CSSProperties {
  return {
    border: `1px solid ${C.warmEdge}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer",
    background: primary ? C.ink : C.white, color: primary ? C.white : C.ink, fontSize: 13,
  };
}
