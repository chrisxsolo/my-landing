"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { checkAuth } from "@/lib/adminAuth";
import { C } from "@/lib/colors";
import { inferSessionTotalCents } from "@/lib/paymentTotalInference";
import PaymentStatusPanel from "./PaymentStatusPanel";
import RowActions from "./RowActions";
import type { InquiryOption, PaymentRow, SavedPayment } from "./types";

const INPUT = "h-9 w-full min-w-0 rounded-none border-0 bg-transparent px-2 text-xs font-semibold outline-none";
const TH = "sticky top-0 z-10 border-b border-r px-2 py-2 text-left text-[10px] font-black uppercase tracking-widest";
const TD = "border-b border-r align-middle";
const METHODS = ["Venmo", "Zelle", "PayPal", "Cash App", "Pixieset", "Cash", "manual", "other"];
const PAYMENT_TYPES = [
  { value: "deposit_1", label: "Deposit" },
  { value: "deposit_2", label: "Final" },
  { value: "full", label: "Full" },
  { value: "other", label: "Other" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseToIsoDate(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  // Strip ordinal suffixes ("5th" → "5") then try native parse
  const cleaned = value.replace(/(\d+)(st|nd|rd|th)\b/gi, "$1");
  const d = new Date(cleaned);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

function emptyRows(count: number): PaymentRow[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `${Date.now()}-${index}`,
    inquiry_id: null,
    client_name: "",
    client_email: "",
    amount: "",
    method: "Venmo",
    payment_type: "deposit_1",
    paid_at: today(),
    session_date: "",
    invoice: "",
    note: "",
  }));
}

function rowsFromInquiries(inquiries: InquiryOption[]): PaymentRow[] {
  return inquiries.map((inquiry, index) => ({
    key: `inquiry-${inquiry.id}-${index}`,
    inquiry_id: inquiry.id,
    client_name: inquiry.name,
    client_email: inquiry.email,
    amount: "",
    method: "Venmo",
    payment_type: "deposit_1",
    paid_at: inquiry.deposit_paid_at?.slice(0, 10) ?? inquiry.payment_detected_at?.slice(0, 10) ?? today(),
    session_date: parseToIsoDate(inquiry.session_date ?? inquiry.date_in_mind),
    invoice: "",
    note: "",
  }));
}

