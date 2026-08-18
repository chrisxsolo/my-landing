"use client";
// Payment & booking panel + the golden-hour sunset card. State and API
// handlers live in the page; only the ephemeral mark-paid form fields are
// local to this file.

import { useState } from "react";
import type { AdminInquiry } from "@/lib/adminInquiries";
import { inquiryCountsAsPaid } from "@/lib/clientSessions";
import { T, Icon, Spinner, Panel, PanelHead, MonoLabel } from "../ui";
import { countdownLabel } from "./helpers";

const PAYMENT_METHODS = ["Venmo", "Zelle", "PayPal", "Cash App", "Square", "Cash", "Other"];

function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type ManualPaymentForm = { method: string; amount: string; paid_at: string; note: string };

// ── Manual payment override form ─────────────────────────────────────────────
function MarkPaidForm({ loading, onSubmit, onCancel }: {
  loading: boolean;
  onSubmit: (form: ManualPaymentForm) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(localToday());
  const [note,   setNote]   = useState("");

  async function submit() {
    const ok = await onSubmit({ method, amount: amount.trim(), paid_at: paidAt, note: note.trim() });
    if (ok) onCancel();
  }

  const inputStyle = { border: `1px solid ${T.greenBorder}`, background: T.inset, color: T.ink, fontFamily: "inherit" };

  return (
    <div className="space-y-2 px-3 py-2.5 rounded-lg" style={{ background: T.inset, border: `1px solid ${T.greenBorder}` }}>
      <MonoLabel>Mark paid manually</MonoLabel>
      <div className="grid grid-cols-2 gap-1.5">
        <select value={method} onChange={e => setMethod(e.target.value)}
          className="conv-input text-xs rounded-lg px-2 py-1.5" style={inputStyle}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="$ amount (optional)"
          className="conv-input text-xs rounded-lg px-2 py-1.5" style={inputStyle} />
        <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)}
          className="conv-input text-xs rounded-lg px-2 py-1.5" style={inputStyle} />
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
          className="conv-input text-xs rounded-lg px-2 py-1.5" style={inputStyle} />
      </div>
      <div className="flex gap-1.5">
        <button onClick={submit} disabled={loading || !paidAt}
          className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-lg text-xs font-bold disabled:opacity-40 transition-all hover:opacity-90"
          style={{ background: T.green, color: "#10231a" }}>
          {loading ? <Spinner size={12} /> : <Icon name="check" size={12} />}
          {loading ? "Saving…" : "Confirm Paid"}
        </button>
        <button onClick={onCancel} disabled={loading}
          className="py-2 px-3 rounded-lg text-xs font-bold transition-all hover:opacity-70"
          style={{ background: T.neutralBg, color: T.inkFaint }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Sunset / golden hour ─────────────────────────────────────────────────────
export function SunsetCard({ sunsetLoading, sunsetInfo, sunsetDate, dateInMind, onFetchSunset }: {
  sunsetLoading: boolean;
  sunsetInfo: { sunset: string; goldenStart: string } | null;
  sunsetDate: string;
  dateInMind: string | null;
  onFetchSunset: (date: string) => void;
}) {
  return (
    <Panel>
      <div className="px-4 py-3.5 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: T.amberBg, color: T.action }}>
          <Icon name="sun" size={16} />
        </div>
        <div className="flex-1 min-w-0">
          {sunsetLoading ? (
            <div className="flex items-center gap-2 text-xs mb-2" style={{ color: T.action }}>
              <Spinner size={12} /> Fetching sunset…
            </div>
          ) : sunsetInfo ? (
            <div className="mb-2">
              <p className="text-sm font-bold" style={{ color: T.ink }}>
                Sunset {sunsetInfo.sunset}
                {sunsetDate && (
                  <span className="text-xs font-normal ml-2" style={{ color: T.inkFaint, fontFamily: T.mono }}>
                    {new Date(sunsetDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" · "}{countdownLabel(sunsetDate)}
                  </span>
                )}
              </p>
              <p className="text-xs mt-0.5" style={{ color: T.inkSoft }}>
                Start around <span className="font-bold" style={{ color: T.action }}>{sunsetInfo.goldenStart}</span> for golden hour
              </p>
            </div>
          ) : (
            <p className="text-xs font-bold mb-2" style={{ color: T.ink }}>Golden hour lookup</p>
          )}
          <input
            type="date"
            value={sunsetDate}
            onChange={e => { if (e.target.value) onFetchSunset(e.target.value); }}
            className="conv-input w-full text-xs rounded-lg px-2 py-1.5"
            style={{ border: `1px solid ${T.amberBorder}`, background: T.inset, color: T.ink, fontFamily: "inherit" }}
          />
          {dateInMind && !sunsetDate && (
            <p className="text-[10px] mt-1" style={{ color: T.inkFaint }}>Client said: {dateInMind}</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ── Payment & booking ────────────────────────────────────────────────────────
type BookingProps = {
  inquiry: AdminInquiry;
  paymentLoading: boolean;
  markPaidLoading: boolean;
  sessionDateInput: string;
  onSessionDateInput: (v: string) => void;
  detectedDate: { date: string; readable: string; confidence: string } | null;
  onDismissDetected: () => void;
  detectLoading: boolean;
  dateConfirming: boolean;
  remindersLoading: boolean;
  remindersOpen: boolean;
  contractLoading: boolean;
  previewLoading: boolean;
  confirmLoading: boolean;
  onCheckPayment: () => void;
  onMarkPaid: (form: ManualPaymentForm) => Promise<boolean>;
  onDetectDate: () => void;
  onConfirmDate: (date: string) => void;
  onScheduleReminders: () => void;
  onGenerateContract: () => void;
  onPreviewConfirmation: () => void;
  onFetchSunset: (date: string) => void;
};

export default function BookingPanel(p: BookingProps) {
  const { inquiry } = p;
  const paid = inquiryCountsAsPaid(inquiry);
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  return (
    <Panel>
      <div className="p-5 space-y-3">
        <PanelHead icon="card" tint={T.green} bg={T.greenBg} title="Payment & Booking"
          right={paid ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: T.greenBg, color: T.green }}>
              <Icon name="check" size={11} /> Paid
            </span>
          ) : (
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: T.neutralBg, color: T.inkFaint }}>
              Unpaid
            </span>
          )} />

        {/* Payment note */}
        {inquiry.payment_note && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }}>
            <span className="flex-1 truncate">{inquiry.payment_note}</span>
            {inquiry.payment_detected_at && (
              <span className="text-[10px] flex-shrink-0" style={{ opacity: 0.7, fontFamily: T.mono }}>
                {new Date(inquiry.payment_detected_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        )}

        {/* Session date */}
        {inquiry.session_date && !p.sessionDateInput ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}` }}>
            <Icon name="check" size={12} style={{ color: T.green }} />
            <span className="text-xs font-bold flex-1" style={{ color: T.green }}>
              {new Date(inquiry.session_date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              <span className="font-medium ml-1.5" style={{ opacity: 0.8 }}>· {countdownLabel(inquiry.session_date)}</span>
            </span>
            <button onClick={() => p.onSessionDateInput(inquiry.session_date!)}
              className="text-[10px] font-semibold flex-shrink-0 hover:opacity-70"
              style={{ color: T.inkFaint }}>edit</button>
          </div>
        ) : (
          <div className="flex gap-1.5">
            <input type="date" value={p.sessionDateInput}
              onChange={e => { p.onSessionDateInput(e.target.value); if (e.target.value) p.onFetchSunset(e.target.value); }}
              className="conv-input flex-1 px-2.5 py-1.5 rounded-lg text-xs"
              style={{ border: `1px solid ${T.greenBorder}`, background: T.inset, color: T.ink, fontFamily: "inherit" }} />
            {p.sessionDateInput && (
              <button onClick={() => p.onConfirmDate(p.sessionDateInput)} disabled={p.dateConfirming}
                className="text-xs font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 transition-all hover:opacity-90"
                style={{ background: T.green, color: "#10231a" }}>
                {p.dateConfirming ? "…" : "Set"}
              </button>
            )}
          </div>
        )}

        {/* Detected date — confirm strip */}
        {p.detectedDate && !inquiry.session_date && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{ background: T.blueBg, border: `1px solid ${T.blueBorder}` }}>
            <span className="text-xs flex-1 font-medium truncate inline-flex items-center gap-1.5" style={{ color: T.blue }}>
              <Icon name="sparkle" size={11} className="flex-shrink-0" /> {p.detectedDate.readable}
            </span>
            <button onClick={() => p.onConfirmDate(p.detectedDate!.date)} disabled={p.dateConfirming}
              className="text-[11px] font-bold px-2.5 py-1 rounded-md flex-shrink-0 transition-all hover:opacity-90"
              style={{ background: T.green, color: "#10231a" }}>
              {p.dateConfirming ? "…" : "Confirm"}
            </button>
            <button onClick={p.onDismissDetected}
              className="flex-shrink-0 p-1 rounded-md transition-all hover:opacity-70"
              style={{ background: T.neutralBg, color: T.inkFaint }}>
              <Icon name="x" size={11} />
            </button>
          </div>
        )}

        {/* Action grid */}
        <MonoLabel className="block pt-1">Actions</MonoLabel>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={p.onCheckPayment} disabled={p.paymentLoading}
            title="Scan Gmail for Venmo/Zelle/PayPal payment"
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-px disabled:opacity-40"
            style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }}>
            {p.paymentLoading ? <Spinner size={13} /> : <Icon name="card" size={14} />}
            {p.paymentLoading ? "Scanning…" : paid ? "Re-check" : "Check Pay"}
          </button>

          {!inquiry.session_date && (
            <button onClick={p.onDetectDate} disabled={p.detectLoading}
              title="Scan email history to detect the session date"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-px disabled:opacity-40"
              style={{ background: T.blueBg, color: T.blue, border: `1px solid ${T.blueBorder}` }}>
              {p.detectLoading ? <Spinner size={13} /> : <Icon name="calendar" size={14} />}
              {p.detectLoading ? "Scanning…" : "Find Date"}
            </button>
          )}

          <button onClick={p.onScheduleReminders} disabled={p.remindersLoading}
            title="Generate all 5 client touchpoint drafts"
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-px disabled:opacity-40"
            style={p.remindersOpen
              ? { background: T.action, color: T.actionText, border: `1px solid ${T.action}` }
              : { background: T.amberBg, color: T.action, border: `1px solid ${T.amberBorder}` }}>
            {p.remindersLoading ? <Spinner size={13} /> : <Icon name="bell" size={14} />}
            {p.remindersLoading ? "Building…" : "Reminders"}
          </button>

          <button onClick={p.onGenerateContract} disabled={p.contractLoading}
            title="Fill contract template with client details + agreed price"
            className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-px disabled:opacity-40"
            style={{ background: T.violetBg, color: T.violet, border: `1px solid ${T.violetBorder}` }}>
            {p.contractLoading ? <Spinner size={13} /> : <Icon name="doc" size={14} />}
            {p.contractLoading ? "Building…" : "Contract"}
          </button>

          {paid ? (
            <button onClick={p.onPreviewConfirmation} disabled={p.previewLoading || p.confirmLoading}
              title="Preview + send payment confirmation email"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-px disabled:opacity-40"
              style={{ background: T.redBg, color: T.red, border: `1px solid ${T.redBorder}` }}>
              {p.previewLoading ? <Spinner size={13} /> : <Icon name="mail" size={14} />}
              {p.previewLoading ? "Building…" : "Payment Email"}
            </button>
          ) : (
            <button onClick={() => setMarkPaidOpen(v => !v)} disabled={p.markPaidLoading}
              title="Record a payment manually when the Gmail scan can't find it"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:-translate-y-px disabled:opacity-40"
              style={markPaidOpen
                ? { background: T.green, color: "#10231a", border: `1px solid ${T.green}` }
                : { background: T.inset, color: T.inkSoft, border: `1px dashed ${T.borderStrong}` }}>
              <Icon name="check" size={14} />
              Mark Paid
            </button>
          )}
        </div>

        {!paid && markPaidOpen && (
          <MarkPaidForm loading={p.markPaidLoading} onSubmit={p.onMarkPaid}
            onCancel={() => setMarkPaidOpen(false)} />
        )}
      </div>
    </Panel>
  );
}
