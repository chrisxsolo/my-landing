"use client";
// Client payment status cards: per-client total / method / paid date with
// one-click deposit recording. Totals pre-fill from saved deposits, payment
// notes, or session pricing — editable before saving.

import { useMemo, useState } from "react";
import { GlassPanel, SectionHeader } from "@/app/admin/payments/Glass";
import { REV } from "@/app/admin/payments/palette";
import { inferTotalFromRetainer } from "@/lib/pricingCatalog";
import {
  inferSessionTotalCents,
  parseKnownMoneyCents,
  parseLoosePaymentCents,
} from "@/lib/paymentTotalInference";
import { METHODS } from "./helpers";
import type { InquiryOption, SavedPayment } from "./types";

type Props = {
  inquiries: InquiryOption[];
  payments: SavedPayment[];
  onSaved: (payments: SavedPayment[], message: string) => void;
  onError: (message: string) => void;
};

type ClientPlan = {
  id: number;
  name: string;
  email: string;
  sessionType: string | null;
  sessionDate: string | null;
  totalCents: number;
  paid1: boolean;
  paid2: boolean;
  source: string;
};

function parseCents(value: string | null | undefined) {
  return parseLoosePaymentCents(value);
}

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function displayCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function inferTotal(payments: SavedPayment[], note: string | null) {
  const active = payments.filter(payment => payment.status === "active" && (payment.amount_cents || parseCents(payment.amount)) > 0);
  const full = active.find(payment => payment.payment_type === "full");
  if (full) return { cents: full.amount_cents || parseCents(full.amount), source: "full payment" };

  const deposits = active.filter(payment => payment.payment_type === "deposit_1" || payment.payment_type === "deposit_2");
  if (deposits.length >= 2) {
    return { cents: deposits.reduce((sum, payment) => sum + (payment.amount_cents || parseCents(payment.amount)), 0), source: "two deposits" };
  }
  if (deposits.length === 1) {
    return {
      cents: inferTotalFromRetainer(deposits[0].amount_cents || parseCents(deposits[0].amount)),
      source: "retainer policy",
    };
  }

  const noteCents = parseKnownMoneyCents(note);
  return { cents: noteCents, source: noteCents > 0 ? "client note" : "manual" };
}

const FIELD = "mt-1 h-9 w-full rounded-lg px-2 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/50";
const LABEL = "text-[9px] font-black uppercase tracking-[0.14em]";

