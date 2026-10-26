// lib/serviceRegistry.ts
// The services the public site sells, and where each one lives: its pricing
// page, portfolio, planning guide, and the inquiry-form value that books it.
// Prices and deliverables stay in pricingCatalog.ts; this file only ties the
// routes and labels together so pages, the contact form, and journal links
// reference one list. tests/unit/serviceConsistency.test.ts checks every path
// here against the real routes.

import type { ServiceType } from "./contentEngine/taxonomy";

export type PublicService = {
  id: "grads" | "couples" | "families" | "maternity" | "elopements" | "events";
  /** Content Engine / journal service this maps from, when there is one. */
  serviceType: ServiceType | null;
  label: string;
  pricingPath: string;
  portfolioPath: string | null;
  guidePath: string | null;
  /** Exact option value on the contact form's "Session type" select. */
  inquirySessionType: string;
  /** Listed on the /pricing hub. */
  onPricingHub: boolean;
};

export const PUBLIC_SERVICES: readonly PublicService[] = [
  {
    id: "grads", serviceType: "grads", label: "Graduation",
    pricingPath: "/pricing/grads", portfolioPath: "/portfolio?category=grads", guidePath: "/grad-guide",
    inquirySessionType: "Graduation Portrait", onPricingHub: true,
  },
  {
    id: "couples", serviceType: "couples", label: "Couples",
    pricingPath: "/pricing/couples", portfolioPath: "/portfolio/couples", guidePath: "/couples-guide",
    inquirySessionType: "Couples Session", onPricingHub: true,
  },
  {
    id: "families", serviceType: "families", label: "Family",
    pricingPath: "/pricing/families", portfolioPath: "/portfolio?category=families", guidePath: "/family-guide",
    inquirySessionType: "Family Session", onPricingHub: true,
  },
  {
    id: "maternity", serviceType: "maternity", label: "Maternity",
    pricingPath: "/pricing/maternity", portfolioPath: null, guidePath: "/family-guide",
    inquirySessionType: "Maternity Session", onPricingHub: true,
  },
  {
    id: "elopements", serviceType: null, label: "Elopement",
    pricingPath: "/pricing/elopements", portfolioPath: null, guidePath: "/couples-guide",
    inquirySessionType: "Elopement / Courthouse Ceremony", onPricingHub: true,
  },
  {
    id: "events", serviceType: "events", label: "Event",
    pricingPath: "/pricing/events", portfolioPath: null, guidePath: null,
    inquirySessionType: "Event Coverage", onPricingHub: false,
  },
];

/** Contact form "Session type" options: every service, then the open-ended ones. */
export const INQUIRY_SESSION_TYPES: readonly string[] = [
  ...PUBLIC_SERVICES.map((service) => service.inquirySessionType),
  "Individual Portrait",
  "Other",
];

/** Inquiry-form value for a journal/engine service, if the site sells it. */
export function inquirySessionTypeFor(serviceType: ServiceType | null): string | null {
  if (!serviceType) return null;
  if (serviceType === "portraits") return "Individual Portrait";
  return PUBLIC_SERVICES.find((service) => service.serviceType === serviceType)?.inquirySessionType ?? null;
}
