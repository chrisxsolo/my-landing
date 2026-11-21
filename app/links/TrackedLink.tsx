"use client";

import type { CSSProperties } from "react";
import LinkIcon, { iconForEmoji } from "./LinkIcon";
import styles from "./linkCards.module.css";
import pageStyles from "./links.module.css";

export type LinkCardVariant = "primary" | "tile" | "tileWide";

type TrackedLinkProps = {
  id: number;
  label: string;
  url: string;
  emoji: string | null;
  description: string | null;
  eyebrow?: string;
  variant: LinkCardVariant;
  /** Place in the entrance sequence. */
  order: number;
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

function Arrow({ diagonal }: { diagonal: boolean }) {
  return (
    <span className={styles.arrow}>
      <svg width="14" height="14" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path
          d={diagonal ? "M3.5 9.5l6-6M4.5 3.5h5v5" : "M2.5 6.5h8M6.5 2.5l4 4-4 4"}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function TrackedLink({
  id,
  label,
  url,
  emoji,
  description,
  eyebrow,
  variant,
  order,
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

  const isPrimary = variant === "primary";
  const icon = (
    <span className={styles.iconBox}>
      <LinkIcon name={iconForEmoji(emoji)} size={isPrimary ? 26 : 20} />
    </span>
  );
  const text = (
    <span className="block min-w-0 flex-1">
      {eyebrow ? <span className={`block ${pageStyles.eyebrow}`}>{eyebrow}</span> : null}
      <span className={`block ${styles.label}`}>{label}</span>
      {description ? <span className={`block ${styles.description}`}>{description}</span> : null}
    </span>
  );
  const variantClass = isPrimary
    ? styles.primary
    : `${styles.tile} ${variant === "tileWide" ? styles.tileWide : ""}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`${styles.card} ${variantClass}`}
      style={{ "--i": order } as CSSProperties}
    >
      {isPrimary ? (
        <>
          {icon}
          {text}
          <Arrow diagonal={false} />
        </>
      ) : (
        <>
          <span className={styles.tileTop}>
            {icon}
            <Arrow diagonal />
          </span>
          {text}
        </>
      )}
    </a>
  );
}