function displayMoney(amount: string, cents?: number) {
  if (cents && cents > 0) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }
  return amount ? `$${amount.replace(/^\$/, "")}` : "$0";
}

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function ManualPaymentsPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<PaymentRow[]>(() => emptyRows(12));
  const [inquiries, setInquiries] = useState<InquiryOption[]>([]);
  const [payments, setPayments] = useState<SavedPayment[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const isAuthed = checkAuth();
    setAuthed(isAuthed);
    if (!isAuthed) {
      setLoading(false);
      return;
    }
    void loadData(true);
  }, []);

  const completeRows = useMemo(() => rows.filter(row => (
    row.client_name.trim() && row.amount.trim() && row.paid_at
  )), [rows]);

  const paymentStatusMap = useMemo(() => {
    const map = new Map<number, "full" | "partial" | "none">();
    for (const inquiry of inquiries) {
      const related = payments.filter(p =>
        p.status === "active" &&
        (p.inquiry_id === inquiry.id || p.client_email?.toLowerCase() === inquiry.email.toLowerCase())
      );
      const paid1 = related.some(p => p.payment_type === "deposit_1" || p.payment_type === "full");
      const paid2 = related.some(p => p.payment_type === "deposit_2" || p.payment_type === "full");
      map.set(inquiry.id, paid1 && paid2 ? "full" : paid1 ? "partial" : "none");
    }
    return map;
  }, [inquiries, payments]);

  async function loadData(seedRows = false) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manual-payments");
      const json = await res.json() as { inquiries?: InquiryOption[]; payments?: SavedPayment[]; error?: string };
      if (!res.ok) {
        setMessage({ text: json.error ?? "Could not load manual payment data.", ok: false });
        return;
      }
      const loadedInquiries = json.inquiries ?? [];
      setInquiries(loadedInquiries);
      setPayments(json.payments ?? []);
      if (seedRows && loadedInquiries.length > 0) {
        setRows(rowsFromInquiries(loadedInquiries));
      }
    } catch {
      setMessage({ text: "Could not load manual payment data.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  function patchRow(key: string, patch: Partial<PaymentRow>) {
    setRows(prev => prev.map(row => row.key === key ? { ...row, ...patch } : row));
  }

  function inferDepositAmount(inquiry: InquiryOption, paymentType: string) {
    const total = inferSessionTotalCents(inquiry);
    if (total <= 0) return "";
    if (paymentType === "full") return formatCents(total);
    const first = Math.round(total / 2);
    return formatCents(paymentType === "deposit_2" ? total - first : first);
  }

  function applyInquiry(key: string, value: string) {
    const current = rows.find(row => row.key === key);
    const match = inquiries.find(item => (
      item.name.toLowerCase() === value.toLowerCase()
      || item.email.toLowerCase() === value.toLowerCase()
      || String(item.id) === value
    ));
    if (!match) {
      patchRow(key, { client_name: value, inquiry_id: null });
      return;
    }
    patchRow(key, {
      inquiry_id: match.id,
      client_name: match.name,
      client_email: match.email,
      session_date: parseToIsoDate(match.session_date ?? match.date_in_mind),
      amount: current?.amount || inferDepositAmount(match, current?.payment_type ?? "deposit_1"),
    });
  }

  function autoFill() {
    const METHOD_HINTS: [string, string][] = [
      ["venmo", "Venmo"], ["zelle", "Zelle"], ["paypal", "PayPal"],
      ["cash app", "Cash App"], ["pixieset", "Pixieset"], ["cash", "Cash"],
    ];
    setRows(prev => prev.map(row => {
      if (!row.inquiry_id) return row;
      const inquiry = inquiries.find(i => i.id === row.inquiry_id);
      if (!inquiry) return row;
      const totalCents = inferSessionTotalCents(inquiry);
      const amount = row.amount.trim() || (totalCents > 0 ? formatCents(totalCents) : "");
      const related = payments.filter(p =>
        p.status === "active" &&
        (p.inquiry_id === row.inquiry_id || p.client_email?.toLowerCase() === inquiry.email.toLowerCase())
      );
      const depositDate = inquiry.deposit_paid_at?.slice(0, 10) ?? inquiry.payment_detected_at?.slice(0, 10);
      const paid_at = depositDate ?? row.paid_at;
      const noteText = (inquiry.payment_note ?? "").toLowerCase();
      const noteMethod = METHOD_HINTS.find(([k]) => noteText.includes(k))?.[1];
      const existingMethod = related.find(p => p.method && p.method !== "manual")?.method;
      const method = noteMethod ?? existingMethod ?? row.method;
      return { ...row, amount, paid_at, method };
    }));
  }

  function handleVoided(inquiryId: number) {
    setPayments(prev => prev.filter(p => p.inquiry_id !== inquiryId));
  }

  async function saveRows() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: completeRows }),
      });
      const json = await res.json() as { saved?: SavedPayment[]; error?: string };
      if (!res.ok) {
        setMessage({ text: json.error ?? "Could not save payments.", ok: false });
        return;
      }
      const saved = json.saved ?? [];
      setPayments(prev => [...saved, ...prev]);
      setRows(rowsFromInquiries(inquiries));
      setMessage({ text: `${saved.length} payment${saved.length === 1 ? "" : "s"} saved.`, ok: true });
    } catch {
      setMessage({ text: "Could not save payments.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (!authed && !loading) {
    return (
      <main className="min-h-screen px-4 py-10" style={{ background: C.page }}>
        <div className="mx-auto max-w-md rounded-2xl border p-6" style={{ background: C.white, borderColor: C.borderSubtle }}>
          <p className="text-sm font-black" style={{ color: C.ink }}>Admin session required</p>
          <p className="mt-2 text-sm" style={{ color: C.muted }}>Sign in from the admin page, then reopen manual payments.</p>
          <Link href="/admin" className="mt-4 inline-flex rounded-xl px-4 py-2 text-xs font-black" style={{ background: C.grad12, color: C.white }}>
            Open Admin
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-3 py-4 sm:px-5" style={{ background: C.page }}>
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: C.white, borderColor: C.borderSubtle }}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: C.p1 }}>Manual Revenue Entry</p>
            <h1 className="text-xl font-black leading-tight" style={{ color: C.ink }}>Spreadsheet payments</h1>
            <p className="text-xs font-semibold" style={{ color: C.muted }}>{completeRows.length} ready to save</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={autoFill} className="rounded-xl px-3 py-2 text-xs font-black" style={{ background: C.p3_10, color: C.ink }}>
              Auto-fill amounts
            </button>
            <button onClick={() => setRows(prev => [...prev, ...emptyRows(6)])} className="rounded-xl px-3 py-2 text-xs font-black" style={{ background: C.p1_08, color: C.p1 }}>
              Add rows
            </button>
            <button onClick={() => loadData(false)} disabled={loading} className="rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50" style={{ background: C.p2_08, color: C.p2 }}>
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button onClick={saveRows} disabled={saving || completeRows.length === 0} className="rounded-xl px-4 py-2 text-xs font-black disabled:opacity-50" style={{ background: C.grad12, color: C.white }}>
              {saving ? "Saving..." : "Save to database"}
            </button>
          </div>
        </header>

        {message && (
          <div className="rounded-xl border px-4 py-3 text-sm font-bold" style={{
            background: message.ok ? C.p1_08 : C.p2_08,
            borderColor: message.ok ? C.p1_20 : C.p2_20,
            color: message.ok ? C.success : C.danger,
          }}>
            {message.text}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border" style={{ background: C.white, borderColor: C.borderSubtle }}>
          <div className="overflow-auto">
            <table className="w-full min-w-[1120px] border-collapse">
              <thead style={{ background: C.surfaceSoft }}>
                <tr style={{ color: C.muted }}>
                  <th className={`${TH} w-[36px]`} style={{ borderColor: C.borderSubtle }}></th>
                  <th className={`${TH} w-[48px]`} style={{ borderColor: C.borderSubtle }}>#</th>
                  <th className={`${TH} w-[190px]`} style={{ borderColor: C.borderSubtle }}>Client</th>
                  <th className={`${TH} w-[220px]`} style={{ borderColor: C.borderSubtle }}>Email</th>
                  <th className={`${TH} w-[120px]`} style={{ borderColor: C.borderSubtle }}>Amount</th>
                  <th className={`${TH} w-[130px]`} style={{ borderColor: C.borderSubtle }}>Method</th>
                  <th className={`${TH} w-[120px]`} style={{ borderColor: C.borderSubtle }}>Type</th>
                  <th className={`${TH} w-[130px]`} style={{ borderColor: C.borderSubtle }}>Paid Date</th>
                  <th className={`${TH} w-[130px]`} style={{ borderColor: C.borderSubtle }}>Session Date</th>
                  <th className={`${TH} w-[190px]`} style={{ borderColor: C.borderSubtle }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key} className="group" style={{ background: (() => {
                    const s = row.inquiry_id ? (paymentStatusMap.get(row.inquiry_id) ?? "none") : null;
                    if (s === "full") return "rgba(18,128,92,0.10)";
                    if (s === "partial") return C.p3_08;
                    if (s === "none") return "rgba(180,35,24,0.07)";
                    return index % 2 ? C.surfaceStrong : C.white;
                  })() }}>
                    <td className={`${TD} px-1 text-center`} style={{ borderColor: C.borderSubtle }}>
                      <button
                        onClick={() => setRows(prev => prev.filter(r => r.key !== row.key))}
                        className="rounded px-1.5 py-1 text-xs font-black opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ color: C.danger }}
                        title="Remove row"
                      >×</button>
                    </td>
                    <td className={`${TD} px-2 text-center text-xs font-black`} style={{ borderColor: C.borderSubtle, color: C.mutedSoft }}>{index + 1}</td>
                    <td className={TD} style={{ borderColor: C.borderSubtle }}>
                      <input list="manual-payment-clients" className={INPUT} value={row.client_name} onChange={event => applyInquiry(row.key, event.target.value)} />
                    </td>
                    <td className={TD} style={{ borderColor: C.borderSubtle }}>
                      <input className={INPUT} type="email" value={row.client_email} onChange={event => patchRow(row.key, { client_email: event.target.value, inquiry_id: null })} />
                    </td>
                    <td className={TD} style={{ borderColor: C.borderSubtle }}>
                      <input className={INPUT} inputMode="decimal" value={row.amount} onChange={event => patchRow(row.key, { amount: event.target.value })} />
                    </td>
                    <td className={TD} style={{ borderColor: C.borderSubtle }}>
                      <select className={INPUT} value={row.method} onChange={event => patchRow(row.key, { method: event.target.value })}>
                        {METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                      </select>
                    </td>
                    <td className={TD} style={{ borderColor: C.borderSubtle }}>
                      <select className={INPUT} value={row.payment_type} onChange={event => patchRow(row.key, { payment_type: event.target.value })}>
                        {PAYMENT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                      </select>
                    </td>
                    <td className={TD} style={{ borderColor: C.borderSubtle }}>
                      <input className={INPUT} type="date" value={row.paid_at} onChange={event => patchRow(row.key, { paid_at: event.target.value })} />
                    </td>
                    <td className={TD} style={{ borderColor: C.borderSubtle }}>
                      <input className={INPUT} type="date" value={row.session_date} onChange={event => patchRow(row.key, { session_date: event.target.value })} />
                    </td>
                    <td className={TD} style={{ borderColor: C.borderSubtle }}>
                      <RowActions
                        row={row}
                        payments={payments}
                        onSaved={(saved, text) => { setPayments(prev => [...saved, ...prev]); setMessage({ text, ok: true }); }}
                        onError={text => setMessage({ text, ok: false })}
                        onVoided={handleVoided}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <datalist id="manual-payment-clients">
            {inquiries.map(inquiry => (
              <option key={inquiry.id} value={inquiry.name}>{inquiry.email}</option>
            ))}
          </datalist>
        </section>

        <PaymentStatusPanel
          inquiries={inquiries}
          payments={payments}
          onSaved={(saved, text) => {
            setPayments(prev => [...saved, ...prev]);
            setMessage({ text, ok: true });
          }}
          onError={text => setMessage({ text, ok: false })}
        />

        <section className="rounded-2xl border p-4" style={{ background: C.white, borderColor: C.borderSubtle }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.p1 }}>Recent saved payments</p>
            <p className="text-xs font-bold" style={{ color: C.muted }}>{payments.length} loaded</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {payments.slice(0, 18).map(payment => (
              <div key={payment.id} className="rounded-xl border p-3" style={{ borderColor: C.borderSubtle, background: C.surfaceSoft }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {payment.inquiry_id ? (
                      <Link href={`/admin/conversation/${payment.inquiry_id}`} className="block truncate text-sm font-black" style={{ color: C.ink }}>
                        {payment.client_name}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-black" style={{ color: C.ink }}>{payment.client_name}</p>
                    )}
                    <p className="truncate text-[11px] font-semibold" style={{ color: C.muted }}>{payment.client_email || "No email"}</p>
                  </div>
                  <p className="shrink-0 text-sm font-black" style={{ color: C.success }}>{displayMoney(payment.amount, payment.amount_cents)}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: C.muted }}>
                  <span>{payment.method || "manual"}</span>
                  <span>{payment.payment_type?.replace("_", " ")}</span>
                  <span>{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
