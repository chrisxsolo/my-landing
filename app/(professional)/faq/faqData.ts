// ─────────────────────────────────────────────────────────────────────────────
// General FAQ content — single source of truth.
// Imported by FAQClient (rendering) and page.tsx (FAQPage JSON-LD).
// TO ADD/EDIT QUESTIONS: update the FAQS array below.
// ─────────────────────────────────────────────────────────────────────────────

import type { FAQGroup } from "./faqShared";
import { BOOKING_POLICY, PRICING_CATALOG } from "@/lib/pricingCatalog";

export const FAQS: FAQGroup[] = [
  {
    topic: "Booking & Logistics",
    emoji: "📅",
    items: [
      {
        q: "How do I book a session?",
        a: `Send an inquiry through the contact page with the type of session you're after, your ideal date, location, and how many people will be in the photos. I'll reply within 24 hours with availability, pricing, and next steps. A ${BOOKING_POLICY.retainerPercent}% ${BOOKING_POLICY.retainerRefundability} retainer reserves your session, and the remaining balance is due ${BOOKING_POLICY.remainingBalanceDeadline}.`,
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
        a: "Standard portrait, couples, and maternity sessions run about an hour. Family or group sessions usually need 90 minutes or more to cover individuals plus the combinations. If you want multiple looks or locations, longer sessions are available — just ask.",
      },
      {
        q: "How many photos will I receive?",
        a: `A standard graduation session includes ${PRICING_CATALOG.graduation.standardMinimumImages}+ professionally edited images. Other package minimums vary by session type, length, and group size.`,
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
        a: "RAW files aren't included in standard sessions — the edited gallery is the deliverable. If you have a specific need for the originals, RAW files can be licensed separately. Reach out and we'll talk it through.",
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
        a: "Pricing depends on the session type, length, and group size. Head to the pricing pages for current rates on couples, families, and graduation sessions — or send an inquiry describing what you have in mind and I'll put together a quote.",
      },
    ],
  },
];
