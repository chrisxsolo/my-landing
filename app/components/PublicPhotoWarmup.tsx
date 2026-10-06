"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { schedulePhotoWarmup } from "@/lib/photoWarmup";
import { getPublicPhotoHref, warmPublicPage } from "@/lib/publicPhotoWarmup";

function createPageQueue() {
  const queue: string[] = [];
  const queued = new Set<string>();
  let running = false;
  let stopped = false;
  const drain = async () => {
    if (running) return;
    running = true;
    while (!stopped && queue.length) await warmPublicPage(queue.shift()!);
    running = false;
  };
  return {
    add(href: string) {
      if (stopped || queued.has(href)) return;
      queued.add(href);
      queue.push(href);
      void drain();
    },
    stop() { stopped = true; queue.length = 0; },
  };
}

function observePublicLinks(enqueue: (href: string) => void) {
  const observer = new IntersectionObserver((entries) => {
    entries.filter((entry) => entry.isIntersecting).forEach((entry) => {
      const href = getPublicPhotoHref((entry.target as HTMLAnchorElement).href, window.location.href);
      if (href) enqueue(href);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "200px" });
  const seen = new WeakSet<HTMLAnchorElement>();
  const discover = () => document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    if (seen.has(link)) return;
    seen.add(link);
    if (getPublicPhotoHref(link.href, window.location.href)) observer.observe(link);
  });
  discover();
  const mutations = new MutationObserver(discover);
  mutations.observe(document.body, { childList: true, subtree: true });
  return () => { observer.disconnect(); mutations.disconnect(); };
}

export default function PublicPhotoWarmup() {
  const pathname = usePathname();
  useEffect(() => {
    const queue = createPageQueue();
    let stopObserving = () => {};
    const cancel = schedulePhotoWarmup(() => { stopObserving = observePublicLinks(queue.add); });
    const onIntent = (event: Event) => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      const href = link && getPublicPhotoHref(link.href, window.location.href);
      if (href) void warmPublicPage(href);
    };
    const events = ["pointerover", "focusin", "touchstart"] as const;
    events.forEach((event) => document.addEventListener(event, onIntent, { passive: true }));
    return () => {
      cancel(); stopObserving(); queue.stop();
      events.forEach((event) => document.removeEventListener(event, onIntent));
    };
  }, [pathname]);
  return null;
}
