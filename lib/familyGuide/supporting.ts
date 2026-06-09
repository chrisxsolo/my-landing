// lib/familyGuide/supporting.ts
// Content for the family-guide supporting article pages (what-to-wear,
// how-to-prepare, what-to-expect, best-time-for-family-photos). One config per
// page feeds a shared server-rendered template (FamilySupportingArticle), and a
// short `hubPreview` feeds the concise summary on the main /family-guide hub —
// so the full text lives here once and the hub only teases it.
//
// What-to-expect intentionally avoids inventing business specifics (prices,
// counts, turnaround). Those live on the family pricing page and the FAQ, which
// pull from PRICING_CATALOG; this page links there instead of restating numbers.

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
    metaTitle: "What to Wear for Family Photos in San Francisco",
    metaDescription:
      "What to wear for San Francisco family photos — how to coordinate colors without matching, layering for Bay Area wind and fog, and dressing kids comfortably for an outdoor session.",
    kicker: "Family guide · Outfits",
    h1: "What to Wear for Family Photos",
    intro:
      "The goal with family outfits is simple: everyone looks like they belong together, no one is uncomfortable, and nothing competes with your faces. You don't need a perfect plan — a few easy choices go a long way, especially for outdoor sessions in San Francisco and the Bay Area.",
    hubPreview:
      "Coordinate without matching — choose a few complementary colors, layer textures, and dress for Bay Area wind and comfort.",
    sections: [
      {
        h2: "Coordinate, don't match",
        paras: [
          "Matching outfits (everyone in the same shirt and jeans) tend to look dated and flatten the group. Coordinating looks more natural: pick a palette of two to four colors that sit well together, then let each person wear a different piece within it.",
          "Soft neutrals and earth tones — cream, sand, sage, denim, muted blues, warm browns — photograph beautifully against Bay Area greenery, stone, and shoreline. Add gentle contrast so no one disappears into the background.",
        ],
      },
      {
        h2: "Use texture and layers",
        paras: [
          "Texture adds depth that solid blocks of color can't. Knits, linen, corduroy, a light jacket, or a scarf give photos a richer, more tactile feel and help layered outfits read as intentional rather than busy.",
          "Layers are also practical here: San Francisco runs cooler and windier than people expect, so a sweater or light jacket keeps everyone comfortable and doubles as a styling element.",
        ],
      },
      {
        h2: "Keep it comfortable and practical",
        list: [
          "Choose clothing people can move, sit, and bend in — comfort shows in expressions.",
          "Skip large logos and tight, distracting patterns that pull the eye.",
          "Wear shoes you can walk in; some locations involve grass, sand, or natural paths.",
          "For young kids, pack a simple backup outfit in case of spills.",
          "Plan outfits around your location — beach, architecture, and redwoods each suit slightly different palettes.",
        ],
      },
      {
        h2: "Don't overthink it",
        paras: [
          "Overly strict rules make families anxious, and anxious families are harder to photograph. Lay outfits out together the night before to check they work as a group, then let it go. If something feels off, send me a quick photo and I'm happy to help.",
        ],
      },
    ],
  },

  "how-to-prepare": {
    slug: "how-to-prepare",
    metaTitle: "How to Prepare for a Family Photo Session",
    metaDescription:
      "How to prepare for a Bay Area family photo session — timing around kids' schedules, snacks and essentials to bring, and arriving relaxed so the session goes smoothly.",
    kicker: "Family guide · Preparation",
    h1: "How to Prepare for Your Family Session",
    intro:
      "A little preparation makes family sessions feel easy instead of stressful — especially with young kids. None of this is complicated; it mostly comes down to good timing, a few essentials, and showing up relaxed.",
    hubPreview:
      "Time it around naps and meals, bring snacks and wipes, allow extra travel time, and let kids warm up at their own pace.",
    sections: [
      {
        h2: "Time it around your kids",
        paras: [
          "The single biggest factor with children is timing. Aim for a window when little ones are usually rested and recently fed — a tired or hungry child is tough to photograph no matter how good the light is. We can choose a session time that fits naps and meals.",
        ],
      },
      {
        h2: "Bring the essentials",
        list: [
          "Water and simple snacks (avoid anything that heavily stains faces or clothes).",
          "Wipes and a small towel for quick cleanups.",
          "A backup outfit for young kids.",
          "Any comfort item that helps a child feel settled — used sparingly.",
          "A meaningful object only if it genuinely adds to the photos.",
        ],
      },
      {
        h2: "Allow extra time",
        paras: [
          "Build in a buffer for parking and walking to the meeting point so you arrive unhurried — rushing tends to set a frazzled tone for the whole session. I'll send the exact meeting spot beforehand so there's no guessing on the day.",
        ],
      },
      {
        h2: "Let the session unfold",
        paras: [
          "Try not to over-prepare children or pressure them to perform — it usually backfires. Let them warm up, and let me lead with prompts and small activities. Some of the best frames happen in the in-between moments once everyone has relaxed.",
          "Check the weather the day before and dress for temperature and wind. If conditions look genuinely bad, we'll talk and make a plan together.",
        ],
      },
    ],
  },

  "what-to-expect": {
    slug: "what-to-expect",
    metaTitle: "What to Expect from a Family Photo Session",
    metaDescription:
      "What to expect from a San Francisco family photo session with SoloXSnaps — from inquiry and planning to a guided shoot, professional editing, and a private online gallery.",
    kicker: "Family guide · Process",
    h1: "What to Expect from Your Family Session",
    intro:
      "Knowing how a session flows takes the mystery out of it. Here's the general path from your first message to the finished gallery, with guidance from me at every step.",
    hubPreview:
      "From inquiry to a private gallery — planning, a guided shoot mixing posed and candid frames, then professional editing.",
    sections: [
      {
        h2: "The session, step by step",
        ordered: true,
        list: [
          "You send an inquiry with your date, who's joining, and any location ideas.",
          "We choose the date and location together.",
          "I send an invoice and agreement to reserve the date.",
          "We confirm timing and a meeting point before the session.",
          "On the day, I guide posing and activity prompts to keep things relaxed.",
          "We capture a mix of posed family portraits and candid, in-between moments.",
          "Your images are professionally edited.",
          "You receive a private online gallery to download and share.",
        ],
      },
      {
        h2: "A guided, relaxed shoot",
        paras: [
          "You don't need to know how to pose. I direct the session — where to stand, simple things to do, little games for the kids — so it feels like spending time together rather than performing. That's usually when the most natural expressions show up.",
        ],
      },
      {
        h2: "Pricing, delivery, and the details",
        paras: [
          "Session lengths, what's included, how many edited images you receive, turnaround time, retainer, and travel are all kept current on the family pricing page and the family FAQ. I point you there rather than restating numbers here so the details are always accurate.",
        ],
      },
    ],
  },

  "best-time-for-family-photos": {
    slug: "best-time-for-family-photos",
    metaTitle: "Best Time for Family Photos in San Francisco",
    metaDescription:
      "The best time for family photos in San Francisco — golden hour vs. morning, working around young kids, fall sunsets, fog, and why the right time depends on light and your family.",
    kicker: "Family guide · Timing",
    h1: "Best Time for Family Photos",
    intro:
      "The best time for family photos depends on two things: the light and your family. Here's how to weigh both so you choose a window that flatters everyone and still works for the kids.",
    hubPreview:
      "Golden hour gives the softest light, but the best time balances good light with your kids' schedule and the season.",
    sections: [
      {
        h2: "Golden hour and morning light",
        paras: [
          "The hour after sunrise and the hour or two before sunset — golden hour — give the softest, warmest, most flattering light. Morning light is gentle and locations are quieter; late-afternoon light is warm and golden as the sun drops.",
          "Midday is brighter and more contrasty, but it's far from unusable: shade, architecture, and tree cover let us keep light even, which matters when a young child's schedule rules out golden hour.",
        ],
      },
      {
        h2: "Work around young kids",
        paras: [
          "Great light at the wrong time of day rarely beats a well-rested, fed child. If golden hour clashes with naps or bedtime, a morning or midday session usually produces happier, more natural photos. The 'best' time is the one your family can show up to relaxed.",
        ],
      },
      {
        h2: "Fog, wind, and the seasons",
        paras: [
          "San Francisco weather is its own variable. Summer often brings afternoon fog and wind near the water; fall frequently delivers some of the clearest, calmest evenings of the year. Fog isn't a problem — it can become a soft, moody part of the photos.",
          "In fall, sunsets come earlier, so golden-hour sessions start sooner in the afternoon. Weekdays also tend to mean calmer, less crowded locations than weekends.",
        ],
      },
      {
        h2: "We'll choose it together",
        paras: [
          "Once you've picked a date and location, we settle on a start time based on the season's sunset, the forecast, the crowds, and your family's rhythm — so the timing serves both the photos and the people in them.",
        ],
      },
    ],
  },
};

export const SUPPORTING_SLUGS = Object.keys(SUPPORTING_TOPICS);

export function getSupportingTopic(slug: string): SupportingTopic | null {
  return SUPPORTING_TOPICS[slug] ?? null;
}
