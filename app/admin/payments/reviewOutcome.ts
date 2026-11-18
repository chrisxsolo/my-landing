// Turns the review-queue API's answer into one honest sentence. An approval
// can put the payment in the ledger and still fail to update the booking; that
// must never read as plain success.

import type { UnprojectedPayment } from "@/lib/paymentProjectionRepair";

export type { UnprojectedPayment };

export type ReviewResponse = {
  ok?: boolean;
  error?: string;
  held?: { id: number; matches: number[] }[];
  incomplete?: { id: number; paymentId: number | null; failed: string[] }[];
  failed?: number[];
  portalAmbiguous?: number[];
};

const STEP_LABELS: Record<string, string> = {
  inquiry: "booking status",
  availability: "calendar",
  portal: "client portal",
};
const STAGING_STEP = "staging";

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Empty string when everything landed. */
export function describeReviewOutcome(json: ReviewResponse): string {
  const parts: string[] = [];
  if (json.held?.length) {
    parts.push(
      `${plural(json.held.length, "payment")} held back: already in the ledger as ` +
      `${json.held.map(h => h.matches.map(m => `#${m}`).join("/")).join(", ")}. ` +
      "Approve individually only if they are separate transfers.",
    );
  }
  if (json.failed?.length) {
    parts.push(`${plural(json.failed.length, "payment")} could not be saved and ${json.failed.length === 1 ? "is" : "are"} still waiting. Try again.`);
  }
  const bookingGaps = (json.incomplete ?? []).filter(i => i.failed.some(step => step !== STAGING_STEP));
  if (bookingGaps.length) {
    const steps = [...new Set(bookingGaps.flatMap(i => i.failed))].filter(s => s !== STAGING_STEP).map(s => STEP_LABELS[s] ?? s);
    parts.push(
      `${plural(bookingGaps.length, "payment")} saved to the ledger, but the ${steps.join(", ")} update failed. ` +
      "Nothing was counted twice. Use Update booking to finish.",
    );
  }
  const stillListed = (json.incomplete ?? []).filter(i => i.failed.includes(STAGING_STEP));
  if (stillListed.length) {
    parts.push(
      `${plural(stillListed.length, "payment")} saved to the ledger but still listed here. ` +
      "Approve again to clear it; it will not be counted twice.",
    );
  }
  if (json.portalAmbiguous?.length) {
    parts.push(
      `${plural(json.portalAmbiguous.length, "client")} has several portal sessions and none matched this payment, ` +
      "so the portal stage was left alone. Set it by hand on the Clients tab.",
    );
  }
  return parts.join(" ");
}

/** Ledger payment ids whose booking updates (not just the queue marker) still need finishing. */
export function bookingRepairIds(json: ReviewResponse): number[] {
  return (json.incomplete ?? [])
    .filter(i => i.paymentId !== null && i.failed.some(step => step !== STAGING_STEP))
    .map(i => i.paymentId as number);
}
