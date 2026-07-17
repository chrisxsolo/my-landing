// ─────────────────────────────────────────────────────────────────────────────
// Portrait FAQ content — single source of truth.
// Imported by PortraitFaqClient (rendering) and page.tsx (FAQPage JSON-LD), so
// the visible Q&A and the structured data always match exactly.
//
// Every business fact here is pulled from confirmed sources only:
//   - BOOKING_POLICY                          (retainer, balance, contract)
//   - PRICING_CATALOG.standardTurnaroundDays  (delivery window)
// There is NO portraits entry in PRICING_CATALOG, so no session lengths, image
// counts, package prices, or outfit allowances are stated — those answers point
// to the pricing page and the inquiry instead of inventing numbers.
// ─────────────────────────────────────────────────────────────────────────────

import type { FAQGroup } from "../../faq/faqShared";
import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog";

const turnaroundWeeks = PRICING_CATALOG.standardTurnaroundDays / 7;

export const FAQS: FAQGroup[] = [
  {
    topic: "Booking & Logistics",
    emoji: "📅",
    items: [
      {
        q: "How far in advance should I book?",
        a: "As early as you can, especially for weekend and golden-hour times, which book up first. A few weeks of lead time leaves room to choose a date and location, send the agreement, and plan around the season's sunset. Last-minute sessions are sometimes possible, so it's always worth asking.",
      },
      {
        q: "Is a retainer required?",
        a: `Yes. A ${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer reserves your date, the contract is completed ${BOOKING_POLICY.contractDeadline}, and the remaining balance is due ${BOOKING_POLICY.remainingBalanceDeadline}.`,
      },
      {
        q: "How much does a portrait session cost?",
        a: "Session options and what's included are kept current on the pricing page rather than restated here, so the details are always accurate. Tell me what the photos are for — a milestone, your work, or a creative session — and I'll recommend the option that fits.",
      },
      {
        q: "Are travel fees required?",
        a: "San Francisco locations are included. Locations outside San Francisco may include a travel fee based on distance. Send me the spot you have in mind and I'll confirm any travel fee before you book.",
      },
      {
        q: "What happens if it rains or the fog rolls in?",
        a: "Light overcast and fog are genuinely flattering for portraits — soft, even light with no harsh shadows. Heavy rain is the main reason to move a session. If the forecast looks bad, we'll talk ahead of time and agree on a plan together, whether that's adjusting the timing or picking a new date.",
      },
    ],
  },
  {
    topic: "The Session",
    emoji: "📸",
    items: [
      {
        q: "I have no idea how to pose. Is that a problem?",
        a: "Not at all — direction is the core of what I do, and it matters double in a solo session. I tell you where to stand, what to do with your hands, where to look, and I keep simple prompts moving so you're doing rather than holding still. You never have to invent a pose.",
      },
      {
        q: "What if I feel awkward in front of the camera?",
        a: "Completely normal — being photographed alone feels more exposed than being in a group, and almost every client says so. I keep the session low-pressure with movement, resets, and breaks, and the awkward first few minutes pass quickly once we get going. You don't have to perform the whole time.",
      },
      {
        q: "Can I choose the location?",
        a: "Yes. We choose together based on the mood you want, what the photos are for, and practical things like walking, parking, and privacy. The portrait guide's location pages are a great starting point, and I'm happy to suggest options that fit.",
      },
      {
        q: "Can this be a personal branding or headshot session?",
        a: "Yes — portraits for your work are one of the most common reasons people book: website and profile photos, press images, or a professional refresh that actually looks like you. Tell me how you'll use the photos and I'll plan the locations, outfits, and frames around it.",
      },
      {
        q: "Can I bring my dog, props, or inspiration photos?",
        a: "In many cases, yes to all three. Dogs work when the location allows them and someone can help wrangle between shots. A meaningful object — an instrument, a tool of your trade — can add a lot when used sparingly. And inspiration images help me understand the look you're after; I'll aim for that feeling and adapt it to our location and light.",
      },
    ],
  },
  {
    topic: "Outfits & Preparation",
    emoji: "👔",
    items: [
      {
        q: "What should I wear?",
        a: "Solid colors and simple silhouettes keep the focus on you: warm neutrals and earth tones for parks and the coast, sharper structured pieces for architecture and the city. Choose clothes you can move in, and bring a layer for San Francisco wind. The what-to-wear guide goes deeper, including branding-session outfits.",
      },
      {
        q: "Can I change outfits during the session?",
        a: "Often, yes — it depends on the session length and location logistics. Tell me you'd like an outfit change when you inquire and I'll let you know what's realistic and plan the route around a practical changing point.",
      },
      {
        q: "Should I get hair and makeup done?",
        a: "Entirely up to you — there's no requirement. If you do book styling, schedule it so you're not rushing to the session, and plan hair for the location: somewhere windy like Baker Beach favors a style that moves well over one that must stay perfectly in place.",
      },
    ],
  },
  {
    topic: "Delivery & Files",
    emoji: "🖼️",
    items: [
      {
        q: "How many photographs will I receive?",
        a: "It depends on the session option — each one lists a minimum number of professionally edited images on the pricing page, and I'll confirm the count for your session when you inquire.",
      },
      {
        q: "When will I receive the gallery?",
        a: `Standard turnaround is up to ${turnaroundWeeks} weeks from your session date, delivered as a private online gallery you can download and share. If you need images sooner — for a launch, a press deadline, or an application — tell me the date and we'll plan around it.`,
      },
      {
        q: "Are RAW files included?",
        a: "No. The edited gallery is the deliverable — every image is fully edited and ready to share, print, or publish. RAW files are not included with the session.",
      },
    ],
  },
];
