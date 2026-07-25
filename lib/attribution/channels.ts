// Source/channel classification for attribution.
//
// Two paths, mirroring the two confidence tiers:
//   classifyChannel  — for TRACKED inquiries: real first-party signal
//                      (UTM source first, then the captured referrer hostname).
//   inferSource      — for inquiries with no session: the legacy message-text
//                      guess, kept ONLY as a clearly-labeled fallback.

import type { VisitorSessionRow } from "./types";

export interface Channel {
  key: string;
  label: string;
}

function titleCase(s: string): string {
  return s.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const SOURCE_ALIASES: Record<string, string> = {
  ig: "instagram",
  insta: "instagram",
  fb: "facebook",
};

// Referrer hostnames are stored normalized (hostname or "direct").
const REFERRER_RULES: { re: RegExp; channel: Channel }[] = [
  { re: /instagram/, channel: { key: "instagram", label: "Instagram" } },
  { re: /google/, channel: { key: "google", label: "Google" } },
  { re: /(bing|duckduckgo|yahoo|ecosia)/, channel: { key: "search", label: "Other search" } },
  { re: /tiktok/, channel: { key: "tiktok", label: "TikTok" } },
  { re: /(facebook|fb\.com|fb\.me)/, channel: { key: "facebook", label: "Facebook" } },
  { re: /linktr/, channel: { key: "linktree", label: "Linktree" } },
  { re: /pinterest/, channel: { key: "pinterest", label: "Pinterest" } },
  { re: /yelp/, channel: { key: "yelp", label: "Yelp" } },
];

export function classifyChannel(s: VisitorSessionRow): Channel {
  const src = (s.utm_source ?? "").trim().toLowerCase();
  if (src) {
    const key = SOURCE_ALIASES[src] ?? src;
    return { key, label: titleCase(key) };
  }
  const ref = (s.first_referrer || s.latest_referrer || "").toLowerCase();
  if (!ref || ref === "direct") return { key: "direct", label: "Direct" };
  for (const rule of REFERRER_RULES) {
    if (rule.re.test(ref)) return rule.channel;
  }
  const host = ref.replace(/^www\./, "");
  return { key: host, label: host };
}

// True when a tracked session looks like Instagram traffic — for the
// "revenue per Instagram campaign" breakdown.
export function isInstagramSource(s: VisitorSessionRow): boolean {
  const src = (s.utm_source ?? "").toLowerCase();
  if (src === "ig" || src === "insta" || /instagram/.test(src)) return true;
  return /instagram/.test((s.first_referrer || s.latest_referrer || "").toLowerCase());
}

// Legacy message-text source guess. Returns a labeled channel or null when the
// text gives no signal (the inquiry then falls to the "unattributed" bucket).
const MESSAGE_RULES: { re: RegExp; channel: Channel }[] = [
  // "@" must look like a handle mention, not an email address ("jane@gmail.com"),
  // and "ig" needs both boundaries so "big"/"gig" don't read as Instagram.
  { re: /instagram|(?<![\w.])@[a-z0-9_.]{2,}|\big\b|\binsta\b|your (post|reel|story|page)/i, channel: { key: "instagram", label: "Instagram" } },
  { re: /google|searched/i, channel: { key: "google", label: "Google" } },
  { re: /referr|recommend|friend|told me|word of mouth|my (sister|brother|mom|dad|cousin|roommate|classmate)/i, channel: { key: "referral", label: "Referral" } },
  { re: /tiktok/i, channel: { key: "tiktok", label: "TikTok" } },
  { re: /linktree|link in bio/i, channel: { key: "linktree", label: "Linktree" } },
];

export function inferSource(message: string): Channel | null {
  for (const rule of MESSAGE_RULES) {
    if (rule.re.test(message)) return rule.channel;
  }
  return null;
}
