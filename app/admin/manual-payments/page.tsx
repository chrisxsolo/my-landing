"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { checkAuth } from "@/lib/adminAuth";
import { C } from "@/lib/colors";
import { inferSessionTotalCents } from "@/lib/paymentTotalInference";
import PaymentStatusPanel from "./PaymentStatusPanel";
import RowActions from "./RowActions";
import { INPUT, TH, TD, METHODS, PAYMENT_TYPES, emptyRows, rowsFromInquiries, displayMoney, formatCents, parseToIsoDate } from "./helpers";
import type { InquiryOption, PaymentRow, SavedPayment } from "./types";

type StatusFilter = "all" | "full" | "partial" | "none";

export default function ManualPaymentsPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<PaymentRow[]>(() => emptyRows(12));
  const [inquiries, setInquiries] = useState<InquiryOption[]>([]);
  const [payments, setPayments] = useState<SavedPayment[]>([]);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const isAuthed = checkAuth();
    setAuthed(isAuthed);
    if (!isAuthed) { setLoading(false); return; }
    let hidden = new Set<number>();
    try {
      const s = localStorage.getItem("manual_payments_hidden");
      if (s) hidden = new Set(JSON.parse(s) as number[]);
    } catch {}
    setHiddenIds(hidden);
    void loadData(true, hidden);
  }, []);

  const completeRows = useMemo(() => rows.filter(r => r.client_name.trim() && r.amount.trim() && r.paid_at), [rows]);

  const paymentStatusMap = useMemo(() => {
    const map = new Map<number, "full" | "partial" | "none">();
    for (const inquiry of inquiries) {
      const rel = payments.filter(p => p.status === "active" && (p.inquiry_id === inquiry.id || p.client_email?.toLowerCase() === inquiry.email.toLowerCase()));
      const p1 = rel.some(p => p.payment_type === "deposit_1" || p.payment_type === "full");
      const p2 = rel.some(p => p.payment_type === "deposit_2" || p.payment_type === "full");
      map.set(inquiry.id, p1 && p2 ? "full" : p1 ? "partial" : "none");
    }
    return map;
  }, [inquiries, payments]);

  const displayRows = useMemo(() => {
    let result = rows;
    if (search) result = result.filter(r => `${r.client_name} ${r.client_email}`.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") result = result.filter(r => (r.inquiry_id ? (paymentStatusMap.get(r.inquiry_id) ?? "none") : "none") === statusFilter);
    return result;
  }, [rows, search, statusFilter, paymentStatusMap]);

  const statusCounts = useMemo(() => {
    const c = { full: 0, partial: 0, none: 0 };
    for (const r of rows) { const s = r.inquiry_id ? (paymentStatusMap.get(r.inquiry_id) ?? "none") : "none"; c[s]++; }
    return c;
  }, [rows, paymentStatusMap]);

  const allDisplayedSelected = displayRows.length > 0 && displayRows.every(r => selectedKeys.has(r.key));

  function hideInquiries(ids: number[]) {
    setHiddenIds(prev => {
      const next = new Set([...prev, ...ids]);
      localStorage.setItem("manual_payments_hidden", JSON.stringify([...next]));
      return next;
    });
  }

  function restoreAll() {
    localStorage.removeItem("manual_payments_hidden");
    const empty = new Set<number>();
    setHiddenIds(empty);
    void loadData(true, empty);
  }

  async function loadData(seedRows = false, hidden: Set<number> = hiddenIds) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manual-payments");
      const json = await res.json() as { inquiries?: InquiryOption[]; payments?: SavedPayment[]; error?: string };
      if (!res.ok) { setMessage({ text: json.error ?? "Could not load manual payment data.", ok: false }); return; }
      const loaded = (json.inquiries ?? []).filter(i => !hidden.has(i.id));
      setInquiries(loaded);
      setPayments(json.payments ?? []);
      if (seedRows && loaded.length > 0) setRows(rowsFromInquiries(loaded));
    } catch {
      setMessage({ text: "Could not load manual payment data.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  function patchRow(key: string, patch: Partial<PaymentRow>) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  }

  function applyInquiry(key: string, value: string) {
    const current = rows.find(r => r.key === key);
    const match = inquiries.find(i => i.name.toLowerCase() === value.toLowerCase() || i.email.toLowerCase() === value.toLowerCase() || String(i.id) === value);
    if (!match) { patchRow(key, { client_name: value, inquiry_id: null }); return; }
    const total = inferSessionTotalCents(match);
    const pt = current?.payment_type ?? "deposit_1";
    const half = Math.round(total / 2);
    const suggested = total > 0 ? formatCents(pt === "full" ? total : pt === "deposit_2" ? total - half : half) : "";
    patchRow(key, {
      inquiry_id: match.id, client_name: match.name, client_email: match.email,
      session_date: parseToIsoDate(match.session_date ?? match.date_in_mind),
      amount: current?.amount || suggested,
    });
  }

  function autoFill() {
    const HINTS: [string, string][] = [["venmo","Venmo"],["zelle","Zelle"],["paypal","PayPal"],["cash app","Cash App"],["pixieset","Pixieset"],["cash","Cash"]];
    setRows(prev => prev.map(row => {
      if (!row.inquiry_id) return row;
      const inq = inquiries.find(i => i.id === row.inquiry_id);
      if (!inq) return row;
      const total = inferSessionTotalCents(inq);
      const amount = row.amount.trim() || (total > 0 ? formatCents(total) : "");
      const depositDate = inq.deposit_paid_at?.slice(0, 10) ?? inq.payment_detected_at?.slice(0, 10);
      const paid_at = depositDate ?? row.paid_at;
      const noteText = (inq.payment_note ?? "").toLowerCase();
      const noteMethod = HINTS.find(([k]) => noteText.includes(k))?.[1];
      const rel = payments.filter(p => p.status === "active" && (p.inquiry_id === row.inquiry_id || p.client_email?.toLowerCase() === inq.email.toLowerCase()));
      const method = noteMethod ?? rel.find(p => p.method && p.method !== "manual")?.method ?? row.method;
      return { ...row, amount, paid_at, method };
    }));
  }

  function deleteRow(row: PaymentRow) {
    setRows(p => p.filter(r => r.key !== row.key));
    if (row.inquiry_id) {
      setInquiries(p => p.filter(i => i.id !== row.inquiry_id));
      hideInquiries([row.inquiry_id]);
    }
    setSelectedKeys(p => { const n = new Set(p); n.delete(row.key); return n; });
  }

  function deleteSelected() {
    const toDelete = rows.filter(r => selectedKeys.has(r.key));
    const idsToRemove = toDelete.map(r => r.inquiry_id).filter(Boolean) as number[];
    setRows(p => p.filter(r => !selectedKeys.has(r.key)));
    if (idsToRemove.length > 0) {
      const idSet = new Set(idsToRemove);
      setInquiries(p => p.filter(i => !idSet.has(i.id)));
      hideInquiries(idsToRemove);
    }
    setSelectedKeys(new Set());
  }

  function toggleSelectAll() {
    setSelectedKeys(prev => {
      const n = new Set(prev);
      allDisplayedSelected ? displayRows.forEach(r => n.delete(r.key)) : displayRows.forEach(r => n.add(r.key));
      return n;
    });
  }

  function toggleRow(key: string, checked: boolean) {
    setSelectedKeys(prev => { const n = new Set(prev); checked ? n.add(key) : n.delete(key); return n; });
  }

  async function saveRows() {
    setSaving(true); setMessage(null);
    try {
      const res = await fetch("/api/admin/manual-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: completeRows }) });
      const json = await res.json() as { saved?: SavedPayment[]; error?: string };
      if (!res.ok) { setMessage({ text: json.error ?? "Could not save payments.", ok: false }); return; }
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
          <Link href="/admin" className="mt-4 inline-flex rounded-xl px-4 py-2 text-xs font-black" style={{ background: C.grad12, color: C.white }}>Open Admin</Link>
        </div>
      </main>
    );
  }

  const FILTERS: { key: StatusFilter; label: string; count: number; bg: string; active: string }[] = [
    { key: "all", label: "All", count: rows.length, bg: C.surfaceSoft, active: C.p1_12 },
    { key: "full", label: "Paid", count: statusCounts.full, bg: "rgba(18,128,92,0.08)", active: "rgba(18,128,92,0.18)" },
    { key: "partial", label: "In Progress", count: statusCounts.partial, bg: C.p3_08, active: C.p3_15 },
    { key: "none", label: "Unpaid", count: statusCounts.none, bg: "rgba(180,35,24,0.07)", active: "rgba(180,35,24,0.16)" },
  ];

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
            <button onClick={autoFill} className="rounded-xl px-3 py-2 text-xs font-black" style={{ background: C.p3_10, color: C.ink }}>Auto-fill amounts</button>
            <button onClick={() => setRows(prev => [...prev, ...emptyRows(6)])} className="rounded-xl px-3 py-2 text-xs font-black" style={{ background: C.p1_08, color: C.p1 }}>Add rows</button>
            <button onClick={() => loadData(false)} disabled={loading} className="rounded-xl px-3 py-2 text-xs font-black disabled:opacity-50" style={{ background: C.p2_08, color: C.p2 }}>{loading ? "Loading..." : "Refresh"}</button>
            <button onClick={saveRows} disabled={saving || completeRows.length === 0} className="rounded-xl px-4 py-2 text-xs font-black disabled:opacity-50" style={{ background: C.grad12, color: C.white }}>{saving ? "Saving..." : "Save to database"}</button>
          </div>
        </header>

        {message && (
          <div className="rounded-xl border px-4 py-3 text-sm font-bold" style={{ background: message.ok ? C.p1_08 : C.p2_08, borderColor: message.ok ? C.p1_20 : C.p2_20, color: message.ok ? C.success : C.danger }}>
            {message.text}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border" style={{ background: C.white, borderColor: C.borderSubtle }}>
          <div className="flex flex-wrap items-center gap-2 px-3 pt-3">
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
              className="h-9 w-full max-w-xs rounded-xl border px-3 text-xs font-bold outline-none"
              style={{ borderColor: C.borderSubtle, background: C.surfaceSoft, color: C.ink }} />
            <div className="flex gap-1">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className="rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-colors"
                  style={{ background: statusFilter === f.key ? f.active : f.bg, color: C.ink }}>
                  {f.label} <span className="opacity-60">{f.count}</span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              {hiddenIds.size > 0 && (
                <button onClick={restoreAll} className="rounded-xl px-3 py-1.5 text-xs font-black" style={{ background: C.p1_08, color: C.p1 }}>
                  Restore all ({hiddenIds.size})
                </button>
              )}
              {selectedKeys.size > 0 && (
                <button onClick={deleteSelected} className="rounded-xl px-3 py-1.5 text-xs font-black" style={{ background: "rgba(180,35,24,0.10)", color: C.danger }}>
                  Delete selected ({selectedKeys.size})
                </button>
              )}
            </div>
          </div>
          <div className="overflow-auto mt-2">
            <table className="w-full min-w-[1120px] border-collapse">
              <thead style={{ background: C.surfaceSoft }}>
                <tr style={{ color: C.muted }}>
                  <th className={`${TH} w-[40px]`} style={{ borderColor: C.borderSubtle }}>
                    <input type="checkbox" checked={allDisplayedSelected} onChange={toggleSelectAll} className="cursor-pointer" />
                  </th>
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
                {displayRows.map((row, index) => {
                  const s = row.inquiry_id ? (paymentStatusMap.get(row.inquiry_id) ?? "none") : null;
                  const bg = s === "full" ? "rgba(18,128,92,0.10)" : s === "partial" ? C.p3_08 : s === "none" ? "rgba(180,35,24,0.07)" : index % 2 ? C.surfaceStrong : C.white;
                  return (
                    <tr key={row.key} className="group" style={{ background: bg }}>
                      <td className={`${TD} px-2 text-center`} style={{ borderColor: C.borderSubtle }}>
                        <div className="flex items-center justify-center gap-1">
                          <input type="checkbox" checked={selectedKeys.has(row.key)} onChange={e => toggleRow(row.key, e.target.checked)} className="cursor-pointer" />
                          <button onClick={() => deleteRow(row)} className="text-xs font-black opacity-0 transition-opacity group-hover:opacity-70" style={{ color: C.danger }} title="Remove">×</button>
                        </div>
                      </td>
                      <td className={`${TD} px-2 text-center text-xs font-black`} style={{ borderColor: C.borderSubtle, color: C.mutedSoft }}>{index + 1}</td>
                      <td className={TD} style={{ borderColor: C.borderSubtle }}>
                        <input list="manual-payment-clients" className={INPUT} value={row.client_name} onChange={e => applyInquiry(row.key, e.target.value)} />
                      </td>
                      <td className={TD} style={{ borderColor: C.borderSubtle }}>
                        <input className={INPUT} type="email" value={row.client_email} onChange={e => patchRow(row.key, { client_email: e.target.value, inquiry_id: null })} />
                      </td>
                      <td className={TD} style={{ borderColor: C.borderSubtle }}>
                        <input className={INPUT} inputMode="decimal" value={row.amount} onChange={e => patchRow(row.key, { amount: e.target.value })} />
                      </td>
                      <td className={TD} style={{ borderColor: C.borderSubtle }}>
                        <select className={INPUT} value={row.method} onChange={e => patchRow(row.key, { method: e.target.value })}>
                          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>
                      <td className={TD} style={{ borderColor: C.borderSubtle }}>
                        <select className={INPUT} value={row.payment_type} onChange={e => patchRow(row.key, { payment_type: e.target.value })}>
                          {PAYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </td>
                      <td className={TD} style={{ borderColor: C.borderSubtle }}>
                        <input className={INPUT} type="date" value={row.paid_at} onChange={e => patchRow(row.key, { paid_at: e.target.value })} />
                      </td>
                      <td className={TD} style={{ borderColor: C.borderSubtle }}>
                        <input className={INPUT} type="date" value={row.session_date} onChange={e => patchRow(row.key, { session_date: e.target.value })} />
                      </td>
                      <td className={TD} style={{ borderColor: C.borderSubtle }}>
                        <RowActions row={row} payments={payments}
                          onSaved={(saved, text) => { setPayments(prev => [...saved, ...prev]); setMessage({ text, ok: true }); }}
                          onError={text => setMessage({ text, ok: false })}
                          onVoided={id => setPayments(p => p.filter(p2 => p2.inquiry_id !== id))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <datalist id="manual-payment-clients">
            {inquiries.map(i => <option key={i.id} value={i.name}>{i.email}</option>)}
          </datalist>
        </section>

        <PaymentStatusPanel inquiries={inquiries} payments={payments}
          onSaved={(saved, text) => { setPayments(prev => [...saved, ...prev]); setMessage({ text, ok: true }); }}
          onError={text => setMessage({ text, ok: false })} />

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
                    {payment.inquiry_id
                      ? <Link href={`/admin/conversation/${payment.inquiry_id}`} className="block truncate text-sm font-black" style={{ color: C.ink }}>{payment.client_name}</Link>
                      : <p className="truncate text-sm font-black" style={{ color: C.ink }}>{payment.client_name}</p>}
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
