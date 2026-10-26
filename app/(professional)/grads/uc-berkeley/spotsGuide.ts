import type { SchoolSpotsGuide } from "@/app/components/schoolSpotsGuideTypes";
import { buildBookingIntentParams } from "@/lib/bookingIntent";
import { formatCurrency } from "@/lib/pricing";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";

const CHAMPAGNE = PRICING_CATALOG.graduation.addOns.champagne;
// Opens the inquiry form with the champagne add-on already selected.
const CHAMPAGNE_INQUIRY = `/contact?${buildBookingIntentParams({
  sourcePage: "school-spots-page", sessionType: "Graduation Portrait",
  school: "UC Berkeley", addOns: [CHAMPAGNE.shortLabel],
})}`;

// The UC Berkeley photo location guide (/grads/uc-berkeley/spots). Written from
// Chris's own Berkeley sessions; campus facts checked against official pages.
//
// Internal notes (never published):
// - Inside Doe Library and champagne pops are offered per Chris (2026-10-26):
//   both happen in his sessions all the time. Champagne copy follows his
//   wording (no age or cleanup lines). The interior section still names the
//   Library's posted policy and says we head out if staff ask.
// - Still to confirm before publishing specifics: where exactly the Doe Library
//   ledge and the preferred cherry trees are, walking times between stops,
//   exterior commercial photography rules, and temporary closures/construction.
//   No clock times, durations, or session lengths are stated on purpose.
export const spotsGuide: SchoolSpotsGuide = {
  metaTitle: "Best UC Berkeley Graduation Photo Locations",
  metaDescription:
    "Explore the best UC Berkeley graduation photo spots, from Sather Gate to Doe Library and the Campanile, with photographer tips on lighting and crowds.",
  keywords: [
    "UC Berkeley graduation photographer",
    "Berkeley graduation photos",
    "UC Berkeley graduation pictures",
    "UC Berkeley graduation photo locations",
    "Sather Gate graduation photos",
    "Doe Library graduation pictures",
    "Campanile graduation photography",
    "Berkeley graduation photo spots",
    "UC Berkeley golden hour photos",
    "UC Berkeley graduation photo guide",
  ],
  h1: "Best UC Berkeley Graduation Photo Locations",
  intro: [
    "UC Berkeley is one of my favorite campuses for graduation photography because of its beautiful architecture, iconic landmarks, and variety of photo locations. From Sather Gate and the Campanile to the historic Doe Library, there are plenty of places to capture your graduation memories.",
    "After photographing graduation sessions around UC Berkeley, I've developed a preferred route that makes the most of the light while moving between some of the most recognizable spots on campus.",
    "In this guide, I'll share my favorite UC Berkeley graduation photo spots, when I recommend photographing them, and a few tips to make your session go as smoothly as possible.",
  ],
  mustHaveHeading: "Short on time? Start with these",
  mustHaveIntro:
    "If time is limited, I prioritize Sather Gate, the Campanile, and the Doe Library area, then add other stops based on what matters most to you.",
  mustHaveKeys: ["sather-gate", "campanile", "doe-library-entrance"],
  spotsHeading: "My seven favorite UC Berkeley graduation photo spots",
  bestTime: {
    heading: "When is the best time to take graduation photos at UC Berkeley?",
    paragraphs: [
      "My two favorite times for UC Berkeley graduation photography are sunrise and golden hour before sunset. Both give softer, more flattering natural light than the harsher light you often get in the middle of the day.",
      "For sunset sessions, I typically start around Sather Gate and work my way through campus before finishing at Doe Library. That saves one of my favorite graduation backdrops for a time when the light is often easier to balance: the building behind you is no longer much brighter than you are, so both you and the architecture can look their best in the same photo.",
      "Sunrise can also be a fantastic option, especially if you'd like to avoid some of the crowds that build later in the day, although a quiet campus is never guaranteed.",
      "My biggest recommendation is to plan your session around the light rather than picking a random open hour. Light changes with the season, the weather, and shade from buildings and trees, so I plan the order of stops around the conditions on your date.",
    ],
    weather:
      "Berkeley's weather can change from one day to the next, so no forecast is guaranteed. We'll keep an eye on it together as your date gets closer.",
    // Downtown Berkeley (city center, not a campus landmark) — only used to
    // compute approximate sunset times; never published.
    sunsetCoords: { latitude: 37.8715, longitude: -122.273 },
  },
  route: {
    navLabel: "My route",
    heading: "My Favorite UC Berkeley Graduation Photo Route",
    intro: [
      "When I photograph graduation sessions at UC Berkeley, I usually like to begin at Sather Gate and finish at Doe Library. Between those, we can visit the Campanile, the Hearst Memorial Mining Building, and Mining Circle, depending on the time available. In spring, we can add the cherry blossoms when they're in bloom.",
      "My main goal is to finish at Doe Library around sunset, because that's when I often get the most flattering balance of light there. Here's the order I usually start from:",
    ],
    steps: [
      { spotKey: "sather-gate", text: "Start at Sather Gate." },
      { spotKey: "campanile", text: "Head to the Campanile." },
      { spotKey: "hearst-mining", text: "Visit the Hearst Memorial Mining Building." },
      { spotKey: "mining-circle", text: "Add Mining Circle and the Rondo II sculpture." },
      { spotKey: "cherry-blossoms", text: "Include the cherry blossoms, when they're in season." },
      { spotKey: "doe-library-ledge", text: "Move to the Doe Library ledge." },
      { spotKey: "doe-library-entrance", text: "Finish at the front of Doe Library around sunset." },
    ],
    notes: [
      "This is a suggested photography order, not a fixed walking route. I rearrange the middle stops around the light, the crowds, your priorities, and where we meet, to avoid doubling back. The one thing I try to keep is finishing at Doe Library near sunset.",
      "If you'd like photos inside Doe Library, we do those earlier in the session, while there's still plenty of daylight coming through the windows.",
      "Not every stop fits into every session. If time is limited, I prioritize Sather Gate, the Campanile, and the Doe Library area, then choose other stops based on what you care about most. During busy graduation weeks, I build in extra time for waiting at the popular landmarks.",
    ],
  },
  sections: [
    {
      id: "crowds",
      navLabel: "Crowds",
      heading: "How to Avoid Crowds During UC Berkeley Graduation Season",
      paragraphs: [
        "UC Berkeley is one of the busiest campuses I photograph during graduation season. As commencement approaches, more graduates and photographers gather around the same popular landmarks, especially Sather Gate, the Campanile, and Doe Library.",
        "One of my biggest recommendations is to schedule your session earlier in the season if you can. Weekdays are generally my preferred option, since they give us a better chance of avoiding the busiest crowds.",
        "Even with careful planning, some waiting may still be necessary at popular spots. I always do my best to find good angles, work around other groups, and move efficiently through campus, but especially at peak season it helps to stay flexible. A little patience makes a big difference at Berkeley's most iconic landmarks.",
      ],
      bulletsLabel: "Practical recommendations",
      bullets: [
        "Book earlier in graduation season when possible.",
        "Choose a weekday over the busiest weekends.",
        "Consider sunrise for a potentially quieter session.",
        "Leave room in your schedule for delays.",
        "Expect other graduates and photographers at the same landmarks.",
        "Be flexible about the order of the middle stops.",
        "Don't expect an empty background at every landmark.",
      ],
    },
    {
      id: "champagne",
      navLabel: "Champagne photos",
      heading: "Champagne-Popping Photos at Berkeley",
      paragraphs: [
        "Champagne pops are one of my favorite ways to celebrate at Berkeley. My go-to spot is the lawn near Doe Library, with the Campanile rising behind you.",
        "Champagne is allowed in your session unless we're told otherwise on the day. If campus staff or an event on site ask us not to, we'll switch to another celebration shot right there.",
        `Bring your own bottle, or I can bring one for you on request. Champagne is a ${formatCurrency(CHAMPAGNE.price)} add-on: just request it on your inquiry form.`,
      ],
      cta: { label: "Request the champagne add-on", href: CHAMPAGNE_INQUIRY },
    },
    {
      id: "inside-doe-library",
      navLabel: "Inside Doe Library",
      spotKey: "doe-library-interior",
      heading: "Can We Take Photos Inside Doe Library?",
      paragraphs: [
        "Yes. The inside of Doe Library is beautiful, and graduation photos happen there all the time. It works best earlier in the session, while daylight is still coming through the windows, so I'll fit it in before we finish outside at sunset.",
        "Good to know: the UC Berkeley Library's posted policy says staged graduation photos aren't allowed inside its buildings. Inside, we keep it quick and quiet since students are studying, and if staff ask us to wrap up, we head back outside.",
        "Campus closures and construction can change, and some areas may be unavailable on a given day. I check current conditions before your session and adjust the route if a spot is closed.",
      ],
      links: [
        { label: "UC Berkeley Library filming and photography", href: "https://www.lib.berkeley.edu/about/filming" },
        { label: "UC Berkeley campus map", href: "https://www.berkeley.edu/map/" },
      ],
    },
  ],
  tips: [
    {
      title: "Tell me your must-have spots",
      body: "Let me know which landmarks matter most to you. I'll plan the route so we cover them first and fit in others as time allows.",
    },
    {
      title: "Bring comfortable shoes",
      body: "We'll walk between several campus spots, so comfortable shoes help. You can switch into your favorite pair for the photos themselves.",
    },
    {
      title: "Prepare your graduation outfit",
      body: "Bring your cap, gown, stole, cords, and any meaningful accessories you'd like in the photos.",
    },
    {
      title: "No posing experience needed",
      body: "I give posing direction the whole way through, for both classic graduation portraits and relaxed, candid moments.",
    },
  ],
  faqs: [
    { q: "Where are the best places to take UC Berkeley graduation photos?", a: "My favorite locations include Sather Gate, Doe Library, the Campanile, and the Hearst Memorial Mining Building. I also recommend Mining Circle and the seasonal cherry blossoms for extra variety." },
    { q: "What's the best time for UC Berkeley graduation pictures?", a: "I recommend sunrise or golden hour before sunset. For sunset sessions, I especially like finishing at Doe Library because the light there can be easier to balance." },
    { q: "Where should we start our graduation session?", a: "I typically recommend starting at Sather Gate and making our way through campus before finishing at Doe Library." },
    { q: "Is UC Berkeley crowded during graduation season?", a: "Yes, it can get extremely busy. I recommend booking on a weekday and earlier in the graduation season if possible. Even then, we may need to wait at popular photo spots." },
    { q: "Can we take cherry blossom graduation photos at Berkeley?", a: "Yes, when the trees are blooming and the area is accessible. March can be a good time to look for blossoms, but the exact timing varies from year to year." },
    { q: "Can we take pictures inside Doe Library?", a: "Yes, graduation photos inside Doe Library happen all the time. We go earlier in the session while there's daylight, keep it quick and quiet for students, and head back outside if staff ask, since the Library's posted policy limits staged graduation photos indoors." },
    { q: "Can we take champagne-popping graduation photos?", a: `Yes! Champagne is allowed in your session unless we're told otherwise on the day. My favorite spot is the lawn near Doe Library with the Campanile behind you. Bring your own bottle, or I can bring one on request: it's a ${formatCurrency(CHAMPAGNE.price)} add-on you can request on your inquiry form.` },
    { q: "How many campus locations can we visit?", a: "It depends on your session length, walking distances, crowds, and how much time we spend at each spot. I'll help you prioritize the ones that matter most to you." },
    { q: "Will you help me pose?", a: "Absolutely! I'll give you posing guidance throughout the session, whether you're looking for traditional graduation portraits or more natural, candid photos." },
  ],
};
