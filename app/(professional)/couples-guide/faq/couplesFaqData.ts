// ─────────────────────────────────────────────────────────────────────────────
// Couples FAQ content — single source of truth.
// Imported by CouplesFaqClient (rendering) and page.tsx (FAQPage JSON-LD), so the
// visible Q&A and the structured data always match exactly.
//
// Every business fact here is pulled from confirmed sources only:
//   - PRICING_CATALOG.couples  (session lengths, image minimums, add-ons)
//   - BOOKING_POLICY           (retainer, balance, contract)
//   - PRICING_CATALOG.standardTurnaroundDays (delivery window)
//   - the couples pricing page Travel card (SF included; outside SF may add a fee)
// Engagement and proposal sessions ARE offered (PRICING_CATALOG.couples.packages),
// so those questions are answered factually. No prices, counts, turnaround times,
// retainers, outfit allowances, or policies are invented here.
// ─────────────────────────────────────────────────────────────────────────────

import type { FAQGroup } from "../../faq/faqShared";
import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog";
import { formatCurrency } from "@/lib/pricing";

const couples = PRICING_CATALOG.couples;
const mini = couples.packages.mini;
const oneHour = couples.packages["1hr"];
const signature = couples.packages.signature;
const engagement = couples.packages.engagement;
const turnaroundWeeks = PRICING_CATALOG.standardTurnaroundDays / 7;

