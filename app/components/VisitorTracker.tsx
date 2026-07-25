"use client";
// Global first-party visitor layer, mounted once in the public layout. On every
// route it (1) ensures the persistent visitor id and refreshes the visitor
// session (landing page / referrer / UTM, first-touch preserved server-side),
// and (2) emits page_view + /contact CTA clicks — but ONLY on routes that do
// NOT already self-report via ContentEventBeacon, so views are never counted
// twice. Renders nothing.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { captureVisitor, trackEvent } from "@/lib/analytics/visitor";

// Routes where ContentEventBeacon already emits an (attributed) page_view +
// CTA listener. On these, VisitorTracker stays silent except for the session
// touch, to avoid double-counting.
const BEACON_COVERED: RegExp[] = [
  /^\/portfolio$/,
  /^\/blog\/(?!category$)[a-z0-9-]+$/,
  /^\/grads\/[a-z0-9-]+$/,
  /^\/family-guide\/locations\/[a-z0-9-]+$/,
  /^\/couples-guide\/locations\/[a-z0-9-]+$/,
  /^\/portrait-guide\/locations\/[a-z0-9-]+$/,
];

export default function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    captureVisitor();

    if (BEACON_COVERED.some((re) => re.test(pathname))) return;

    trackEvent({ event: "page_view" });

    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as Element | null)?.closest?.("a[href^='/contact']");
      if (!anchor) return;
      trackEvent({ event: "cta_click" });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pathname]);

  return null;
}