export default function PaymentStatusPanel({ inquiries, payments, onSaved, onError }: Props) {
  const [query, setQuery] = useState("");
  const [totals, setTotals] = useState<Record<number, string>>({});
  const [methods, setMethods] = useState<Record<number, string>>({});
  const [paidDates, setPaidDates] = useState<Record<number, string>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const plans = useMemo<ClientPlan[]>(() => inquiries.map(inquiry => {
    const related = payments.filter(payment => (
      payment.inquiry_id === inquiry.id
      || (!!payment.client_email && payment.client_email.toLowerCase() === inquiry.email.toLowerCase())
    ));
    const inferred = inferTotal(related, inquiry.payment_note);
    const sessionTotalCents = inferred.cents || inferSessionTotalCents(inquiry);
    const active = related.filter(payment => payment.status === "active");
    return {
      id: inquiry.id,
      name: inquiry.name,
      email: inquiry.email,
      sessionType: inquiry.session_type,
      sessionDate: inquiry.session_date,
      totalCents: sessionTotalCents,
      paid1: active.some(payment => payment.payment_type === "deposit_1" || payment.payment_type === "full"),
      paid2: active.some(payment => payment.payment_type === "deposit_2" || payment.payment_type === "full"),
      source: inferred.cents ? inferred.source : sessionTotalCents > 0 ? "session pricing" : "manual",
    };
  }), [inquiries, payments]);

  const filteredPlans = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return plans
      .filter(plan => !needle || plan.name.toLowerCase().includes(needle) || plan.email.toLowerCase().includes(needle))
      .sort((a, b) => Number(a.paid1 && a.paid2) - Number(b.paid1 && b.paid2))
      .slice(0, 36);
  }, [plans, query]);

  function totalFor(plan: ClientPlan) {
    return totals[plan.id] ?? (plan.totalCents > 0 ? formatCents(plan.totalCents) : "");
  }

  async function markPaid(plan: ClientPlan, paid: "deposit_1" | "deposit_2" | "full") {
    const totalAmount = totalFor(plan);
    setBusyKey(`${plan.id}:${paid}`);
    try {
      const res = await fetch("/api/admin/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark-payment-state",
          inquiry_id: plan.id,
          client_name: plan.name,
          client_email: plan.email,
          total_amount: totalAmount,
          method: methods[plan.id] ?? "manual",
          paid_at: paidDates[plan.id] ?? new Date().toISOString().slice(0, 10),
          paid,
        }),
      });
      const json = await res.json() as { saved?: SavedPayment[]; skipped?: boolean; error?: string };
      if (!res.ok) {
        onError(json.error ?? "Could not update payment state.");
        return;
      }
      onSaved(json.saved ?? [], json.skipped ? "Payment was already recorded." : `${plan.name} updated.`);
    } catch {
      onError("Could not update payment state.");
    } finally {
      setBusyKey(null);
    }
  }

  const fieldStyle = { border: `1px solid ${REV.panelBorder}`, background: "rgba(255,255,255,0.85)", color: REV.text };

  return (
    <GlassPanel className="p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SectionHeader kicker="Manual review" title="Client payment status" accent={REV.violet} />
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search clients…"
          aria-label="Search client payment status"
          className="h-9 min-w-[240px] rounded-xl px-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/50"
          style={{ border: `1px solid ${REV.panelBorder}`, background: REV.inset, color: REV.text }}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {filteredPlans.map(plan => {
          const total = parseCents(totalFor(plan));
          const first = Math.round(total / 2);
          const second = total - first;
          const fullyPaid = plan.paid1 && plan.paid2;
          const canTrySave = total > 0 || plan.email.includes("@");
          return (
            <div key={plan.id} className="rounded-xl p-3.5"
              style={{
                background: fullyPaid ? "rgba(16,185,129,0.06)" : REV.panel,
                border: `1px solid ${fullyPaid ? "rgba(16,185,129,0.25)" : REV.panelBorder}`,
              }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a href={`/admin/conversation/${plan.id}`} className="block truncate text-sm font-black hover:underline" style={{ color: REV.text }}>{plan.name}</a>
                  <p className="truncate text-[11px] font-semibold" style={{ color: REV.textFaint }}>{plan.email}</p>
                  <p className="mt-1 truncate text-[9px] font-black uppercase tracking-widest" style={{ color: REV.textFaint }}>
                    {plan.sessionType || "Session"}{plan.sessionDate ? ` · ${new Date(`${plan.sessionDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
                  </p>
                </div>
                <span className="rounded-md px-2 py-1 text-[9px] font-black whitespace-nowrap"
                  style={fullyPaid
                    ? { background: REV.accentBg, color: REV.accent }
                    : plan.paid1
                      ? { background: REV.amberBg, color: REV.amber }
                      : { background: REV.neutralBg, color: REV.textSoft }}>
                  {fullyPaid ? "✓ Paid full" : plan.paid1 ? "Deposit 1 in" : "Unpaid"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className={LABEL} style={{ color: REV.textFaint }}>
                  Total
                  <input value={totalFor(plan)} onChange={event => setTotals(prev => ({ ...prev, [plan.id]: event.target.value }))}
                    inputMode="decimal" className={`${FIELD} tabular-nums`} style={fieldStyle} />
                </label>
                <label className={LABEL} style={{ color: REV.textFaint }}>
                  Method
                  <select value={methods[plan.id] ?? "manual"} onChange={event => setMethods(prev => ({ ...prev, [plan.id]: event.target.value }))}
                    className={FIELD} style={fieldStyle}>
                    {METHODS.map(method => <option key={method} value={method}>{method}</option>)}
                  </select>
                </label>
                <label className={`${LABEL} col-span-2 md:col-span-2`} style={{ color: REV.textFaint }}>
                  Paid date
                  <input type="date" value={paidDates[plan.id] ?? new Date().toISOString().slice(0, 10)}
                    onChange={event => setPaidDates(prev => ({ ...prev, [plan.id]: event.target.value }))}
                    className={FIELD} style={fieldStyle} />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold" style={{ color: REV.textFaint }}>
                  D1 {first ? displayCents(first) : "—"} {plan.paid1 ? "✓" : "open"} · D2 {second ? displayCents(second) : "—"} {plan.paid2 ? "✓" : "open"} · {plan.source}
                </span>
                <span className="ml-auto flex gap-1.5">
                  <button onClick={() => markPaid(plan, "deposit_1")} disabled={plan.paid1 || !canTrySave || busyKey !== null}
                    className="rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-opacity hover:opacity-80 disabled:opacity-35"
                    style={{ background: REV.violetBg, color: REV.violet }}>
                    {busyKey === `${plan.id}:deposit_1` ? "Saving…" : "Deposit 1 paid"}
                  </button>
                  <button onClick={() => markPaid(plan, "deposit_2")} disabled={plan.paid2 || !canTrySave || busyKey !== null}
                    className="rounded-lg px-2.5 py-1.5 text-[10px] font-black transition-opacity hover:opacity-80 disabled:opacity-35"
                    style={{ background: REV.blueBg, color: REV.blue }}>
                    {busyKey === `${plan.id}:deposit_2` ? "Saving…" : "Deposit 2 paid"}
                  </button>
                  <button onClick={() => markPaid(plan, "full")} disabled={fullyPaid || !canTrySave || busyKey !== null}
                    className="rounded-lg px-2.5 py-1.5 text-[10px] font-black text-white transition-opacity hover:opacity-80 disabled:opacity-35"
                    style={{ background: REV.accent }}>
                    {busyKey === `${plan.id}:full` ? "Saving…" : "Paid in full"}
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
