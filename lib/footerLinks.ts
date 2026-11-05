// Links every public page carries in its footer. The primary nav is
// admin-editable and saved in the database, so a guide added in code can go
// missing from the live menu until someone resets it (the portrait and family
// guides did). The footer is code-owned, so these hubs stay reachable from
// every page regardless of what the saved nav holds.

import { DEFAULT_NAV_CONFIG, type NavChild } from "./navConfig";

export type FooterLink = { label: string; href: string };
export type FooterLinkGroup = { id: string; label: string; links: FooterLink[] };

const GUIDES_NAV_GROUP_ID = "guides";

function guideLinks(): FooterLink[] {
  const group = DEFAULT_NAV_CONFIG.primary.find((item) => item.id === GUIDES_NAV_GROUP_ID);
  const children: NavChild[] = group?.type === "group" ? group.children : [];
  return children.map(({ label, href }) => ({ label, href }));
}

export const FOOTER_LINK_GROUPS: readonly FooterLinkGroup[] = [
  {
    id: "book",
    label: "Book",
    links: [
      { label: "Couples rates", href: "/pricing/couples" },
      { label: "Grad rates", href: "/pricing/grads" },
      { label: "Family rates", href: "/pricing/families" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Dates", href: "/availability" },
      { label: "Contact", href: "/contact" },
    ],
  },
  { id: "plan", label: "Plan", links: guideLinks() },
];

export const INSTAGRAM_URL = "https://www.instagram.com/soloxsnaps";
