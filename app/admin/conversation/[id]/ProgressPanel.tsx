"use client";
// Manual progress controls for the conversation workspace — the same portal
// status strip + milestone timeline as the admin Clients tab, scoped to this
// conversation's client. Owns its own portal-session fetch/save state.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AdminSessionStatusStrip from "@/app/components/admin-session-status-strip";
import ClientTimeline from "@/app/admin/ClientTimeline";
import type { AdminInquiry } from "@/lib/adminInquiries";
import {
  findMatchingClientSession,
  getClientSessionEmailMatches,
  inquiryCountsAsPaid,
  resolveEffectiveSessionStatus,
  CLIENT_SESSION_STATUS_LABELS,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import { T, Panel, PanelHead, MonoLabel, Spinner } from "../ui";

type SessionsResponse = {
  sessions?: AdminClientSessionDTO[];
  session?: AdminClientSessionDTO;
  error?: string;
};

async function sessionsHeaders(includeJson = false) {
  const headers: Record<string, string> = {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (includeJson) headers["Content-Type"] = "application/json";
  return Object.keys(headers).length ? { headers } : undefined;
}

type Props = {
  inquiry: AdminInquiry;
  onInquiryUpdate: (patch: Partial<AdminInquiry>) => void;
  showToast: (msg: string, ok?: boolean) => void;
};

export default function ProgressPanel({ inquiry, onInquiryUpdate, showToast }: Props) {
  const [sessions, setSessions] = useState<AdminClientSessionDTO[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<ClientSessionStatus | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/sessions", await sessionsHeaders());
        const json = await res.json() as SessionsResponse;
        if (!res.ok) throw new Error(json.error ?? "Failed to load portal sessions");
        if (!cancelled) setSessions(json.sessions ?? []);
      } catch (error) {
        console.error("[ProgressPanel] portal sessions load failed:", error);
      } finally {
        if (!cancelled) setSessionsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [inquiry.email]);

  const portalSession = findMatchingClientSession(sessions, {
    clientEmail: inquiry.email,
    sessionType: inquiry.session_type,
    sessionDate: inquiry.session_date ?? inquiry.date_in_mind,
  }) as AdminClientSessionDTO | null;
  const ambiguous =
    getClientSessionEmailMatches(sessions, inquiry.email).length > 1 && !portalSession;
  const effectiveStatus = resolveEffectiveSessionStatus(
    portalSession?.currentStatus ?? "inquiry_received",
    inquiryCountsAsPaid(inquiry),
  );

  async function selectStatus(status: ClientSessionStatus) {
    setSavingStatus(status);
    try {
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        ...(await sessionsHeaders(true)),
        body: JSON.stringify({
          quickStatusUpdate: true,
          id: portalSession?.id,
          clientEmail: inquiry.email,
          clientName: inquiry.name,
          sessionType: inquiry.session_type,
          sessionDate: inquiry.session_date ?? inquiry.date_in_mind,
          location: inquiry.location,
          invoiceStatus: inquiry.invoice_sent_at ? "sent" : null,
          contractStatus: inquiry.contract_sent_at ? "sent" : null,
          currentStatus: status,
        }),
      });
      const json = await res.json() as SessionsResponse;
      if (!res.ok || !json.session) {
        showToast(json.error ?? "Portal update failed", false);
        return;
      }
      const updated = json.session;
      setSessions(prev => {
        const index = prev.findIndex(s => s.id === updated.id);
        if (index === -1) return [updated, ...prev];
        return prev.map(s => (s.id === updated.id ? updated : s));
      });
      showToast(`Portal updated to ${CLIENT_SESSION_STATUS_LABELS[status]} ✓`);
    } catch (error) {
      console.error("[ProgressPanel] portal status update failed:", error);
      showToast("Portal update failed", false);
    } finally {
      setSavingStatus(null);
    }
  }

  return (
    <Panel>
      <div className="p-5">
        <PanelHead icon="film" tint={T.violet} bg={T.violetBg} title="Progress"
          right={sessionsLoading ? <Spinner size={13} /> : (
            <MonoLabel>{CLIENT_SESSION_STATUS_LABELS[effectiveStatus]}</MonoLabel>
          )} />

        <div className="mt-3">
          {ambiguous ? (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: T.amberBg, color: T.action, border: `1px solid ${T.amberBorder}` }}>
              <span>Multiple portal sessions match this client.</span>
              <a href="/admin/sessions" className="font-black flex-shrink-0 hover:opacity-80">
                Open Client Sessions →
              </a>
            </div>
          ) : (
            <AdminSessionStatusStrip
              compact
              appearance="dark"
              currentStatus={effectiveStatus}
              savingStatus={savingStatus}
              disabled={sessionsLoading}
              onSelect={selectStatus}
            />
          )}
        </div>

        <ClientTimeline inq={inquiry} onUpdate={onInquiryUpdate} />
      </div>
    </Panel>
  );
}
