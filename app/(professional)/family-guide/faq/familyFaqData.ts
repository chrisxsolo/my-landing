// ─────────────────────────────────────────────────────────────────────────────
// Family FAQ content — single source of truth.
// Imported by FamilyFaqClient (rendering) and page.tsx (FAQPage JSON-LD), so the
// visible Q&A and the structured data always match exactly.
//
// Every business fact here is pulled from confirmed sources only:
//   - PRICING_CATALOG.families  (session lengths, image minimums, add-ons)
//   - BOOKING_POLICY            (retainer, balance, contract)
//   - PRICING_CATALOG.standardTurnaroundDays (delivery window)
//   - the family pricing page Travel card (SF included; outside SF may add a fee)
// No prices, counts, turnaround times, retainers, or policies are invented here.
// ─────────────────────────────────────────────────────────────────────────────

import type { FAQGroup } from "../../faq/faqShared";
import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog";

const fam = PRICING_CATALOG.families;
const standard = fam.packages.standard;
const extended = fam.packages.extended;
const turnaroundWeeks = PRICING_CATALOG.standardTurnaroundDays / 7;

export const FAQS: FAQGroup[] = [
  {
    topic: "Booking & Logistics",
    emoji: "📅",
    items: [
      {
        q: "How far in advance should we book?",
        a: "As early as you can, especially in fall. September through November is the busiest stretch for family sessions, and weekend golden-hour times go first. If you want photos in time for holiday cards, reaching out a few weeks ahead leaves room for the session, editing, and gallery delivery without a rush.",
      },
      {
        q: "Is a retainer required?",
        a: `Yes. A ${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer reserves your date, the contract is completed ${BOOKING_POLICY.contractDeadline}, and the remaining balance is due ${BOOKING_POLICY.remainingBalanceDeadline}.`,
      },
      {
        q: "What happens if it rains?",
        a: "Light overcast is genuinely great for family photos — it gives soft, even light. Heavy rain is the main reason to move a session. If the forecast looks bad, we'll talk ahead of time and agree on a plan together, whether that's adjusting the timing or picking a new date.",
      },
      {
        q: "When should we schedule fall family photos?",
        a: "Earlier than you might think. Fall sunsets come sooner, so golden-hour sessions start earlier in the afternoon, and the best weekend times book up first. If the photos are for holiday cards, schedule with enough lead time for editing and delivery before you need to order prints.",
      },
      {
        q: "Are travel fees required outside San Francisco?",
        a: "San Francisco locations are included. Locations outside San Francisco may include a travel fee based on distance. Send me the location you have in mind and I'll confirm any travel fee before you book.",
      },
    ],
  },
  {
    topic: "The Session",
    emoji: "📸",
    items: [
      {
        q: "How long is a family session?",
        a: `The Family Session runs up to ${standard.durationMinutes} minutes at one location, and the Extended Family Session runs up to ${extended.durationMinutes} minutes for larger groups, younger kids, or more variety. We'll pick the right length together based on your family.`,
      },
      {
        q: "Do you help with posing?",
        a: "Yes — that's my job, and you don't need to know how to pose. I guide posing, prompts, and small activities throughout so the session stays relaxed and the photos feel natural rather than stiff. Most families settle in within the first few minutes.",
      },
      {
        q: "What if my child does not cooperate?",
        a: "This is completely normal and not a problem. I keep the pace child-friendly, lean on play and gentle prompts instead of forced posing, and build in time for warm-ups and breaks. Some of the best frames come from the in-between, candid moments rather than everyone looking at the camera at once.",
      },
      {
        q: "How many people can participate?",
        a: "The standard Family Session is ideal for a typical immediate family at one location. For larger groups or extended family, the Extended Family Session gives more time and flexibility. Let me know your headcount when you inquire so we plan the right length.",
      },
      {
        q: "Can grandparents (or extended family) join?",
        a: `Absolutely. Extended family members can be added (${fam.addOns.extendedFamily.displayPrice}), and the Extended Family Session is built for larger groups with more groupings and more time. Just tell me who's joining so we can plan for it.`,
      },
      {
        q: "Can we bring a dog?",
        a: "In many cases, yes — as long as the location allows dogs and someone can help manage them between shots. Let me know in advance so we can plan a few frames with your dog and choose a dog-friendly spot.",
      },
      {
        q: "Can we choose the location?",
        a: "Yes. We choose the location together based on your family, the scenery you want, and practical things like walking and parking. The family guide's location pages are a great starting point, and I'm happy to suggest options that fit.",
      },
    ],
  },
  {
    topic: "Outfits & Preparation",
    emoji: "👕",
    items: [
      {
        q: "What should we wear?",
        a: "Coordinate instead of matching: pick two to four colors that work together and vary textures and layers across the family. Choose comfortable clothing and practical shoes, skip large logos, and plan for San Francisco wind and cooler temperatures with light layers. The what-to-wear guide goes deeper.",
      },
      {
        q: "How do we prepare with young kids?",
        a: "Aim for a time when kids are usually rested and fed, bring water and simple snacks (nothing that heavily stains), pack wipes, and allow extra travel time so you arrive unhurried. Try not to pressure kids to perform — let them warm up and let me lead the session.",
      },
    ],
  },
  {
    topic: "Delivery & Files",
    emoji: "🖼️",
    items: [
      {
        q: "How many images will we receive?",
        a: `The Family Session includes a minimum of ${standard.minimumImages} professionally edited images, and the Extended Family Session includes a minimum of ${extended.minimumImages}. Longer sessions and larger groups typically produce more.`,
      },
      {
        q: "When will the gallery be delivered?",
        a: `Standard turnaround is up to ${turnaroundWeeks} weeks from your session date, delivered as a private online gallery you can download and share. If you need them sooner, ${fam.addOns.expedited.label.toLowerCase()} is available (${fam.addOns.expedited.displayPrice}).`,
      },
      {
        q: "Are RAW files included?",
        a: "No. The edited gallery is the deliverable — every image is fully edited and ready to print or share. RAW files are not included with the session.",
      },
    ],
  },
];
