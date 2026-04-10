"use client";

import { useEffect } from "react";

function getUserId(): string {
  const key = "chris_hub_user_id";
  let userId = localStorage.getItem(key);

  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(key, userId);
  }

  return userId;
}

function sendPageView() {
  const body = JSON.stringify({ userId: getUserId() });

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/links/view", blob);
    return;
  }

  fetch("/api/links/view", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics should stay non-blocking.
  });
}

export default function LinksAnalytics() {
  useEffect(() => {
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => sendPageView());

      return () => window.cancelIdleCallback(id);
    }

    const timer = setTimeout(() => sendPageView(), 0);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
