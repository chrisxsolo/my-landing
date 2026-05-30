"use client";

type TrackedLinkProps = {
  id: number;
  label: string;
  url: string;
  emoji: string | null;
  description: string | null;
  animationDelay: string;
  background: string;
  borderColor: string;
  accent?: string;
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
  background,
  borderColor,
  accent = "#9d6fe8",
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

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`link-card flex items-center gap-4 w-full px-5 ${featured ? "rounded-[2rem] py-6" : "rounded-[1.7rem] py-5"}`}
      style={{
        animationDelay,
        background,
        border: `1.5px solid ${borderColor}`,
        boxShadow: featured
          ? `0 22px 54px ${borderColor}`
          : undefined,
      }}
    >
      <div
        className={`flex items-center justify-center flex-shrink-0 ${featured ? "rounded-[1.35rem] text-[1.75rem]" : "rounded-xl text-2xl"}`}
        style={{
          width: featured ? 60 : 52,
          height: featured ? 60 : 52,
          minWidth: featured ? 60 : 52,
          minHeight: featured ? 60 : 52,
          background: featured ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.42)",
          boxShadow: featured ? `inset 0 1px 0 rgba(255,255,255,0.7)` : undefined,
        }}
      >
        {emoji ?? "🔗"}
      </div>

      <div className="flex-1 min-w-0">
        {eyebrow ? (
          <p
            className="mb-1 text-[11px] font-black uppercase tracking-[0.16em]"
            style={{ color: accent }}
          >
            {eyebrow}
          </p>
        ) : null}
        <p className={`font-black text-slate-900 leading-tight ${featured ? "text-[1.7rem]" : "text-base"}`}>
          {label}
        </p>
        {description ? (
          <p className={`font-medium mt-1 leading-tight text-slate-500 ${featured ? "text-[1rem] max-w-[24ch]" : "text-sm truncate"}`}>
            {description}
          </p>
        ) : null}
      </div>

      <div
        className={`rounded-full flex items-center justify-center flex-shrink-0 ${featured ? "translate-x-0" : ""}`}
        style={{
          width: featured ? 44 : 34,
          height: featured ? 44 : 34,
          minWidth: featured ? 44 : 34,
          background: "white",
          boxShadow: featured
            ? `0 10px 24px ${borderColor}`
            : `0 2px 8px ${borderColor}`,
          color: accent,
        }}
      >
        <svg width={featured ? "16" : "13"} height={featured ? "16" : "13"} viewBox="0 0 13 13" fill="none">
          <path d="M2.5 6.5h8M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </a>
  );
}
