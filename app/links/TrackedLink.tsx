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

function sendAnalytics(path: string, payload: object) {
  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(path, blob);
    return;
  }

  fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Analytics should never block navigation.
  });
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
}: TrackedLinkProps) {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();

    sendAnalytics("/api/links/click", {
      linkId: id,
      userId: getUserId(),
    });

    window.location.assign(url);
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="link-card flex items-center gap-4 w-full rounded-2xl px-5 py-5"
      style={{
        animationDelay,
        background,
        border: `1.5px solid ${borderColor}`,
      }}
    >
      <div
        className="rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ width: 52, height: 52, minWidth: 52, minHeight: 52 }}
      >
        {emoji ?? "🔗"}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-black text-slate-900 text-base leading-tight">{label}</p>
        {description ? (
          <p className="text-sm text-slate-500 font-medium mt-0.5 leading-tight truncate">
            {description}
          </p>
        ) : null}
      </div>

      <div
        className="rounded-full flex items-center justify-center flex-shrink-0"
        style={{ width: 34, height: 34, minWidth: 34, background: "white", boxShadow: `0 2px 8px ${borderColor}`, color: "#9d6fe8" }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M2.5 6.5h8M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </a>
  );
}
