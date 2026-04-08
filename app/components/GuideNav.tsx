"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { C } from "@/lib/colors";

// ─────────────────────────────────────────────────────────────────────────────
// GUIDE NAV CONFIG — edit this array to add, remove, or reorder nav tabs.
// Changes here update every guide page automatically.
//
// Each item:
//   href  — the route this tab links to
//   label — short label shown under the icon (keep under 8 chars)
//   emoji — icon shown above the label
//   match — optional: array of paths that should also highlight this tab
//            (useful if a tab covers multiple sub-routes)
// ─────────────────────────────────────────────────────────────────────────────
const NAV_ITEMS: {
  href: string;
  label: string;
  emoji: string;
  match?: string[];
}[] = [
  {
    href:  "/grad-guide",
    label: "Guide",
    emoji: "🎓",
    match: ["/grad-guide"],
  },
  {
    href:  "/grad-guide/posing",
    label: "Posing",
    emoji: "📸",
  },
  {
    href:  "/grad-guide/what-to-wear",
    label: "Outfits",
    emoji: "👗",
  },
  {
    href:  "/grad-guide/how-to-prepare",
    label: "Prep",
    emoji: "✅",
  },
  {
    href:  "/location-guide",
    label: "Locations",
    emoji: "📍",
  },
  {
    href:  "/booking-process",
    label: "Process",
    emoji: "📋",
  },
  {
    href:  "/availability",
    label: "Dates",
    emoji: "📅",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component — no edits needed below this line
// ─────────────────────────────────────────────────────────────────────────────
export default function GuideNav() {
  const path = usePathname();

  function isActive(item: typeof NAV_ITEMS[0]) {
    if (path === item.href) return true;
    if (item.match) return item.match.some(m => path === m || path.startsWith(m + "/"));
    return false;
  }

  return (
    <>
      {/* Spacer so page content isn't hidden behind the fixed bar */}
      <div style={{ height: "72px" }} />

      {/* Fixed bottom nav */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{
          background: "rgba(255,255,255,0.93)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(0,0,0,0.07)",
          boxShadow: "0 -4px 24px rgba(0,0,0,0.06)",
        }}
      >
        <div
          className="mx-auto px-2 py-2"
          style={{ maxWidth: "768px" }}
        >
          <div className="flex items-center justify-around gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl flex-1 transition-all duration-200"
                  style={{
                    background: active
                      ? `linear-gradient(135deg,${C.p1_12},${C.p2_08})`
                      : "transparent",
                    border: active
                      ? `1px solid ${C.p1_20}`
                      : "1px solid transparent",
                  }}
                >
                  <span className="text-lg leading-none">{item.emoji}</span>
                  <span
                    className="text-[10px] font-bold tracking-wide leading-none"
                    style={{ color: active ? C.p1 : "#94a3b8" }}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}