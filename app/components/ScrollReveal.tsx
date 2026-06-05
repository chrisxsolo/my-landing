// ─────────────────────────────────────────────────────────────────────────────
// ScrollReveal — adds IntersectionObserver scroll-triggered animations
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE:
//   1. This component is already added to the professional layout — no setup needed.
//   2. Add data-reveal to any element you want to animate in on scroll:
//        <div data-reveal>...</div>
//   3. Add data-delay="1" through "5" to stagger sibling elements:
//        <div data-reveal data-delay="1">First</div>
//        <div data-reveal data-delay="2">Second</div>
//        <div data-reveal data-delay="3">Third</div>
//   4. Use variants for different animation directions:
//        data-reveal          → fades up (default)
//        data-reveal="left"   → slides in from left
//        data-reveal="scale"  → scales up
//
// HOW IT WORKS:
//   - Adds "js-scroll-reveal" class to <html> so CSS can hide elements safely
//     (elements stay visible if JS is disabled or slow — no flash of invisible content)
//   - Each [data-reveal] element gets watched; when it enters the viewport,
//     data-visible="true" is set, triggering the CSS transition
//   - Each element is unobserved after it becomes visible (fires once only)
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect } from "react";

export default function ScrollReveal() {
  useEffect(() => {
    // Respect the user's reduced-motion preference: skip the reveal entirely so
    // elements render in their final, visible state (CSS also guards this).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Add class to <html> — this activates the reveal CSS (safe progressive enhancement)
    document.documentElement.classList.add("js-scroll-reveal");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "true");
            observer.unobserve(entry.target); // only animate once
          }
        });
      },
      {
        threshold: 0.08,
        // rootMargin: slightly negative bottom margin so elements animate
        // just as they enter the viewport, not when barely peeking in
        rootMargin: "0px 0px -48px 0px",
      }
    );

    // Observe all reveal elements present at mount
    document.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));

    // Also observe any that might be added dynamically (e.g. after client fetches)
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.hasAttribute("data-reveal")) observer.observe(node);
            node.querySelectorAll("[data-reveal]").forEach((el) => observer.observe(el));
          }
        });
      });
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
}
