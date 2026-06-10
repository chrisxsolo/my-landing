// lib/couplesGuide/supporting.ts
// Content for the couples-guide supporting article pages (what-to-wear,
// how-to-prepare, what-to-expect, best-time-for-couples-photos). One config per
// page feeds a shared server-rendered template (CouplesSupportingArticle), and a
// short `hubPreview` feeds the concise summary on the main /couples-guide hub — so
// the full text lives here once and the hub only teases it.
//
// What-to-expect intentionally avoids inventing business specifics (prices,
// counts, turnaround, outfit allowances). Those live on the couples pricing page
// and the FAQ, which pull from PRICING_CATALOG; this page links there instead of
// restating numbers. Mirrors lib/familyGuide/supporting.ts.

export type SupportingSection = {
  h2: string;
  paras?: string[];
  /** Optional list; `ordered` renders <ol> (e.g. the what-to-expect workflow). */
  list?: string[];
  ordered?: boolean;
};

export type SupportingTopic = {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  h1: string;
  intro: string;
  /** One-sentence teaser shown on the hub, which links here for the full guide. */
  hubPreview: string;
  sections: SupportingSection[];
};

export const SUPPORTING_TOPICS: Record<string, SupportingTopic> = {
  "what-to-wear": {
    slug: "what-to-wear",
    metaTitle: "What to Wear for Couples Photos in San Francisco",
    metaDescription:
      "What to wear for San Francisco couples photos — how to coordinate without matching, choosing colors for the location, layering for Bay Area wind and fog, and dressing like yourselves.",
    kicker: "Couples guide · Outfits",
    h1: "What to Wear for Couples Photos",
    intro:
      "The goal with couples outfits is simple: you look like the two of you, you're comfortable enough to move and laugh, and nothing competes with your faces. You don't need a perfect plan — a few easy choices go a long way, especially for outdoor sessions in San Francisco and the Bay Area.",
    hubPreview:
      "Coordinate without matching — pick complementary colors that suit the location, add texture and layers, and dress for Bay Area wind.",
    sections: [
      {
        h2: "Coordinate, don't match",
        paras: [
          "Identical outfits tend to look staged. Coordinating reads more natural: choose a palette of two or three colors that sit well together, then let each of you wear a different piece within it. Think of your outfits as complementing each other rather than matching.",
          "Soft neutrals and earth tones — cream, sand, sage, denim, muted blues, warm browns — photograph beautifully against Bay Area greenery, stone, and shoreline. A little gentle contrast keeps you both distinct rather than blending together.",
        ],
      },
      {
        h2: "Dress for the location",
        paras: [
          "The setting changes what works. Clean architectural backdrops like the Legion of Honor or the Palace of Fine Arts suit slightly more elevated, structured outfits. Beach and waterfront spots like Ocean Beach or Crissy Field lean casual and windblown. A wooded spot like Lovers' Lane sits nicely with soft, earthy textures.",
          "If you're unsure, tell me where we're shooting and I'm happy to point you toward a palette that flatters the scenery.",
        ],
      },
      {
        h2: "Use texture and layers",
        paras: [
          "Texture adds depth that flat blocks of color can't — knits, linen, a light jacket, or a flowing fabric give photos a richer, more tactile feel and help an outfit read as intentional.",
          "Layers are also practical: San Francisco runs cooler and windier than people expect, so a sweater or jacket keeps you comfortable and doubles as a styling element. Bring a backup layer even on a sunny day.",
        ],
      },
      {
        h2: "Keep it comfortable and like you",
        list: [
          "Choose clothes you can move, sit, walk, and hug in — comfort shows in your expressions.",
          "Skip large logos and tight, distracting patterns that pull the eye.",
          "Wear shoes you can walk in; many locations involve grass, sand, or natural paths.",
          "Pick outfits that feel like your normal style, just a step more put-together.",
          "Consider one outfit, or a second only if your package supports it — check the couples pricing page before planning a change.",
        ],
      },
      {
        h2: "Hair, accessories, and don't overthink it",
        paras: [
          "Hair and makeup are entirely up to you — there's no requirement to do anything formal. If we're shooting somewhere windy, plan a style that moves well rather than one that has to stay perfectly in place. Simple jewelry and meaningful accessories photograph well; a lot of competing pieces can distract.",
          "Lay your outfits out together the night before to check they work as a pair, then let it go. If something feels off, send me a quick photo and I'll help.",
        ],
      },
    ],
  },

  "how-to-prepare": {
    slug: "how-to-prepare",
    metaTitle: "How to Prepare for a Couples Photoshoot in San Francisco",
    metaDescription:
      "How to prepare for a Bay Area couples photoshoot — choosing a location and mood, what to bring, planning for weather and wind, and showing up relaxed so the session feels natural.",
    kicker: "Couples guide · Preparation",
    h1: "How to Prepare for Your Couples Session",
    intro:
      "A little preparation makes a couples session feel easy instead of stressful. None of this is complicated — it mostly comes down to choosing a setting you'll enjoy, planning around the weather, and showing up relaxed. I guide the posing throughout, so you don't need to rehearse anything.",
    hubPreview:
      "Pick a location and mood you both like, plan outfits and layers, allow travel time, and come ready to relax — I guide the rest.",
    sections: [
      {
        h2: "Choose a location and a mood",
        paras: [
          "Start with the feeling you want — elegant and classic, playful and casual, cinematic and moody, or quiet and intimate — then pick a setting that fits. The couples location guides walk through what each San Francisco spot does best, and we'll choose together based on your personalities and visual goals.",
          "If this session marks an anniversary, an engagement, or another milestone, let me know — it helps me plan the pacing and the kinds of moments we focus on.",
        ],
      },
      {
        h2: "Plan outfits and layers",
        paras: [
          "Decide on outfits a few days ahead so it isn't a morning-of scramble, and coordinate without matching. Because San Francisco is often cool and breezy, bring a backup layer even when the forecast looks warm. The what-to-wear guide covers palettes and location-specific ideas.",
        ],
      },
      {
        h2: "Bring the essentials",
        list: [
          "Water, and a small snack if it's a longer session.",
          "A backup layer for wind and cooler temperatures.",
          "Comfortable shoes for walking and natural paths.",
          "A quick wipe for glasses, watches, or phone screens that show in close-ups.",
          "A meaningful object only if it genuinely adds to the photos.",
        ],
      },
      {
        h2: "Allow time and check the weather",
        paras: [
          "Build in a buffer for parking and walking to the meeting point so you arrive unhurried — rushing sets a frazzled tone. I'll send the exact meeting spot beforehand so there's no guessing on the day.",
          "Check the forecast the day before and dress for temperature and wind. Fog isn't a problem — it often becomes a soft, romantic part of the photos. If conditions look genuinely bad, we'll talk and make a plan together.",
        ],
      },
      {
        h2: "Come ready to relax",
        paras: [
          "You don't need to know how to pose or practice in the mirror. The most natural photos come when you stop performing and just interact — talking, walking, laughing, leaning in. Let me lead with simple prompts, and trust that the awkward first few minutes are completely normal and pass quickly.",
        ],
      },
    ],
  },

  "what-to-expect": {
    slug: "what-to-expect",
    metaTitle: "What to Expect from a Couples Photo Session in San Francisco",
    metaDescription:
      "What to expect from a San Francisco couples photo session with SoloXSnaps — from inquiry and planning to a guided shoot mixing candid and directed moments, professional editing, and a private gallery.",
    kicker: "Couples guide · Process",
    h1: "What to Expect from Your Couples Session",
    intro:
      "Knowing how a session flows takes the mystery out of it. Here's the general path from your first message to the finished gallery, with guidance from me at every step — so you can relax and enjoy the time together.",
    hubPreview:
      "From inquiry to a private gallery — planning, a guided shoot mixing candid and directed moments, then professional editing.",
    sections: [
      {
        h2: "The session, step by step",
        ordered: true,
        list: [
          "You send an inquiry with your ideal date, the session type, and any location ideas.",
          "We choose the date and location together.",
          "We confirm the package or session length that fits what you want.",
          "I send an invoice and agreement; a retainer reserves the date where required.",
          "I send preparation guidance and, before the session, the exact meeting point.",
          "On the day, I guide posing, movement, and interaction so it stays relaxed.",
          "We capture a mix of candid, directed, and quiet close moments.",
          "Your images are professionally edited.",
          "You receive a private online gallery to download and share.",
        ],
      },
      {
        h2: "A guided, relaxed shoot",
        paras: [
          "You don't need to know how to pose — that's my job. I direct where to stand, simple things to do, and small prompts that get you interacting, so it feels like spending time together rather than performing. That's usually when the most natural expressions and genuine moments show up.",
          "It's a mix, not one note: some classic looking-at-the-camera portraits, some walking and movement, some playful frames, and some quiet, close moments. If you're camera-shy, that's completely normal and something I plan around.",
        ],
      },
      {
        h2: "Pricing, delivery, and the details",
        paras: [
          "Session lengths, what's included, how many edited images you receive, turnaround time, retainer, outfit changes, and travel are all kept current on the couples pricing page and the couples FAQ. I point you there rather than restating numbers here so the details are always accurate.",
        ],
      },
    ],
  },

  "best-time-for-couples-photos": {
    slug: "best-time-for-couples-photos",
    metaTitle: "Best Time for Couples Photos in San Francisco",
    metaDescription:
      "The best time for couples photos in San Francisco — golden hour vs. morning, blue hour, fog and wind, weekday crowds, seasonal sunsets, and why the right time depends on the location and mood.",
    kicker: "Couples guide · Timing",
    h1: "Best Time for Couples Photos",
    intro:
      "The best time for couples photos depends on two things: the light and the look you want. Here's how to weigh both — along with San Francisco's fog, wind, and crowds — so you choose a window that flatters you and suits the setting.",
    hubPreview:
      "Golden hour gives the softest, most romantic light, but the best time balances light, crowds, and the mood you want for the location.",
    sections: [
      {
        h2: "Golden hour and morning light",
        paras: [
          "The hour after sunrise and the hour or two before sunset — golden hour — give the softest, warmest, most flattering light, and it's the most romantic window for couples photos. Late-afternoon light turns warm and golden as the sun drops; morning light is gentle and locations are quieter.",
          "Midday is brighter and more contrasty, but it's far from unusable: shade, architecture, and tree cover let us keep the light even. Golden hour is a wonderful default, not a mandatory rule.",
        ],
      },
      {
        h2: "Blue hour and moodier looks",
        paras: [
          "The soft window just after sunset — blue hour — and overcast skies can produce calm, cinematic, intimate photos. If you're drawn to a moodier feel rather than bright and sunny, these conditions are a feature, not a problem.",
        ],
      },
      {
        h2: "Fog, wind, and the seasons",
        paras: [
          "San Francisco weather is its own variable. Summer often brings afternoon fog and wind near the water, while fall frequently delivers some of the clearest, calmest evenings of the year. Fog isn't a problem — at the coast and the bridge it can become a soft, romantic part of the photos.",
          "Sunset times shift through the year, so golden-hour sessions start earlier in fall and winter and later in summer. We factor the season's sunset into the start time when we plan.",
        ],
      },
      {
        h2: "Crowds and privacy",
        paras: [
          "Light isn't the only consideration — privacy matters too, especially if you feel self-conscious. Popular spots like the Palace of Fine Arts and Crissy Field are calmer on weekday mornings and evenings than on sunny weekends. We balance good light against how busy a location is likely to be.",
        ],
      },
      {
        h2: "We'll choose it together",
        paras: [
          "Once you've picked a date and location, we settle on a start time based on the season's sunset, the forecast, the crowds, and the mood you want — so the timing serves both the photos and the two of you.",
        ],
      },
    ],
  },
};

export const SUPPORTING_SLUGS = Object.keys(SUPPORTING_TOPICS);

export function getSupportingTopic(slug: string): SupportingTopic | null {
  return SUPPORTING_TOPICS[slug] ?? null;
}
