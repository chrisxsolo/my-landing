// Guards against the public pages drifting apart again: every sold service has
// a real pricing page, an inquiry option, a sitemap entry, and links that
// resolve; policy copy never contradicts the catalog.
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { INQUIRY_SESSION_TYPES, PUBLIC_SERVICES, inquirySessionTypeFor } from "@/lib/serviceRegistry";
import { DEFAULT_NAV_CONFIG } from "@/lib/navConfig";
import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog";
import { exploreLinksFor } from "@/lib/blog/postService";
import { FAQS } from "@/app/(professional)/faq/faqData";

const APP = path.join(process.cwd(), "app");
const PROFESSIONAL = path.join(APP, "(professional)");

/** True when an internal href ("/a/b?x=1#y") maps to a page under app/(professional) or app/. */
function routeExists(href: string): boolean {
  const pathname = href.split(/[?#]/)[0].replace(/\/$/, "");
  if (pathname === "") return existsSync(path.join(PROFESSIONAL, "page.tsx"));
  const segments = pathname.split("/").filter(Boolean);
  return [PROFESSIONAL, APP].some((root) => existsSync(path.join(root, ...segments, "page.tsx")));
}

const read = (relative: string) => readFileSync(path.join(process.cwd(), relative), "utf8");

describe("service registry ↔ routes", () => {
  it.each(PUBLIC_SERVICES.map((s) => [s.id, s] as const))("%s links only to pages that exist", (_, service) => {
    for (const href of [service.pricingPath, service.portfolioPath, service.guidePath]) {
      if (href) expect(routeExists(href), href).toBe(true);
    }
  });

  it("covers every /pricing/* page", () => {
    const pricingDirs = readdirSync(path.join(PROFESSIONAL, "pricing"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `/pricing/${entry.name}`)
      .sort();
    expect(PUBLIC_SERVICES.map((s) => s.pricingPath).sort()).toEqual(pricingDirs);
  });

  it("offers every service on the inquiry form", () => {
    for (const service of PUBLIC_SERVICES) expect(INQUIRY_SESSION_TYPES).toContain(service.inquirySessionType);
    expect(new Set(INQUIRY_SESSION_TYPES).size).toBe(INQUIRY_SESSION_TYPES.length);
    expect(read("app/(professional)/contact/ContactFormFields.tsx")).toContain("INQUIRY_SESSION_TYPES");
  });

  it("lists every service pricing page in the sitemap", () => {
    // The sitemap's static routes are a literal list (the dynamic part needs the DB).
    const source = read("app/sitemap.ts");
    for (const service of PUBLIC_SERVICES) expect(source).toContain(`path: "${service.pricingPath}"`);
  });

  it("maps journal services onto real inquiry options", () => {
    for (const serviceType of ["grads", "couples", "families", "maternity", "portraits", "events"] as const) {
      expect(INQUIRY_SESSION_TYPES).toContain(inquirySessionTypeFor(serviceType));
    }
  });
});

describe("homepage and hub ↔ pricing", () => {
  const home = read("app/components/HomeServices.tsx");
  const hub = read("app/(professional)/pricing/page.tsx");

  it("every homepage service card links to an existing pricing page", () => {
    const hrefs = [...home.matchAll(/href="(\/pricing\/[a-z-]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(["/pricing/grads", "/pricing/couples", "/pricing/families"]);
    for (const href of hrefs) expect(routeExists(href)).toBe(true);
  });

  it("the /pricing hub lists every hub service", () => {
    for (const service of PUBLIC_SERVICES.filter((s) => s.onPricingHub)) {
      expect(hub).toContain(`href:    "${service.pricingPath}"`);
    }
  });

  it("homepage prices come from the catalog, not number literals", () => {
    expect(home).not.toMatch(/\$\d{3}/);
  });
});

describe("navigation and journal links resolve", () => {
  it("every default nav link points to a real page", () => {
    const hrefs = DEFAULT_NAV_CONFIG.primary.flatMap((item) =>
      item.type === "group" ? [item.href, ...item.children.map((c) => c.href)] : [item.href],
    ).filter((href): href is string => Boolean(href));
    for (const href of [...hrefs, DEFAULT_NAV_CONFIG.cta.href, DEFAULT_NAV_CONFIG.clientLogin.href]) {
      expect(routeExists(href), href).toBe(true);
    }
  });

  it("every journal 'Keep exploring' link points to a real page", () => {
    for (const service of [null, "grads", "couples", "families", "maternity", "portraits", "prom", "events"] as const) {
      for (const link of exploreLinksFor(service, null)) expect(routeExists(link.href), link.href).toBe(true);
    }
  });
});

describe("policy copy agrees with the catalog", () => {
  const faqText = FAQS.flatMap((group) => group.items.map((item) => item.a)).join("\n");

  it("never offers RAW files", () => {
    expect(faqText).toContain(BOOKING_POLICY.rawPolicy);
    expect(faqText).not.toMatch(/licens/i);
    for (const file of [
      "app/(professional)/faq/graduation/graduationFaqData.ts",
      "app/(professional)/family-guide/faq/familyFaqData.ts",
      "app/(professional)/couples-guide/faq/couplesFaqData.ts",
      "app/(professional)/portrait-guide/faq/portraitFaqData.ts",
    ]) {
      expect(read(file), file).not.toMatch(/licens/i);
    }
  });

  it("states family session lengths from the catalog, not a 90-minute rule", () => {
    expect(faqText).toContain(`Family Session is ${PRICING_CATALOG.families.packages.standard.durationMinutes} minutes`);
    expect(faqText).not.toMatch(/90 minutes or more/);
  });

  it("never promises one image count for every session", () => {
    expect(read("app/(professional)/about/page.tsx")).not.toMatch(/gallery with 50\+/);
  });

  it("uses one reply-time promise", () => {
    const sources = [
      "app/(professional)/contact/thanks/page.tsx",
      "app/(professional)/availability/AvailabilityCalendar.tsx",
      "app/(professional)/contact/page.tsx",
    ].map(read).join("\n");
    expect(sources).not.toMatch(/24\s*(–|-|to)\s*48/);
    expect(faqText).toContain(BOOKING_POLICY.inquiryResponse);
  });

  it("never calls a calendar date booked by the visitor", () => {
    expect(read("app/(professional)/availability/AvailabilityCalendar.tsx")).not.toMatch(/Book this date/i);
  });
});
