"use client";
import { useState } from "react";
import { C } from "@/lib/colors";
import type { PaymentRow, SavedPayment } from "./types";

type Props = {
  row: PaymentRow;
  payments: SavedPayment[];
  onSaved: (payments: SavedPayment[], message: string) => void;
  onError: (message: string) => void;
  onVoided: (inquiryId: number) => void;
};

export default function RowActions({ row, payments, onSaved, onError, onVoided }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  if (!row.inquiry_id) return null;

  const related = payments.filter(p =>
    p.status === "active" &&
    (p.inquiry_id === row.inquiry_id ||
      (p.client_email && p.client_email.toLowerCase() === row.client_email.toLowerCase()))
  );
  const paid1 = related.some(p => p.payment_type === "deposit_1" || p.payment_type === "full");
  const paid2 = related.some(p => p.payment_type === "deposit_2" || p.payment_type === "full");
  const isBusy = busy !== null;

  async function markPaid(type: "deposit_1" | "deposit_2" | "full") {
    setBusy(type);
    try {
      const res = await fetch("/api/admin/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark-payment-state",
          inquiry_id: row.inquiry_id,
          client_name: row.client_name,
          client_email: row.client_email,
          total_amount: row.amount || "",
          method: row.method,
          paid_at: row.paid_at,
          paid: type,
        }),
      });
      const json = await res.json() as { saved?: SavedPayment[]; skipped?: boolean; error?: string };
      if (!res.ok) { onError(json.error ?? "Could not update payment."); return; }
      onSaved(json.saved ?? [], json.skipped ? "Already recorded." : `${row.client_name} updated.`);
    } catch {
      onError("Could not update payment.");
    } finally {
      setBusy(null);
    }
  }

  async function voidPayments() {
    setBusy("void");
    try {
      const res = await fetch("/api/admin/manual-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void-client-payments", inquiry_id: row.inquiry_id }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { onError(json.error ?? "Could not clear payments."); return; }
      onVoided(row.inquiry_id!);
    } catch {
      onError("Could not clear payments.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-1 px-1.5 py-1.5">
      <div className="flex gap-1">
        <button
          onClick={() => markPaid("deposit_1")}
          disabled={paid1 || isBusy}
          className="flex-1 rounded px-1 py-1 text-[9px] font-black disabled:opacity-40"
          style={{ background: paid1 ? C.p1_12 : C.p1_08, color: C.p1 }}
        >
          {busy === "deposit_1" ? "…" : paid1 ? "D1 ✓" : "D1"}
        </button>
        <button
          onClick={() => markPaid("deposit_2")}
          disabled={paid2 || isBusy}
          className="flex-1 rounded px-1 py-1 text-[9px] font-black disabled:opacity-40"
          style={{ background: paid2 ? C.p2_12 : C.p2_08, color: C.p2 }}
        >
          {busy === "deposit_2" ? "…" : paid2 ? "D2 ✓" : "D2"}
        </button>
        <button
          onClick={() => markPaid("full")}
          disabled={(paid1 && paid2) || isBusy}
          className="flex-1 rounded px-1 py-1 text-[9px] font-black text-white disabled:opacity-40"
          style={{ background: C.grad12 }}
        >
          {busy === "full" ? "…" : "Full"}
        </button>
      </div>
      {(paid1 || paid2) && (
        <button
          onClick={voidPayments}
          disabled={isBusy}
          className="w-full rounded px-1 py-0.5 text-[9px] font-black disabled:opacity-40"
          style={{ background: C.p3_10, color: C.danger }}
        >
          {busy === "void" ? "Clearing…" : "Clear payments"}
        </button>
      )}
    </div>
  );
}
