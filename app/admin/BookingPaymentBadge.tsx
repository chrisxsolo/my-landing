"use client";
// Payment badge for one booking on the Clients tab. Reads the shared
// resolver's state so the badge, the filters and the Deposit paid milestone
// agree. An unpaid booking can be checked on the spot; a detection that could
// not be confirmed automatically gets its own review action and is never
// shown as paid.

import { T } from "@/app/admin/adminTheme";
import { BOOKING_PAYMENT_REVIEW_LABELS, type BookingPaymentState } from "@/lib/bookingPaymentState";

type Props = {
  state: BookingPaymentState;
  clientName: string;
  onReview: () => void;
  /** Checks this one client's payment and records it if found. */
  onCheck: () => void;
  checking: boolean;
  /** Another client's check is running; one at a time. */
  checkDisabled: boolean;
};

export default function BookingPaymentBadge({ state, clientName, onReview, onCheck, checking, checkDisabled }: Props) {
  return (
    <>
      {!state.paid && (
        <button type="button"
          onClick={e => { e.stopPropagation(); onCheck(); }}
          disabled={checking || checkDisabled}
          aria-busy={checking}
          aria-label={checking ? `Checking payment for ${clientName}` : `Check payment for ${clientName}`}
          title="Looks for this client's payment and, if found, records it and updates the booking"
          className="text-[10px] font-bold px-2.5 py-1 min-h-6 rounded-full hover:opacity-80 disabled:opacity-50 focus-visible:outline focus-visible:outline-2"
          style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}`, outlineColor: T.green }}>
          {checking ? "Checking…" : "Check payment"}
        </button>
      )}
      {state.review && (
        <button type="button"
          onClick={e => { e.stopPropagation(); onReview(); }}
          aria-label={`${BOOKING_PAYMENT_REVIEW_LABELS[state.review]} for ${clientName}. Open the payment review queue.`}
          title={state.review === "awaiting"
            ? "A payment was detected for this booking but could not be recorded automatically (unclear match or possible duplicate)."
            : "This payment is in the ledger, but the booking was not updated. Finish it in the review queue."}
          className="text-[10px] font-bold px-2.5 py-1 min-h-6 rounded-full hover:opacity-80 focus-visible:outline focus-visible:outline-2"
          style={{ background: T.amberBg, color: T.amber, border: `1px solid ${T.amberBorder}`, outlineColor: T.amber }}>
          {BOOKING_PAYMENT_REVIEW_LABELS[state.review]} →
        </button>
      )}
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
        style={state.paid ? { background: T.greenBg, color: T.green } : { background: T.neutralBg, color: T.inkFaint }}>
        {state.label}
      </span>
    </>
  );
}
