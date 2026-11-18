"use client";
// Re-reads this conversation's inquiry when the tab becomes visible or focused
// again, or when another tab announces that a sync finished, so milestones
// stamped by Sync All elsewhere show up without a reload.
// See lib/inquiryRevalidation.ts for the dedupe and stale-response rules.

import { useEffect, useRef, useState } from "react";
import { loadAdminInquiry, type AdminInquiry } from "@/lib/adminInquiries";
import { createRevalidator, onTimelineSync, type Revalidator } from "@/lib/inquiryRevalidation";

const MIN_REFRESH_INTERVAL_MS = 5_000;

export function useInquiryRevalidation(
  inquiryId: number,
  onFresh: (fresh: AdminInquiry) => void,
) {
  const onFreshRef = useRef(onFresh);
  const revalidatorRef = useRef<Revalidator | null>(null);
  // Bumped after each applied refresh so dependents (the portal-session list)
  // re-read alongside the inquiry.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => { onFreshRef.current = onFresh; }, [onFresh]);

  useEffect(() => {
    if (!inquiryId) return;
    const revalidator = createRevalidator<AdminInquiry>({
      load: () => loadAdminInquiry(inquiryId),
      apply: (fresh) => {
        onFreshRef.current(fresh);
        setRefreshKey(key => key + 1);
      },
      minIntervalMs: MIN_REFRESH_INTERVAL_MS,
      onError: (error) => console.error("[conversation] progress refresh failed:", error),
    });
    revalidatorRef.current = revalidator;

    const onVisible = () => { if (document.visibilityState === "visible") void revalidator.trigger(); };
    const onFocus = () => { void revalidator.trigger(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    const stopListening = onTimelineSync(() => { void revalidator.trigger({ force: true }); });
    return () => {
      stopListening();
      revalidator.dispose();
      revalidatorRef.current = null;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [inquiryId]);

  return {
    refreshKey,
    noteLocalEdit: () => revalidatorRef.current?.noteLocalEdit(),
  };
}
