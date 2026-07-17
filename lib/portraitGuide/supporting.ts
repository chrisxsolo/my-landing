// lib/portraitGuide/supporting.ts
// Content for the portrait-guide supporting article pages (what-to-wear,
// how-to-prepare, what-to-expect, best-time-for-portraits). One config per page
// feeds a shared server-rendered template (PortraitSupportingArticle), and a
// short `hubPreview` feeds the concise summary on the main /portrait-guide hub —
// so the full text lives here once and the hub only teases it.
//
// What-to-expect intentionally avoids inventing business specifics (prices,
// counts, session lengths, outfit allowances) — there is no portraits entry in
// PRICING_CATALOG, so these pages link to the pricing hub and the contact page
// instead of stating numbers. Mirrors lib/couplesGuide/supporting.ts.

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
    metaTitle: "What to Wear for Portrait Photos in San Francisco",
    metaDescription:
      "What to wear for a San Francisco portrait session — choosing colors for the location, layering for Bay Area wind and fog, outfits for branding photos, and dressing like yourself.",
    kicker: "Portrait guide · Outfits",
    h1: "What to Wear for Your Portrait Session",
    intro:
      "The right outfit for portraits is the one that looks like you on a great day — comfortable enough to move in, simple enough that nothing competes with your face. You don't need a stylist or a shopping trip; a few deliberate choices go a long way, especially outdoors in San Francisco.",
    hubPreview:
      "Solid colors that suit the location, texture and layers for depth, comfort you can move in — and your real style, one step more put-together.",
    sections: [
      {
        h2: "Start with solids and simple silhouettes",
        paras: [
          "In a portrait, your face is the subject — everything else supports it. Solid colors and clean silhouettes keep the eye on you, while loud patterns, large logos, and busy graphics pull attention away.",
          "Soft neutrals and earth tones — cream, sand, sage, rust, denim, warm browns — photograph beautifully against Bay Area greenery, stone, and shoreline. Deeper tones like black, navy, and forest read polished and editorial.",
        ],
      },
      {
        h2: "Dress for the location",
        paras: [
          "The setting changes what works. Architectural backdrops like the Palace of Fine Arts reward structured, elevated outfits. Golden Gate Park and Baker Beach lean natural and relaxed, with fabrics that move. The Mission's murals love simple outfits in one or two tones that complement — not compete with — the color behind you.",
          "If you're unsure, tell me where we're shooting and I'll point you toward a palette that flatters the scenery.",
        ],
      },
      {
        h2: "Dressing for branding and professional portraits",
        paras: [
          "For personal-branding sessions, wear what you'd actually wear to meet a client or walk into your workplace — photos of the authentic, professional you will serve your profiles better than a costume. Bring the one layer that instantly sharpens an outfit, like a blazer or structured jacket.",
          "If your work has a uniform, a tool, or a setting that identifies it, we can plan a few frames around it. The goal is that people who meet you after seeing the photos feel like they've already met you.",
        ],
      },
      {
        h2: "Use texture and layers",
        paras: [
          "Texture adds depth that flat blocks of color can't — knits, linen, denim, a light jacket, or flowing fabric give photos a richer, more tactile feel and help an outfit read as intentional.",
          "Layers are also practical: San Francisco runs cooler and windier than people expect, so a sweater or jacket keeps you comfortable and doubles as a styling element. Bring a backup layer even on a sunny day.",
        ],
      },
      {
        h2: "Keep it comfortable and like you",
        list: [
          "Choose clothes you can move, sit, and walk in — comfort shows in your expressions.",
          "Skip large logos and tight, distracting patterns that pull the eye.",
          "Wear shoes you can walk in; many locations involve grass, sand, or city blocks.",
          "Pick outfits that feel like your normal style, just a step more put-together.",
          "If you'd like an outfit change, ask ahead — whether there's time depends on the session; check the pricing page or just ask.",
        ],
      },
      {
        h2: "Hair, accessories, and don't overthink it",
        paras: [
          "Hair and makeup are entirely up to you — there's no requirement to do anything formal. If we're shooting somewhere windy like Baker Beach, plan a style that moves well rather than one that must stay perfectly in place. Simple, meaningful accessories photograph well; a pile of competing pieces distracts.",
          "Lay the outfit out the night before, check it as a whole, then let it go. If something feels off, send me a quick photo and I'll help.",
        ],
      },
    ],
  },

  "how-to-prepare": {
    slug: "how-to-prepare",
    metaTitle: "How to Prepare for a Portrait Session in San Francisco",
    metaDescription:
      "How to prepare for a Bay Area portrait session — choosing a location and mood, what to bring, planning for weather and wind, and showing up relaxed so the photos feel natural.",
    kicker: "Portrait guide · Preparation",
    h1: "How to Prepare for Your Portrait Session",
    intro:
      "A little preparation makes a portrait session feel easy instead of nerve-racking. None of it is complicated — it mostly comes down to choosing a setting that feels like you, planning around the weather, and showing up rested. I guide the posing throughout, so there's nothing to rehearse.",
    hubPreview:
      "Pick a location and mood that feel like you, plan outfits and layers, allow travel time, and come ready to relax — I guide the rest.",
    sections: [
      {
        h2: "Choose a location and a mood",
        paras: [
          "Start with the feeling you want the photos to have — natural and soft, urban and confident, colorful and creative, or dramatic and cinematic — then pick a setting that fits. The portrait location guides walk through what each San Francisco spot does best, and we'll choose together based on your style and what the photos are for.",
          "Tell me the purpose, too: a personal milestone, your business and profiles, a creative refresh, or simply wanting good photos of yourself. It changes how I plan the pacing and the kinds of frames we prioritize.",
        ],
      },
      {
        h2: "Plan outfits and layers",
        paras: [
          "Decide on your outfit a few days ahead so it isn't a morning-of scramble. Because San Francisco is often cool and breezy, bring a backup layer even when the forecast looks warm. The what-to-wear guide covers palettes and location-specific ideas.",
        ],
      },
      {
        h2: "Bring the essentials",
        list: [
          "Water, and a small snack if it's a longer session.",
          "A backup layer for wind and cooler temperatures.",
          "Comfortable shoes for walking, sand, or city blocks.",
          "A quick wipe for glasses, watches, or phone screens that show in close-ups.",
          "Anything that tells your story — an instrument, a tool of your trade, a meaningful object — only if it genuinely adds to the photos.",
        ],
      },
      {
        h2: "Allow time and check the weather",
        paras: [
          "Build in a buffer for parking and walking to the meeting point so you arrive unhurried — rushing sets a frazzled tone that takes a while to shake. I'll send the exact meeting spot beforehand so there's no guessing on the day.",
          "Check the forecast the day before and dress for temperature and wind. Fog isn't a problem — it's soft, flattering light. If conditions look genuinely bad, we'll talk ahead of time and make a plan together.",
        ],
      },
      {
        h2: "Come ready to relax",
        paras: [
          "You don't need to practice poses in the mirror. The most natural portraits come when you stop performing and let me direct — walking, small prompts, resets whenever anything feels stiff. The first few minutes feel a little awkward for almost everyone, and that passes quickly once we get moving.",
        ],
      },
    ],
  },

  "what-to-expect": {
    slug: "what-to-expect",
    metaTitle: "What to Expect from a Portrait Session in San Francisco",
    metaDescription:
      "What to expect from a San Francisco portrait session with SoloXSnaps — from inquiry and planning to a guided shoot mixing directed portraits and candid moments, professional editing, and a private gallery.",
    kicker: "Portrait guide · Process",
    h1: "What to Expect from Your Portrait Session",
    intro:
      "Knowing how a session flows takes the mystery — and the nerves — out of it. Here's the general path from your first message to the finished gallery, with guidance from me at every step, so you can just show up and be yourself.",
    hubPreview:
      "From inquiry to a private gallery — planning, a guided shoot mixing directed portraits and candid moments, then professional editing.",
    sections: [
      {
        h2: "The session, step by step",
        ordered: true,
        list: [
          "You send an inquiry with your ideal date, what the photos are for, and any location ideas.",
          "We choose the date and location together.",
          "We confirm the session option that fits what you want.",
          "I send an invoice and agreement; a retainer reserves the date where required.",
          "I send preparation guidance and, before the session, the exact meeting point.",
          "On the day, I guide posing, movement, and pacing so it stays relaxed.",
          "We capture a mix of directed portraits and candid, in-between moments.",
          "Your images are professionally edited.",
          "You receive a private online gallery to download and share.",
        ],
      },
      {
        h2: "A guided, relaxed shoot",
        paras: [
          "You don't need to know how to pose — that's my job, and it matters double in a solo session where all the direction lands on you. I tell you where to stand, what to do with your hands, where to look, and I keep prompts moving so you're doing rather than holding still.",
          "It's a mix, not one note: some composed, looking-at-the-camera portraits, some walking and movement, and some quiet candid frames. If you're camera-shy, say so — it's the most common thing clients tell me, and the session is built around it.",
        ],
      },
      {
        h2: "Pricing, delivery, and the details",
        paras: [
          "Session options, what's included, turnaround, and booking policies are kept current on the pricing page and confirmed when you inquire — I point you there rather than restating numbers here so the details are always accurate. Tell me what the photos are for and I'll recommend the option that fits.",
        ],
      },
    ],
  },

  "best-time-for-portraits": {
    slug: "best-time-for-portraits",
    metaTitle: "Best Time for Portrait Photos in San Francisco",
    metaDescription:
      "The best time for portrait photos in San Francisco — golden hour vs. morning, open shade at midday, fog and wind, weekday crowds, and why the right time depends on the location and mood.",
    kicker: "Portrait guide · Timing",
    h1: "Best Time for Portrait Photos",
    intro:
      "The best time for portraits depends on two things: the light and the look you want. Here's how to weigh both — along with San Francisco's fog, wind, and crowds — so your session lands in a window that flatters you and suits the setting.",
    hubPreview:
      "Golden hour gives the softest light, but shaded locations work all day — the best time balances light, crowds, and the mood you want.",
    sections: [
      {
        h2: "Golden hour and morning light",
        paras: [
          "The hour after sunrise and the hour or two before sunset — golden hour — give the softest, warmest, most flattering light for faces. Late afternoon turns open locations like Baker Beach and the waterfront golden; mornings are gentle and blissfully quiet.",
          "Golden hour is a wonderful default, not a rule. Some of the most reliable portrait light in the city is open shade — which brings us to midday.",
        ],
      },
      {
        h2: "Midday and open shade",
        paras: [
          "Shaded settings — Golden Gate Park's canopy, the Palace of Fine Arts colonnade, the Mission's painted alleys — hold soft, even light through the middle of the day. That makes midday sessions genuinely good at the right location, and it's why the location and the time get chosen together.",
          "If your schedule only allows midday, don't worry: we'll simply pick a spot where the light stays kind.",
        ],
      },
      {
        h2: "Blue hour and moodier looks",
        paras: [
          "The soft window just after sunset — blue hour — and overcast skies produce calm, cinematic portraits. If your taste runs moodier or more editorial than bright-and-sunny, those conditions are a feature, not a compromise.",
        ],
      },
      {
        h2: "Fog, wind, and the seasons",
        paras: [
          "San Francisco weather is its own variable. Summer often brings afternoon fog and wind near the coast while the Mission stays sunny; fall frequently delivers the clearest, calmest evenings of the year. Fog is soft, even, flattering light — at the coast it can turn a session cinematic.",
          "Sunset times shift through the year, so golden-hour sessions start earlier in fall and winter and later in summer. We factor the season's sunset into the start time when we plan.",
        ],
      },
      {
        h2: "Crowds and privacy",
        paras: [
          "Light isn't the only consideration — privacy matters, especially if being photographed in public makes you self-conscious. Popular spots are calmer on weekday mornings than on sunny weekends, and part of choosing the time is choosing how much audience you're comfortable with.",
        ],
      },
      {
        h2: "We'll choose it together",
        paras: [
          "Once you've picked a date and location, we settle on a start time based on the season's sunset, the forecast, the crowds, and the mood you want — so the timing serves both the photos and your comfort.",
        ],
      },
    ],
  },
};

export const SUPPORTING_SLUGS = Object.keys(SUPPORTING_TOPICS);

export function getSupportingTopic(slug: string): SupportingTopic | null {
  return SUPPORTING_TOPICS[slug] ?? null;
}
