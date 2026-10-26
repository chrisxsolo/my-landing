// ─────────────────────────────────────────────────────────────────────────────
// General FAQ content — single source of truth.
// Imported by FAQClient (rendering) and page.tsx (FAQPage JSON-LD).
// TO ADD/EDIT QUESTIONS: update the FAQS array below.
// ─────────────────────────────────────────────────────────────────────────────

import type { FAQGroup } from "./faqShared";
import { BOOKING_POLICY, PRICING_CATALOG, formatFee as formatCurrency } from "@/lib/pricingCatalog";

const grad = PRICING_CATALOG.graduation;
const couples = PRICING_CATALOG.couples.packages;
const families = PRICING_CATALOG.families.packages;

export const FAQS: FAQGroup[] = [
  {
    topic: "Booking & Logistics",
    emoji: "📅",
    items: [
      {
        q: "How do I book a session?",
        a: `Send an inquiry through the contact page with the type of session you're after, your ideal date, location, and how many people will be in the photos. The reply covers availability, pricing, and next steps. ${BOOKING_POLICY.inquiryResponse} A ${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer reserves your session, and the remaining balance is due ${BOOKING_POLICY.remainingBalanceDeadline}.`,
      },
      {
        q: "How far in advance should I book?",
        a: "The sooner the better. Weekends and golden-hour slots fill up fastest, and seasonal sessions (spring graduations, fall family photos, holiday minis) book out weeks ahead. If you have a specific date in mind, reach out at least 3–4 weeks early so we can lock it in.",
      },
      {
        q: "What's the retainer and when is it due?",
        a: `The retainer is ${BOOKING_POLICY.retainerPercent}% of the session total and is due when you confirm your date. It's ${BOOKING_POLICY.retainerRefundability} but transferable - it can be applied toward rescheduling or a future session with advance notice. The remaining balance is due ${BOOKING_POLICY.remainingBalanceDeadline}.`,
      },
      {
        q: "What happens if I need to reschedule?",
        a: "Life happens. If you need to move your session, reach out as early as possible and your retainer transfers to the new date as long as I have availability. Last-minute cancellations (same day or the day before) aren't eligible for rescheduling.",
      },
      {
        q: "What if the weather is bad?",
        a: "Light overcast is actually great for portraits — it acts like a giant softbox and removes harsh shadows. Heavy rain or storms are the only real reason to reschedule. We'll watch the forecast together and both agree before moving anything.",
      },
    ],
  },
  {
    topic: "Your Session",
    emoji: "📸",
    items: [
      {
        q: "I'm not photogenic / I hate being on camera. Will that be a problem?",
        a: "This is the most common thing I hear, and it's never actually a problem. I give clear, specific direction the whole way through — where to stand, where to look, what to do with your hands. You don't need to know how to pose. That's my job. Most people are relaxed within the first 10 minutes.",
      },
      {
        q: "How long is a session?",
        a: `It depends on the package. Graduation sessions start at ${grad.durationRules.standardMinutes} minutes (groups of ${grad.durationRules.groupMinimumSize} or more book at least ${grad.durationRules.groupMinimumMinutes}). Couples sessions run from ${couples.mini.durationMinutes} minutes for a mini to ${couples.engagement.durationMinutes} minutes for an engagement session, and maternity sessions are ${PRICING_CATALOG.maternity.durationMinutes} minutes. The Family Session is ${families.standard.durationMinutes} minutes and the Extended Family Session is ${families.extended.durationMinutes} minutes. Larger groups, or families who want more combinations and a slower pace with kids, usually do best with the extended session or added time.`,
      },
      {
        q: "How many photos will I receive?",
        a: `It depends on the package you book: ${grad.standardMinimumImages}+ edited images for a standard graduation session (${grad.groupMinimumImagesPerPerson}+ per person for groups), ${couples.mini.minimumImages}+ for a couples mini, ${couples["1hr"].minimumImages}+ for a 1-hour couples session, ${families.standard.minimumImages}+ for the Family Session, ${families.extended.minimumImages}+ for the Extended Family Session, and ${PRICING_CATALOG.maternity.minimumImages}+ for a maternity session. Each pricing page lists the minimum for every option.`,
      },
      {
        q: "What kinds of sessions do you shoot?",
        a: "Individual portraits, couples, families, maternity, and creative/lifestyle shoots — plus graduation sessions, which have their own dedicated FAQ. If you have an idea that doesn't fit neatly into a category, reach out and we'll build something that works.",
      },
      {
        q: "Can I come with a specific vision or shot list?",
        a: "Absolutely, and it helps. Send me reference photos, a mood board, or a few must-have shots when you book and I'll plan the session around them. I'll also bring my own ideas — the best results usually come from blending both.",
      },
      {
        q: "Can I bring my pet?",
        a: "Yes, as long as the location allows it. Let me know in advance and we'll plan a few shots with them. Bring someone to hold the pet between frames so we can keep things moving.",
      },
    ],
  },
  {
    topic: "Outfits & Preparation",
    emoji: "👗",
    items: [
      {
        q: "What should I wear?",
        a: "Go with solid colors and simple textures over busy prints, stripes, or large logos — they photograph cleaner and keep the focus on you. Coordinate rather than match exactly for couples and families: pick two or three colors and pull from that palette. When in doubt, dress for the mood you want the photos to feel like.",
      },
      {
        q: "Can I bring more than one outfit?",
        a: "Yes. Most sessions include one look, and you can add an outfit change so we get more variety. If you plan to change, factor in 5–10 minutes for the swap and I'll build a short break into the session routing.",
      },
      {
        q: "Any tips for hair and makeup?",
        a: "Outdoor light tends to soften features slightly, so go a touch bolder than your everyday look — a little more contour, defined brows, and matte over glossy finishes. For hair, stick with a style you've worn before and feel confident in. Shoot day isn't the time to try something brand new.",
      },
      {
        q: "How should we prepare as a couple or family?",
        a: "Keep it low-pressure. Lay outfits out the night before, and if there are little ones, schedule around naps and snacks so everyone's in a good mood. Come ready to interact with each other rather than just face the camera — the candid, in-between moments are usually the keepers.",
      },
    ],
  },
  {
    topic: "Maternity & Family",
    emoji: "🤰",
    items: [
      {
        q: "When should I schedule a maternity session?",
        a: "Most people book between 28 and 34 weeks, when the bump is nicely rounded but you're still comfortable moving around. If you're expecting multiples or want a little extra cushion, lean toward the earlier end of that window.",
      },
      {
        q: "What should I wear for maternity photos?",
        a: "Fitted pieces that follow your shape flatter the bump best — flowing gowns, a simple wrap, or even something form-fitting all work beautifully. Bring a couple of options and we'll choose on the day based on the location and light.",
      },
      {
        q: "Any tips for photographing with young kids?",
        a: "Keep expectations relaxed and let kids be kids — the genuine giggles and movement make the best frames. Snacks, a favorite toy, and timing the session around naps go a long way. I shoot patiently and let moments unfold rather than forcing stiff poses.",
      },
      {
        q: "Can extended family or extra people join?",
        a: "Yes. Just let me know the full headcount when you book so I can plan enough time for the group combinations. Larger groups generally need a longer session to cover everyone.",
      },
    ],
  },
  {
    topic: "Delivery & Files",
    emoji: "🖼️",
    items: [
      {
        q: "How long until I receive my photos?",
        a: `Standard turnaround is up to ${PRICING_CATALOG.standardTurnaroundDays / 7} weeks from the session date. If you need them sooner - for an announcement, gift, or deadline - expedited delivery is available as an add-on. Just flag it when you book.`,
      },
      {
        q: "How are the photos delivered?",
        a: "You'll get a link to a private online gallery where you can download every image in high resolution, ready to print or share. The gallery link is shareable, so family members can download their favorites too.",
      },
      {
        q: "Are all the photos edited?",
        a: "Yes. Every image in your gallery is fully finished — color corrected, retouched, and export-ready. You won't get unedited selects or a contact sheet; what you see is the final work.",
      },
      {
        q: "Do you provide RAW files?",
        a: `${BOOKING_POLICY.rawPolicy} Couples sessions can add a ${PRICING_CATALOG.couples.addOns.proofingGallery.label.toLowerCase()} (${formatCurrency(PRICING_CATALOG.couples.addOns.proofingGallery.price)}) to pick favorites from a lightly culled gallery before final editing; it is not a RAW or unculled gallery.`,
      },
    ],
  },
  {
    topic: "Locations & Pricing",
    emoji: "📍",
    items: [
      {
        q: "Where do you shoot?",
        a: "I'm based in the Bay Area and shoot on location across San Francisco, the East Bay, and the Peninsula — parks, beaches, downtown spots, campuses, and more. Have a specific place in mind? Send it over and I'll confirm availability and any travel fee.",
      },
      {
        q: "Is there a travel fee?",
        a: "Sessions within San Francisco have no travel fee. Locations outside the city may have a modest travel fee depending on distance — I'll always confirm it up front when you inquire, so there are no surprises.",
      },
      {
        q: "Can we shoot at more than one location?",
        a: "Yes. Multiple spots within the same area are usually easy to include in the session route. Adding a distinctly separate location is available as an add-on — let me know what you're picturing and we'll map it out.",
      },
      {
        q: "How much does a session cost?",
        a: `Pricing depends on the session type, length, and group size. Graduation sessions start at ${formatCurrency(grad.baseHourlyRate)}, couples sessions at ${formatCurrency(couples.mini.price)} for a ${couples.mini.durationMinutes}-minute mini (${formatCurrency(couples["1hr"].price)} for a full hour), family sessions at ${formatCurrency(families.standard.price)}, and maternity sessions are ${formatCurrency(PRICING_CATALOG.maternity.price)}. The pricing pages list every package and add-on, or send an inquiry describing what you have in mind and I'll put together a quote.`,
      },
    ],
  },
];
