"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { checkAuth } from "@/lib/adminAuth";
import { C } from "@/lib/colors";

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

type InquiryOption = {
  id: number;
  name: string;
  email: string;
  session_type: string | null;
  session_date: string | null;
};

type PaymentRow = {
  key: string;
  inquiry_id: number | null;
  client_name: string;
  client_email: string;
  amount: string;
  method: string;
  payment_type: string;
  paid_at: string;
  session_date: string;
  invoice: string;
  note: string;
};

type SavedPayment = Omit<PaymentRow, "key"> & {
  id: number;
  amount_cents: number;
  source: string;
  status: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
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

function displayMoney(amount: string, cents?: number) {
  if (cents && cents > 0) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }
  return amount ? `$${amount.replace(/^\$/, "")}` : "$0";
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
    void loadData();
  }, []);

  const completeRows = useMemo(() => rows.filter(row => (
    row.client_name.trim() && row.amount.trim() && row.paid_at
  )), [rows]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manual-payments");
      const json = await res.json() as { inquiries?: InquiryOption[]; payments?: SavedPayment[]; error?: string };
      if (!res.ok) {
        setMessage({ text: json.error ?? "Could not load manual payment data.", ok: false });
        return;
      }
      setInquiries(json.inquiries ?? []);
      setPayments(json.payments ?? []);
    } catch {
      setMessage({ text: "Could not load manual payment data.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  function patchRow(key: string, patch: Partial<PaymentRow>) {
    setRows(prev => prev.map(row => row.key === key ? { ...row, ...patch } : row));
  }

  function applyInquiry(key: string, value: string) {
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
      session_date: match.session_date ?? "",
    });
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
      setRows(emptyRows(Math.max(12, rows.length)));
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
            <button onClick={() => setRows(prev => [...prev, ...emptyRows(6)])} className="rounded-xl px-3 py-2 text-xs font-black" style={{ background: C.p1_08, color: C.p1 }}>
              Add rows
            </button>
            <button onClick={loadData} disabled={loading} className="rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50" style={{ background: C.p2_08, color: C.p2 }}>
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
            <table className="w-full min-w-[1180px] border-collapse">
              <thead style={{ background: C.surfaceSoft }}>
                <tr style={{ color: C.muted }}>
                  <th className={`${TH} w-[48px]`} style={{ borderColor: C.borderSubtle }}>#</th>
                  <th className={`${TH} w-[190px]`} style={{ borderColor: C.borderSubtle }}>Client</th>
                  <th className={`${TH} w-[220px]`} style={{ borderColor: C.borderSubtle }}>Email</th>
                  <th className={`${TH} w-[120px]`} style={{ borderColor: C.borderSubtle }}>Amount</th>
                  <th className={`${TH} w-[130px]`} style={{ borderColor: C.borderSubtle }}>Method</th>
                  <th className={`${TH} w-[120px]`} style={{ borderColor: C.borderSubtle }}>Type</th>
                  <th className={`${TH} w-[130px]`} style={{ borderColor: C.borderSubtle }}>Paid Date</th>
                  <th className={`${TH} w-[130px]`} style={{ borderColor: C.borderSubtle }}>Session Date</th>
                  <th className={`${TH} w-[120px]`} style={{ borderColor: C.borderSubtle }}>Invoice</th>
                  <th className={`${TH} min-w-[220px]`} style={{ borderColor: C.borderSubtle }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key} className="group" style={{ background: index % 2 ? C.surfaceStrong : C.white }}>
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
                      <input className={INPUT} value={row.invoice} onChange={event => patchRow(row.key, { invoice: event.target.value })} />
                    </td>
                    <td className={TD} style={{ borderColor: C.borderSubtle }}>
                      <input className={INPUT} value={row.note} onChange={event => patchRow(row.key, { note: event.target.value })} />
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
