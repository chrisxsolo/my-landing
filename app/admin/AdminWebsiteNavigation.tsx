"use client";

import { useState } from "react";
import { T } from "@/app/admin/adminTheme";

export const WEBSITE_NAV_GROUPS = [
  {
    id: "guides",
    label: "Guides",
    items: [
      { tab: "poses", icon: "📸", label: "Grad Poses" },
      { tab: "couplesGuide", icon: "💞", label: "Couples Posing Guide" },
      { tab: "couplesLocations", icon: "💑", label: "Couples Locations" },
      { tab: "locations", icon: "📍", label: "Campus Spots" },
      { tab: "bayGuide", icon: "🗺️", label: "Bay Guide" },
      { tab: "familyGuide", icon: "👨‍👩‍👧", label: "Family Guide" },
    ],
  },
  {
    id: "showcase",
    label: "Showcase",
    items: [
      { tab: "portfolio", icon: "🖼️", label: "Portfolio" },
      { tab: "caseStudies", icon: "📖", label: "Case Studies" },
      { tab: "categories", icon: "🏷️", label: "Categories" },
    ],
  },
  {
    id: "publishing",
    label: "Publishing",
    items: [
      { tab: "blog", icon: "✍️", label: "Blog" },
      { tab: "library", icon: "🗄️", label: "Image Library" },
    ],
  },
  {
    id: "site-setup",
    label: "Site Setup",
    items: [
      { tab: "navigation", icon: "🧭", label: "Navigation" },
      { tab: "aboutPage", icon: "🙋", label: "About Page" },
    ],
  },
] as const;

export type WebsiteGroupId = (typeof WEBSITE_NAV_GROUPS)[number]["id"];
export type WebsiteTab = (typeof WEBSITE_NAV_GROUPS)[number]["items"][number]["tab"];

export function getWebsiteGroupId(tab: string): WebsiteGroupId | null {
  return WEBSITE_NAV_GROUPS.find((group) =>
    group.items.some((item) => item.tab === tab),
  )?.id ?? null;
}

type AdminWebsiteNavigationProps = {
  activeTab: string;
  onNavigate: (tab: WebsiteTab) => void;
};

export default function AdminWebsiteNavigation({
  activeTab,
  onNavigate,
}: AdminWebsiteNavigationProps) {
  const activeGroup = getWebsiteGroupId(activeTab);
  const [openGroup, setOpenGroup] = useState<WebsiteGroupId | null>(activeGroup);

  return (
    <div className="space-y-0.5">
      {WEBSITE_NAV_GROUPS.map((group) => {
        const isOpen = openGroup === group.id;
        const panelId = `admin-website-${group.id}`;

        return (
          <div key={group.id}>
            <button
              type="button"
              data-testid={`website-group-${group.id}`}
              aria-controls={panelId}
              aria-expanded={isOpen}
              onClick={() => setOpenGroup(isOpen ? null : group.id)}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-[7px] text-left text-[12px] font-bold transition-colors"
              style={{ color: isOpen ? T.ink : T.inkSoft, background: isOpen ? T.inset : "transparent" }}
            >
              <span className="text-[10px]" style={{ color: T.inkFaint }}>{isOpen ? "▾" : "▸"}</span>
              <span>{group.label}</span>
              <span className="ml-auto text-[9px] tabular-nums" style={{ color: T.inkFaint }}>{group.items.length}</span>
            </button>

            {isOpen && (
              <div id={panelId} className="mt-0.5 space-y-0.5 pl-2">
                {group.items.map((item) => {
                  const isActive = activeTab === item.tab;

                  return (
                    <button
                      key={item.tab}
                      type="button"
                      data-testid={`website-tab-${item.tab}`}
                      onClick={() => onNavigate(item.tab)}
                      className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-[7px] text-left text-[13px] font-semibold transition-all"
                      style={isActive
                        ? { background: T.action, color: T.actionText, boxShadow: T.glow }
                        : { color: T.inkSoft, background: "transparent" }}
                    >
                      <span className="w-5 flex-shrink-0 text-center text-base leading-none">{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