export const FAQS: FAQGroup[] = [
  {
    topic: "Booking & Logistics",
    emoji: "📅",
    items: [
      {
        q: "How far in advance should we book?",
        a: "As early as you can, especially for weekend and golden-hour times, which book up first. A few weeks of lead time leaves room to choose a date and location, send the agreement, and plan around the season's sunset. Last-minute sessions are sometimes possible, so it's always worth asking.",
      },
      {
        q: "Is a retainer required?",
        a: `Yes. A ${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer reserves your date, the contract is completed ${BOOKING_POLICY.contractDeadline}, and the remaining balance is due ${BOOKING_POLICY.remainingBalanceDeadline}.`,
      },
      {
        q: "Are travel fees required?",
        a: "San Francisco locations are included. Locations outside San Francisco may include a travel fee based on distance. Send me the spot you have in mind and I'll confirm any travel fee before you book.",
      },
      {
        q: "What happens if it rains?",
        a: "Light overcast is genuinely beautiful for couples photos — it gives soft, even, flattering light. Heavy rain is the main reason to move a session. If the forecast looks bad, we'll talk ahead of time and agree on a plan together, whether that's adjusting the timing or picking a new date.",
      },
      {
        q: "What happens if San Francisco is foggy?",
        a: "Fog isn't a problem — at the coast, the bridge, and in the parks it often becomes a soft, romantic part of the photos. We can lean into the moodier look, or shift timing or placement to work with it. I can't promise fog-free skies or sunset color, but a foggy session can be gorgeous.",
      },
    ],
  },
  {
    topic: "The Session",
    emoji: "📸",
    items: [
      {
        q: "How long is a couples session?",
        a: `It depends on the package. The mini runs about ${mini.durationMinutes} minutes, the standard session about ${oneHour.durationMinutes} minutes, and the signature session is a longer ${signature.durationLabel.toLowerCase()}. We'll pick the right length together based on the variety and pace you want — see the couples pricing page for the full options.`,
      },
      {
        q: "Do you help us pose?",
        a: "Yes — that's my job, and you don't need to know how to pose. I guide posing, movement, and simple prompts throughout, mixing candid interaction with clear direction, so the session stays relaxed and the photos feel natural rather than stiff. Most couples settle in within the first few minutes.",
      },
      {
        q: "What if we feel awkward in front of the camera?",
        a: "Completely normal — most clients aren't models. I lean on movement, real interaction, and gentle prompts rather than rigid poses, and I keep things low-pressure with small breaks and resets. You're not expected to perform the whole time, and looking at the camera is only one part of the session. The awkward first few minutes pass quickly.",
      },
      {
        q: "Will you guide us through candid prompts?",
        a: "Yes. A lot of the most natural photos come from prompts that get you interacting — walking together, talking and laughing, leaning in close — rather than holding a pose. I direct those moments throughout so the candid frames still look intentional.",
      },
      {
        q: "Can we choose the location?",
        a: "Yes. We choose the location together based on the two of you, the scenery and mood you want, and practical things like walking and parking. The couples guide's location pages are a great starting point, and I'm happy to suggest options that fit.",
      },
      {
        q: "Can we bring our dog?",
        a: "In many cases, yes — as long as the location allows dogs and someone can help manage them between shots. Let me know in advance so we can plan a few frames with your dog and choose a dog-friendly spot.",
      },
      {
        q: "Can we bring props or recreate inspiration photos?",
        a: "Yes to both. A meaningful object can add to the photos when it's used sparingly. And if you have inspiration images you love, send them ahead — they help me understand the look you're after. I'll aim for that feeling rather than copying any photo exactly, and adapt it to our location and light.",
      },
    ],
  },
  {
    topic: "Engagements & Anniversaries",
    emoji: "💍",
    items: [
      {
        q: "Can this be an engagement session?",
        a: `Yes. Engagement sessions are offered as part of couples photography — a longer ${engagement.durationLabel.toLowerCase()} with location planning support, ideal for save-the-dates, wedding websites, and announcements. See the couples pricing page for details.`,
      },
      {
        q: "Can this be an anniversary session?",
        a: "Absolutely — anniversaries are one of the most common reasons couples book. Any of the couples session lengths work; just let me know it's an anniversary so I can plan the pacing and the kinds of moments we focus on.",
      },
      {
        q: "Can we include a surprise proposal?",
        a: "Yes. A proposal session is offered, with planning and coordination before the moment, the proposal itself, and portraits together afterward. Because timing and location matter so much, reach out early and we'll plan it carefully — see the couples pricing page for what's included.",
      },
    ],
  },
  {
    topic: "Outfits & Preparation",
    emoji: "👗",
    items: [
      {
        q: "Can we bring a second outfit?",
        a: `Often, yes — the standard session typically allows for one to two outfits, and an additional outfit can be added (${formatCurrency(couples.addOns.extraOutfit.price)}). An outfit change works best on longer sessions where there's time. Check the couples pricing page for what your package includes before planning a change.`,
      },
      {
        q: "Can we use two locations?",
        a: `Sometimes — it depends on the session length and how close the spots are. An additional nearby location can be added (${formatCurrency(couples.addOns.extraLocation.price)}), and engagement sessions are built with one to two nearby locations in mind. Tell me the spots you're considering and I'll let you know what's realistic in the time.`,
      },
      {
        q: "What should we wear?",
        a: "Coordinate instead of matching: pick two or three colors that work together and vary textures and layers. Dress for the location, choose clothes you can move in, and plan for San Francisco wind and cooler temperatures with a backup layer. The what-to-wear guide goes deeper.",
      },
    ],
  },
  {
    topic: "Delivery & Files",
    emoji: "🖼️",
    items: [
      {
        q: "How many photographs will we receive?",
        a: `It depends on the package — for example, a minimum of ${mini.minimumImages} professionally edited images on the mini and ${oneHour.minimumImages} on the standard session, with more on longer sessions. The exact minimum for each option is listed on the couples pricing page.`,
      },
      {
        q: "When will we receive the gallery?",
        a: `Standard turnaround is up to ${turnaroundWeeks} weeks from your session date, delivered as a private online gallery you can download and share. If you need them sooner, expedited delivery and a rush preview of a few images are available as add-ons.`,
      },
      {
        q: "Are RAW files included?",
        a: "No. The edited gallery is the deliverable — every image is fully edited and ready to share or print. RAW files are not included with the session.",
      },
    ],
  },
];
