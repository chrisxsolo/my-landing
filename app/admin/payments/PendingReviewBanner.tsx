"use client";
// Detected-but-unapproved payments live in payments_staging and are excluded
// from every revenue number. Without this banner a sync can find real money
// while the dashboard keeps reading $0.

import { formatReviewDollars, type PendingReviewSummary } from "@/lib/paymentSyncShared";
import { REV } from "./palette";

type Props = {
  summary: PendingReviewSummary;
  onReview: () => void;
};

export default function PendingReviewBanner({ summary, onReview }: Props) {
  if (summary.count === 0) return null;
  const plural = summary.count === 1 ? "" : "s";

  return (
    <div role="status"
      className="px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between gap-3 flex-wrap"
      style={{ background: REV.amberBg, color: REV.amber, border: `1px solid ${REV.panelBorderStrong}` }}>
      <span>
        {formatReviewDollars(summary.cents)} detected in {summary.count} payment{plural} awaiting approval —
        not counted in revenue yet. Confirm each one actually arrived before approving.
      </span>
      <button type="button" onClick={onReview}
        className="px-2.5 py-1 rounded-lg font-black hover:opacity-80"
        style={{ background: REV.inset, color: REV.text }}>
        Review {summary.count} →
      </button>
    </div>
  );
}
