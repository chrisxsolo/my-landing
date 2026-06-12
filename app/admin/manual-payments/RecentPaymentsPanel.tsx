"use client";
// Recent saved payments: a richer read of what just landed in the ledger —
// method-colored cards with type chips, plus a quick total of what's loaded.

import { useState } from "react";
import Link from "next/link";
import { GlassPanel, SectionHeader } from "@/app/admin/payments/Glass";
import { METHOD_META, REV } from "@/app/admin/payments/palette";
import { normalizePaymentMethod } from "@/lib/paymentFilters";
import { fmtMoney } from "@/lib/revenue/format";
import { displayMoney } from "./helpers";
import type { SavedPayment } from "./types";

const TYPE_LABELS: Record<string, string> = {
  deposit_1: "Deposit 1",
  deposit_2: "Deposit 2",
  full: "Full",
  other: "Other",
};

export default function RecentPaymentsPanel({ payments }: { payments: SavedPayment[] }) {
  const [limit, setLimit] = useState(18);
  const active = payments.filter(p => p.status === "active");
  const totalCents = active.reduce((s, p) => s + (p.amount_cents || 0), 0);

  return (
    <GlassPanel className="p-5">
      <SectionHeader kicker="Ledger" title="Recent saved payments"
        right={
          <span className="text-[10px] font-bold" style={{ color: REV.textFaint }}>
            {active.length} active · {fmtMoney(totalCents)} loaded
          </span>
        } />
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {payments.slice(0, limit).map(payment => {
          const meta = METHOD_META[normalizePaymentMethod(payment.method)] ?? METHOD_META.other;
          const voided = payment.status === "voided";
          return (
            <div key={payment.id} className="rounded-xl p-3 transition-transform hover:-translate-y-px"
              style={{
                background: REV.panel,
                border: `1px solid ${REV.panelBorder}`,
                borderLeft: `3px solid ${voided ? REV.red : meta.color}`,
                opacity: voided ? 0.55 : 1,
              }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {payment.inquiry_id ? (
                    <Link href={`/admin/conversation/${payment.inquiry_id}`}
                      className={`block truncate text-sm font-black hover:underline ${voided ? "line-through" : ""}`}
                      style={{ color: REV.text }}>
                      {payment.client_name}
                    </Link>
                  ) : (
                    <p className={`truncate text-sm font-black ${voided ? "line-through" : ""}`} style={{ color: REV.text }}>{payment.client_name}</p>
                  )}
                  <p className="truncate text-[11px] font-semibold" style={{ color: REV.textFaint }}>{payment.client_email || "No email"}</p>
                </div>
                <p className="shrink-0 text-sm font-black tabular-nums" style={{ color: voided ? REV.textFaint : REV.accent }}>
                  {displayMoney(payment.amount, payment.amount_cents)}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black" style={{ background: meta.bg, color: meta.color }}>
                  {meta.label}
                </span>
                <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black" style={{ background: REV.neutralBg, color: REV.textSoft }}>
                  {TYPE_LABELS[payment.payment_type] ?? payment.payment_type}
                </span>
                {voided && (
                  <span className="rounded-md px-1.5 py-0.5 text-[9px] font-black" style={{ background: REV.redBg, color: REV.red }}>voided</span>
                )}
                <span className="text-[10px] font-bold" style={{ color: REV.textFaint }}>
                  {payment.paid_at
                    ? new Date(payment.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "No date"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {payments.length > limit && (
        <button type="button" onClick={() => setLimit(l => l + 18)}
          className="mt-3 w-full rounded-xl py-2 text-[10px] font-black"
          style={{ background: REV.neutralBg, color: REV.textSoft }}>
          Show {Math.min(18, payments.length - limit)} more of {payments.length - limit} remaining
        </button>
      )}
    </GlassPanel>
  );
}
