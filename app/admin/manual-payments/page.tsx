"use client";
// Manual revenue entry: a spreadsheet that mirrors the payments table.
// Every linked row arrives pre-populated (saved deposits verbatim, the rest
// from the inferred session total) — edit what's wrong, then save. Bulk save
// only touches rows you edited or selected, so the pre-filled suggestions
// can never bulk-insert themselves.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { checkAuth } from "@/lib/adminAuth";
import { GlassPanel } from "@/app/admin/payments/Glass";
import { REV } from "@/app/admin/payments/palette";
import PaymentStatusPanel from "./PaymentStatusPanel";
import RecentPaymentsPanel from "./RecentPaymentsPanel";
import SpreadsheetTable from "./SpreadsheetTable";
import {
  amountForType, emptyRows, paymentOnlyRows, rebalanceAmounts, relatedPayments, rowIsReady, rowsFromInquiries, seedAmounts,
  type AmountCol,
} from "./helpers";
import type { InquiryOption, PaymentRow, SavedPayment } from "./types";

type StatusFilter = "all" | "full" | "partial" | "none";

const HIDDEN_KEY = "manual_payments_hidden";

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
      const s = localStorage.getItem(HIDDEN_KEY);
      if (s) hidden = new Set(JSON.parse(s) as number[]);
    } catch {}
    setHiddenIds(hidden);
    void loadData(true, hidden);
  }, []);

  // Paid flags always derive from the freshest payments list, so a D1/D2
  // button click locks the matching amount cell immediately.
  const liveRows = useMemo(() => rows.map(row => {
    if (!row.inquiry_id && !row.client_email.trim() && !row.client_name.trim()) return row;
    const related = relatedPayments(payments, row.inquiry_id, row.client_email, row.client_name);
    const full = related.some(p => p.payment_type === "full");
    return {
      ...row,
      d1Paid: full || related.some(p => p.payment_type === "deposit_1"),
      d2Paid: full || related.some(p => p.payment_type === "deposit_2"),
    };
  }), [rows, payments]);

  const readyRows = useMemo(
    () => liveRows.filter(r => (r.touched || selectedKeys.has(r.key)) && rowIsReady(r)),
    [liveRows, selectedKeys],
  );

  const statusOf = (row: PaymentRow): Exclude<StatusFilter, "all"> =>
    row.d1Paid && row.d2Paid ? "full" : row.d1Paid ? "partial" : "none";

  const displayRows = useMemo(() => {
    let result = liveRows;
    if (search) result = result.filter(r => `${r.client_name} ${r.client_email}`.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== "all") result = result.filter(r => statusOf(r) === statusFilter);
    return result;
  }, [liveRows, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const c = { full: 0, partial: 0, none: 0 };
    for (const r of liveRows) c[statusOf(r)]++;
    return c;
  }, [liveRows]);

  const allDisplayedSelected = displayRows.length > 0 && displayRows.every(r => selectedKeys.has(r.key));

  async function loadData(seedRows = false, hidden: Set<number> = hiddenIds) {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manual-payments");
      const json = await res.json() as { inquiries?: InquiryOption[]; payments?: SavedPayment[]; error?: string };
      if (!res.ok) { setMessage({ text: json.error ?? "Could not load manual payment data.", ok: false }); return; }
      const loaded = (json.inquiries ?? []).filter(i => !hidden.has(i.id));
      const loadedPayments = json.payments ?? [];
      setInquiries(loaded);
      setPayments(loadedPayments);
      if (seedRows && (loaded.length > 0 || loadedPayments.length > 0)) {
        // Inquiry rows first, then ledger-only clients (payments without an
        // inquiry) so paid clients can never disappear from the spreadsheet.
        setRows([
          ...rowsFromInquiries(loaded, loadedPayments),
          ...paymentOnlyRows(loadedPayments, loaded),
        ]);
        setSelectedKeys(new Set());
      }
    } catch {
      setMessage({ text: "Could not load manual payment data.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  function patchRow(key: string, patch: Partial<PaymentRow>, touch = false) {
    setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch, ...(touch ? { touched: true } : {}) } : r));
  }

  // Rebalance against LIVE paid flags (not the seeded ones): after "Clear
  // payments" voids a client's rows, typing the corrected full total must
  // re-populate both deposits again.
  function editAmount(key: string, col: AmountCol, value: string) {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r;
      const related = relatedPayments(payments, r.inquiry_id, r.client_email, r.client_name);
      const full = related.some(p => p.payment_type === "full");
      const flags = {
        d1Paid: full || related.some(p => p.payment_type === "deposit_1"),
        d2Paid: full || related.some(p => p.payment_type === "deposit_2"),
      };
      return { ...r, ...rebalanceAmounts(r, col, value, flags), touched: true };
    }));
  }

  function applyInquiry(key: string, value: string) {
    const match = inquiries.find(i => i.name.toLowerCase() === value.toLowerCase() || i.email.toLowerCase() === value.toLowerCase() || String(i.id) === value);
    if (!match) { patchRow(key, { client_name: value, inquiry_id: null }, true); return; }
    const seed = seedAmounts(match, payments);
    patchRow(key, {
      inquiry_id: match.id,
      client_name: match.name,
      client_email: match.email,
      session_date: match.session_date?.slice(0, 10) ?? "",
      payment_type: seed.nextType,
      ...seed,
    }, true);
  }

  function hideInquiries(ids: number[]) {
    setHiddenIds(prev => {
      const next = new Set([...prev, ...ids]);
      localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function restoreAll() {
    localStorage.removeItem(HIDDEN_KEY);
    const empty = new Set<number>();
    setHiddenIds(empty);
    void loadData(true, empty);
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
      displayRows.forEach(r => { if (allDisplayedSelected) n.delete(r.key); else n.add(r.key); });
      return n;
    });
  }

  function toggleRow(key: string, checked: boolean) {
    setSelectedKeys(prev => {
      const n = new Set(prev);
      if (checked) n.add(key);
      else n.delete(key);
      return n;
    });
  }

  async function saveRows() {
    setSaving(true); setMessage(null);
    try {
      const payload = readyRows.map(r => ({ ...r, amount: amountForType(r) }));
      const res = await fetch("/api/admin/manual-payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: payload }) });
      const json = await res.json() as { saved?: SavedPayment[]; error?: string };
      if (!res.ok) { setMessage({ text: json.error ?? "Could not save payments.", ok: false }); return; }
      const saved = json.saved ?? [];
      setMessage({ text: `${saved.length} payment${saved.length === 1 ? "" : "s"} saved.`, ok: true });
      await loadData(true);
    } catch {
      setMessage({ text: "Could not save payments.", ok: false });
    } finally {
      setSaving(false);
    }
  }

  if (!authed && !loading) {
    return (
      <main className="min-h-screen px-4 py-10" style={{ background: REV.canvas }}>
        <GlassPanel className="mx-auto max-w-md p-6">
          <p className="text-sm font-black" style={{ color: REV.text }}>Admin session required</p>
          <p className="mt-2 text-sm" style={{ color: REV.textSoft }}>Sign in from the admin page, then reopen manual payments.</p>
          <Link href="/admin" className="mt-4 inline-flex rounded-xl px-4 py-2 text-xs font-black text-white" style={{ background: REV.accent }}>Open Admin</Link>
        </GlassPanel>
      </main>
    );
  }

  const FILTERS: { key: StatusFilter; label: string; count: number; color: string; bg: string }[] = [
    { key: "all", label: "All", count: liveRows.length, color: REV.textSoft, bg: REV.neutralBg },
    { key: "full", label: "Paid", count: statusCounts.full, color: REV.accent, bg: REV.accentBg },
    { key: "partial", label: "In progress", count: statusCounts.partial, color: REV.amber, bg: REV.amberBg },
    { key: "none", label: "Unpaid", count: statusCounts.none, color: REV.red, bg: REV.redBg },
  ];

  const pill = "rounded-xl px-3 py-2 text-xs font-black transition-opacity hover:opacity-80 disabled:opacity-45";

  return (
    <main className="relative min-h-screen px-3 py-4 sm:px-5 overflow-x-hidden" style={{ background: REV.canvas }}>
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage: REV.grid, backgroundSize: "44px 44px" }} />
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ background: REV.glowA }} />
      <div className="relative mx-auto max-w-[1500px] space-y-4">

        <GlassPanel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: REV.accent }}>Manual revenue entry</p>
            <h1 className="text-xl font-black leading-tight" style={{ color: REV.text }}>Spreadsheet payments</h1>
            <p className="text-xs font-semibold" style={{ color: REV.textFaint }}>
              Amounts mirror the database — saved deposits are locked ✓, the rest are editable suggestions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin?tab=payments" className={pill} style={{ background: REV.violetBg, color: REV.violet }}>← Revenue</Link>
            <button onClick={() => setRows(prev => [...prev, ...emptyRows(6)])} className={pill} style={{ background: REV.neutralBg, color: REV.textSoft }}>+ Add rows</button>
            <button onClick={() => loadData(true)} disabled={loading} className={pill} style={{ background: REV.blueBg, color: REV.blue }}>
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
            <button onClick={saveRows} disabled={saving || readyRows.length === 0} className={`${pill} text-white`} style={{ background: REV.accent }}
              title="Saves only the rows you edited or selected">
              {saving ? "Saving…" : `Save ${readyRows.length || ""} edited/selected`.replace("  ", " ")}
            </button>
          </div>
        </GlassPanel>

        {message && (
          <div className="rounded-xl px-4 py-3 text-sm font-bold" role="status"
            style={{
              background: message.ok ? REV.accentBg : REV.redBg,
              border: `1px solid ${message.ok ? "rgba(16,185,129,0.3)" : "rgba(220,60,66,0.3)"}`,
              color: message.ok ? REV.accent : REV.red,
            }}>
            {message.text}
          </div>
        )}

        <GlassPanel className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 px-3 pt-3 pb-2">
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
              aria-label="Search clients"
              className="h-9 w-full max-w-xs rounded-xl px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/50"
              style={{ border: `1px solid ${REV.panelBorder}`, background: REV.inset, color: REV.text }} />
            <div className="flex gap-1" role="group" aria-label="Payment status filter">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)} aria-pressed={statusFilter === f.key}
                  className="rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-all"
                  style={statusFilter === f.key
                    ? { background: f.bg, color: f.color, boxShadow: `inset 0 0 0 1.5px ${f.color}44` }
                    : { background: "transparent", color: REV.textFaint }}>
                  {f.label} <span className="opacity-70 tabular-nums">{f.count}</span>
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              {hiddenIds.size > 0 && (
                <button onClick={restoreAll} className="rounded-xl px-3 py-1.5 text-xs font-black" style={{ background: REV.violetBg, color: REV.violet }}>
                  Restore hidden ({hiddenIds.size})
                </button>
              )}
              {selectedKeys.size > 0 && (
                <button onClick={deleteSelected} className="rounded-xl px-3 py-1.5 text-xs font-black" style={{ background: REV.redBg, color: REV.red }}>
                  Remove selected ({selectedKeys.size})
                </button>
              )}
            </div>
          </div>
          <SpreadsheetTable
            rows={displayRows}
            inquiries={inquiries}
            payments={payments}
            selectedKeys={selectedKeys}
            allSelected={allDisplayedSelected}
            onToggleAll={toggleSelectAll}
            onToggleRow={toggleRow}
            onPatch={patchRow}
            onEditAmount={editAmount}
            onApplyInquiry={applyInquiry}
            onDeleteRow={deleteRow}
            onSaved={(saved, text) => { setPayments(prev => [...saved, ...prev]); setMessage({ text, ok: true }); }}
            onError={text => setMessage({ text, ok: false })}
            onVoided={id => setPayments(p => p.filter(p2 => p2.inquiry_id !== id))}
          />
        </GlassPanel>

        <PaymentStatusPanel inquiries={inquiries} payments={payments}
          onSaved={(saved, text) => { setPayments(prev => [...saved, ...prev]); setMessage({ text, ok: true }); }}
          onError={text => setMessage({ text, ok: false })} />

        <RecentPaymentsPanel payments={payments} />
      </div>
    </main>
  );
}
