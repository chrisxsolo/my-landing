// The admin dashboard's tabs, in one place. The Website tabs come from the
// sidebar's own WEBSITE_NAV_GROUPS; the business and tool tabs are listed
// here. Every navigation surface (sidebar, mobile strip, command palette,
// ?tab= links) derives from these, so a tab added to one cannot be missing
// from another — tests/unit/adminTabs.test.ts checks that.
import { WEBSITE_NAV_GROUPS, type WebsiteTab } from "@/app/admin/AdminWebsiteNavigation";

export const HOME_TAB = "home";
export const BUSINESS_TABS = ["inquiries", "clients", "testimonials", "analytics", "payments", "funnel", "attribution"] as const;
export const TOOL_TABS = ["ai", "chat", "format", "vault", "accounts"] as const;

export type Tab = typeof HOME_TAB | WebsiteTab | (typeof BUSINESS_TABS)[number] | (typeof TOOL_TABS)[number];

/** "<icon> <label>" per tab; navItem() splits the two apart. */
export const TAB_LABELS: Record<Tab, string> = {
  home: "🏠 Home",
  poses: "📸 Grad Poses", couplesGuide: "💞 Couples Posing Guide", couplesLocations: "💑 Couples Locations",
  portraitLocations: "🙋 Portrait Locations", locations: "📍 Campus Spots", bayGuide: "🗺️ Bay Guide",
  familyGuide: "👨‍👩‍👧 Family Guide", portfolio: "🖼️ Portfolio", couplesPortfolio: "💑 Couples Portfolio",
  pagePhotos: "🧩 Page Photos", caseStudies: "📖 Case Studies", categories: "🏷️ Categories", blog: "✍️ Blog",
  library: "🗄️ Image Library", navigation: "🧭 Navigation", aboutPage: "🙋 About Page",
  analytics: "📊 Analytics", payments: "💵 Revenue", funnel: "📈 Funnel", attribution: "🎯 Attribution",
  inquiries: "📬 Inquiries", clients: "👥 Clients", testimonials: "💬 Testimonials",
  vault: "📓 Vault", ai: "🤖 AI Training", chat: "💬 AI Chat", format: "✨ Quick Format", accounts: "👤 Accounts",
};

/** A ?tab= value or palette key is a Tab only when it is one we label. */
export function isTab(value: unknown): value is Tab {
  return typeof value === "string" && Object.hasOwn(TAB_LABELS, value);
}

export interface NavItem { t: Tab; icon: string; label: string }

/** "📸 Grad Poses" → { icon: "📸", label: "Grad Poses" }. */
export function navItem(t: Tab): NavItem {
  const [icon, ...rest] = TAB_LABELS[t].split(" ");
  return { t, icon, label: rest.join(" ") };
}

const WEBSITE_NAV_ITEMS: NavItem[] = WEBSITE_NAV_GROUPS.flatMap((group) =>
  group.items.map(({ tab, icon, label }) => ({ t: tab, icon, label })));

/** Every tab, in the order the mobile strip shows them. */
export const MOBILE_NAV_ITEMS: NavItem[] = [
  navItem(HOME_TAB),
  ...BUSINESS_TABS.map(navItem),
  ...WEBSITE_NAV_ITEMS,
  ...TOOL_TABS.map(navItem),
];
