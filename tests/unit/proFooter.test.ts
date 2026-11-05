// The footer is the code-owned link surface every public page shares, so the
// guide hubs stay crawlable even when the admin-saved primary nav predates them.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ProFooter from "@/app/components/ProFooter";
import { FOOTER_LINK_GROUPS } from "@/lib/footerLinks";

describe("professional footer", () => {
  const html = renderToStaticMarkup(createElement(ProFooter));

  it("links every guide hub and the booking pages as crawlable anchors", () => {
    for (const href of ["/grad-guide", "/couples-guide", "/family-guide", "/portrait-guide", "/bay-area-locations", "/faq",
      "/pricing/grads", "/pricing/couples", "/pricing/families", "/portfolio", "/availability", "/contact", "/privacy", "/terms"]) {
      expect(html).toContain(`href="${href}"`);
    }
  });

  it("renders each link group once with its label", () => {
    for (const group of FOOTER_LINK_GROUPS) {
      expect(group.links.length).toBeGreaterThan(0);
      expect(html).toContain(`aria-label="${group.label} links"`);
    }
    expect(html.match(/<nav\b/g)).toHaveLength(FOOTER_LINK_GROUPS.length);
  });
});
