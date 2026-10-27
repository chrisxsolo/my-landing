"use client";
// Loads the review queue's server findings (excluded-but-live photos,
// sessions and places needing review) and keeps them in step with the
// tagging audit: refresh() runs after every change the queue makes.
import { useCallback, useEffect, useState } from "react";
import type { ReviewFindings } from "@/lib/reviewQueue/findingItems";
import { reviewQueueApi } from "./reviewQueueApi";

export interface ReviewFindingsState {
  findings: ReviewFindings | null;
  error: string | null;
  refresh: () => Promise<void>;
}

const EMPTY: ReviewFindings = { excludedLive: [], sessions: [], proposedPlaces: [], errors: [] };

type Loaded = { findings: ReviewFindings; error: null } | { findings: null; error: string };

/** One fetch, with the failure as a value (so callers decide what to show). */
async function load(sessionId?: string): Promise<Loaded> {
  try {
    return { findings: await reviewQueueApi.findings(sessionId), error: null };
  } catch (err) {
    console.error("[review-queue] findings failed", err);
    return { findings: null, error: err instanceof Error ? err.message : "could not load the review findings" };
  }
}

export function useReviewFindings(sessionId?: string): ReviewFindingsState {
  const [findings, setFindings] = useState<ReviewFindings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const take = useCallback((r: Loaded) => {
    setError(r.error);
    setFindings((prev) => r.findings ?? prev ?? EMPTY);
  }, []);
  const refresh = useCallback(async () => take(await load(sessionId)), [sessionId, take]);

  const loaded = findings !== null;
  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    void load(sessionId).then((r) => { if (!cancelled) take(r); });
    return () => { cancelled = true; };
  }, [loaded, sessionId, take]);

  return { findings, error, refresh };
}
