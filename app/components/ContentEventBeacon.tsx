"use client";
// Page-view beacon + delegated /contact CTA tracking (spec §10). Renders
// nothing. CTA clicks carry NO content target — they attribute to the page only.
// Every event also carries the anonymous visitor id so content views/clicks
// stitch into the same funnel journey as estimator and inquiry events.
import { useEffect } from "react";
import { getVisitorId } from "@/lib/analytics/visitor";

export interface BeaconTarget {
  type: string;
  id: string;
}

interface Props {
  contentType: "blog_post" | "school_page" | "guide_page" | "portfolio" | "page";
  contentId: string | null;
  target?: BeaconTarget | null;
}

function send(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ ...payload, anonymousSessionId: getVisitorId() });
    if (body.length > 1900) return; // stay under the route's 2KB cap
    navigator.sendBeacon("/api/track-event", new Blob([body], { type: "application/json" }));
  } catch { /* analytics must never break the page */ }
}

export default function ContentEventBeacon({ contentType, contentId, target = null }: Props) {
  useEffect(() => {
    send({
      event: "page_view",
      path: window.location.pathname,
      contentType,
      contentId,
      referrer: document.referrer,
      target,
    });

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a[href^='/contact']");
      if (!anchor) return;
      send({
        event: "cta_click",
        path: window.location.pathname,
        contentType,
        contentId,
        referrer: document.referrer,
        target: null, // CTA attribution is to the page, never a session (spec §10)
      });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
    // mount-once per page instance is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
