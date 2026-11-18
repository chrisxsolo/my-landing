// Browser-side call to /api/check-payment, shared by the conversation page and
// the Clients tab so both describe the result the same way. A failed analysis
// is never presented as "the client hasn't paid".

export type PaymentCheckTarget = { id: number; email: string; name: string; session_date?: string | null };

export type PaymentCheckToast = { text: string; ok: boolean };

export type PaymentCheckResult = {
  /** False when the check itself broke; nothing was changed. */
  ok: boolean;
  paid: boolean;
  toasts: PaymentCheckToast[];
};

type CheckPaymentResponse = {
  paid?: boolean; note?: string; session_date_booked?: boolean;
  ledger?: string; warning?: string; error?: string;
};

const FAILED: PaymentCheckResult = {
  ok: false, paid: false,
  toasts: [{ text: "Payment check failed. No payment status was changed.", ok: false }],
};

const LEDGER_TOASTS: Record<string, PaymentCheckToast> = {
  recorded: { text: "Recorded in revenue and the booking was updated", ok: true },
  staged: { text: "Not added to revenue automatically — it may already be on file. Check it in Payments → review", ok: false },
};

export function describePaymentCheck(json: CheckPaymentResponse): PaymentCheckResult {
  if (!json.paid) {
    return { ok: true, paid: false, toasts: [{ text: json.note || "No payment evidence found", ok: false }] };
  }
  const toasts: PaymentCheckToast[] = [{ text: `Payment confirmed — ${json.note ?? ""}`.replace(/ — $/, ""), ok: true }];
  if (json.session_date_booked) toasts.push({ text: "Calendar marked as booked", ok: true });
  const ledgerToast = json.ledger ? LEDGER_TOASTS[json.ledger] : undefined;
  if (ledgerToast) toasts.push(ledgerToast);
  if (json.warning) toasts.push({ text: json.warning, ok: false });
  return { ok: true, paid: true, toasts };
}

export async function requestPaymentCheck(target: PaymentCheckTarget): Promise<PaymentCheckResult> {
  try {
    const res = await fetch("/api/check-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inquiry_id: target.id,
        email: target.email,
        name: target.name,
        session_date: target.session_date || undefined,
      }),
    });
    const json = await res.json().catch(() => ({})) as CheckPaymentResponse;
    if (!res.ok) {
      console.error("[check-payment] analysis failed:", json.error);
      return FAILED;
    }
    return describePaymentCheck(json);
  } catch (error) {
    console.error("[check-payment] request error:", error);
    return FAILED;
  }
}
