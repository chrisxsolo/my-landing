"use client";
// Revenue tab entry point — the dashboard itself lives in
// app/admin/payments/RevenueDashboard.tsx.

import RevenueDashboard from "./payments/RevenueDashboard";

type Props = {
  /** Bumped by "Payment awaiting review" on the Clients tab: opens on the review queue. */
  focusReviewToken?: number;
  /** Called once the dashboard has scrolled to the queue, so the request is not replayed. */
  onReviewFocused?: () => void;
};

export default function PaymentAnalyticsTab({ focusReviewToken = 0, onReviewFocused }: Props) {
  return <RevenueDashboard focusReviewToken={focusReviewToken} onReviewFocused={onReviewFocused} />;
}
