"use client";

import { C } from "@/lib/colors";
import LinkIcon, { iconForEmoji } from "./LinkIcon";

type TrackedLinkProps = {
  id: number;
  label: string;
  url: string;
  emoji: string | null;
  description: string | null;
  animationDelay: string;
  eyebrow?: string;
  featured?: boolean;
};

function getUserId(): string {
  const key = "chris_hub_user_id";
  let userId = localStorage.getItem(key);

  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(key, userId);
  }

  return userId;
}

function categorizeReferrer(ref: string): string {
  if (!ref) return "direct";
  if (ref.includes("instagram")) return "instagram";
  if (ref.includes("tiktok")) return "tiktok";
  if (ref.includes("google")) return "google";
  if (ref.includes("twitter") || ref.includes("t.co") || ref.includes("x.com")) return "twitter";
  if (ref.includes("facebook") || ref.includes("fb.com")) return "facebook";
  if (ref.includes("youtube") || ref.includes("youtu.be")) return "youtube";
  return "other";
}

function detectDevice(): "mobile" | "tablet" | "desktop" {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/iPhone|Android.*Mobile|Mobile/i.test(ua)) return "mobile";
  return "desktop";
}

function sendAnalytics(path: string, payload: object) {
  const body = JSON.stringify(payload);
  if ("sendBeacon" in navigator) {
    navigator.sendBeacon(path, new Blob([body], { type: "application/json" }));
    return;
  }
  fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}

export default function TrackedLink({
  id,
  label,
  url,
  emoji,
  description,
  animationDelay,
  eyebrow,
  featured = false,
}: TrackedLinkProps) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();

    sendAnalytics("/api/links/click", {
      linkId: id,
      userId: getUserId(),
      referrer: categorizeReferrer(document.referrer),
      device: detectDevice(),
    });

    window.open(url, "_blank", "noopener,noreferrer");
  }

  const tile = featured ? 56 : 48;
  const arrow = featured ? 42 : 34;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`link-card flex items-center gap-4 w-full px-5 ${featured ? "rounded-3xl py-6" : "rounded-2xl py-[1.125rem]"}`}
      style={{
        animationDelay,
        background: featured ? C.pageAlt : C.white,
        border: `1px solid ${featured ? C.clayBorder : C.warmEdge}`,
        boxShadow: featured ? C.shadowWarm : undefined,
      }}
    >
      <div
        className={`flex items-center justify-center flex-shrink-0 ${featured ? "rounded-2xl" : "rounded-xl"}`}
        style={{
          width: tile,
          height: tile,
          background: featured ? C.white : C.pageAlt,
          border: `1px solid ${C.warmEdge}`,
          color: C.clay,
        }}
      >
        <LinkIcon name={iconForEmoji(emoji)} size={featured ? 26 : 22} />
      </div>

      <div className="flex-1 min-w-0">
        {eyebrow ? (
          <p
            className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: C.clay }}
          >
            {eyebrow}
          </p>
        ) : null}
        <p
          className={`font-bold leading-tight tracking-tight ${featured ? "text-[1.6rem]" : "text-base"}`}
          style={{ color: C.warmInk }}
        >
          {label}
        </p>
        {description ? (
          <p
            className={`mt-1 leading-tight ${featured ? "text-[1rem] max-w-[24ch]" : "text-sm truncate"}`}
            style={{ color: C.warmBody }}
          >
            {description}
          </p>
        ) : null}
      </div>

      <div
        className="link-arrow rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          width: arrow,
          height: arrow,
          background: featured ? C.clay : "transparent",
          border: `1px solid ${featured ? C.clay : C.warmEdge}`,
          color: featured ? C.white : C.clay,
        }}
      >
        <svg width={featured ? "15" : "13"} height={featured ? "15" : "13"} viewBox="0 0 13 13" fill="none" aria-hidden="true">
          <path d="M2.5 6.5h8M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </a>
  );
}
