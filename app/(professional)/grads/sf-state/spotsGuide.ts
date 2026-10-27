import type { SchoolSpotsGuide } from "@/app/components/schoolSpotsGuideTypes";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import { SF_OFF_CAMPUS_SPOTS } from "../sfOffCampus";

// The SF State photo location guide (/grads/sf-state/spots). Written from
// Chris's own SF State sessions; landmark names and locations checked against
// SF State's own pages (Garden of Remembrance, Gator Spirit Statue).
//
// Internal notes (never published):
// - The route is a photography checklist, not a measured shortest walk. Check
//   the order against maps.sfsu.edu before stating one.
// - The ~15-minute wait at the sign is Chris's own experience, framed as such.
// - Prices come from the pricing catalog; never type an amount here.
// - Not stated on purpose: parking, transit, walking times, clock times,
//   sun angles at specific buildings, and interior photography of any building.
const { secondLocation, extra30Minutes } = PRICING_CATALOG.graduation.addOns;

export const spotsGuide: SchoolSpotsGuide = {
  metaTitle: "Best SFSU Graduation Photo Locations",
  metaDescription:
    "Discover the best SFSU graduation photo spots, plus beautiful San Francisco locations like the Palace of Fine Arts, Legion of Honor, and Golden Gate Bridge.",
  keywords: [
    "SFSU graduation photographer",
    "SFSU graduation photos",
    "San Francisco State graduation photographer",
    "SFSU graduation photo locations",
    "SF State graduation pictures",
    "best SFSU graduation photo spots",
    "SFSU sign graduation photos",
    "SFSU graduation photoshoot",
    "Palace of Fine Arts graduation photos",
    "San Francisco graduation photography locations",
    "Golden Gate Bridge graduation pictures",
    "SFSU graduation photography guide",
  ],
  h1: "Best SFSU Graduation Photo Locations",
  intro: [
    "San Francisco State University has some great spots for graduation photography, from the iconic campus entrance sign to the main quad, library, and surrounding greenery.",
    "One thing I particularly like about photographing graduates at SF State is how flexible the campus can be. Unlike some of the busier universities around the Bay Area, SF State generally has fewer crowds gathering for graduation pictures, making it easier to move between locations and capture a variety of portraits.",
    "Another advantage is San Francisco itself. Many of my SF State graduates choose to combine their campus photos with locations like the Palace of Fine Arts, Legion of Honor, or the Golden Gate Bridge. Whether you want traditional campus portraits or something with beautiful San Francisco scenery, there are plenty of options for a graduation gallery that feels personal to you.",
    "In this guide, I'll share my favorite locations, my recommendations for lighting, and how I like to plan SFSU graduation sessions.",
  ],
  mustHaveHeading: "The five SF State campus spots at a glance",
  mustHaveIntro:
    "The entrance sign at 19th and Holloway is the one I almost always include. The quad, the library, the Gator, and the Garden of Remembrance add architecture, school spirit, and greenery.",
  mustHaveKeys: [
    "sfsu-entrance-sign", "sfsu-main-quad", "j-paul-leonard-library", "sfsu-gator-statue", "garden-of-remembrance",
  ],
  spotsHeading: "My favorite on-campus SFSU graduation photo spots",
  bestTime: {
    heading: "When Is the Best Time to Take SFSU Graduation Photos?",
    paragraphs: [
      "My favorite times for SFSU graduation photography are sunrise and golden hour before sunset.",
      "However, one of the things I love about photographing in San Francisco is that cloudy weather can actually be excellent for portraits. When the sky is overcast, the clouds help diffuse the sunlight, creating softer lighting and reducing harsh shadows on your face.",
      "That means we can often get beautiful graduation photos even at midday or in the afternoon. If it's cloudy, I generally prefer starting earlier in the day, but we have much more flexibility than we would under direct midday sun.",
    ],
    lists: [
      {
        label: "Sunny days",
        items: [
          "Sunrise is excellent.",
          "Golden hour before sunset is excellent.",
          "I avoid harsh overhead midday sun when possible.",
        ],
      },
      {
        label: "Cloudy days",
        items: [
          "Morning sessions can look beautiful.",
          "Midday sessions often work well.",
          "Afternoon sessions work well too.",
          "When your schedule is flexible, I lean toward earlier sessions.",
        ],
      },
    ],
    weather:
      "Clouds don't automatically mean perfect light: heavy cloud cover can make it quite dark, and San Francisco weather can change during a session. I can't promise sunshine or sunset colors, so we'll watch the forecast together and adjust the plan as your date gets closer.",
    // San Francisco city center, only used to compute approximate sunset
    // times; never published.
    sunsetCoords: { latitude: 37.7749, longitude: -122.4194 },
  },
  route: {
    navLabel: "Campus route",
    heading: "My Recommended SFSU Graduation Photo Route",
    intro: [
      "If you're planning to take your graduation photos entirely on the SF State campus, I recommend including the entrance sign, the quad, the library, the Gator statue, and the Garden of Remembrance. Together they give us a good variety of backgrounds: classic campus landmarks, architecture, school spirit, and greenery.",
      "My goal is to move efficiently between locations while leaving enough time for both classic graduation portraits and more natural photos. These are the stops I plan around:",
    ],
    steps: [
      { spotKey: "sfsu-entrance-sign", text: "The SFSU entrance sign at 19th and Holloway." },
      { spotKey: "sfsu-main-quad", text: "The main quad." },
      { spotKey: "j-paul-leonard-library", text: "The outside of the J. Paul Leonard Library." },
      { spotKey: "sfsu-gator-statue", text: "The Gator statue at Don Nasser Family Plaza." },
      { spotKey: "garden-of-remembrance", text: "The Ruth Asawa Garden of Remembrance." },
    ],
    notes: [
      "This is a checklist of stops, not a fixed walking order. I arrange it around where we meet, the light, the time we have, and how busy each spot is on the day.",
      "For a shorter session, I prioritize the entrance sign and then pick a few of the other campus spots based on what matters most to you, rather than rushing through all five.",
    ],
  },
  offCampus: {
    navLabel: "Off campus",
    heading: "Want Something Different? My Favorite Off-Campus Locations for SFSU Graduation Photos",
    intro: [
      "One of the best things about graduating from San Francisco State is having the rest of San Francisco available for your graduation pictures. A lot of my SF State clients choose to take some or all of their graduation photos somewhere beyond campus.",
      "Whether you're looking for beautiful architecture, waterfront scenery, or the Golden Gate Bridge in the background, there are plenty of places to choose from. Here are my favorites.",
    ],
    spots: [...SF_OFF_CAMPUS_SPOTS],
  },
  plans: {
    navLabel: "Multiple locations",
    heading: "Can I Take SFSU Graduation Photos at Multiple Locations?",
    intro: [
      "Absolutely! One thing I love about photographing SF State graduates is that we don't have to limit the session to campus.",
      "Some graduates prefer to capture traditional photos at SFSU before traveling to another San Francisco location, like the Palace of Fine Arts, the Legion of Honor, or a spot overlooking the Golden Gate Bridge. Others skip campus entirely and spend their session at one of these places instead.",
      "I've also photographed graduation sessions with several destinations, including sessions with as many as four locations. It really depends on the experience and the variety of photos you're looking for.",
    ],
    optionsHeading: "Example session plans",
    options: [
      { label: "Option A", title: "Traditional SFSU graduation", body: "SF State campus only: the entrance sign, quad, library, Gator, and garden." },
      { label: "Option B", title: "SFSU + Palace of Fine Arts", body: "Traditional graduation photos on campus, then architectural portraits at the Palace." },
      { label: "Option C", title: "SFSU + Legion of Honor", body: "Campus portraits combined with the elegant architecture of the Legion of Honor." },
      { label: "Option D", title: "SFSU + Golden Gate Bridge", body: "Start at SF State, then finish with scenic photos at Crissy Field or near the Golden Gate Bridge Welcome Center." },
      { label: "Option E", title: "San Francisco without campus", body: "One or more off-campus locations, with no stop at SFSU." },
    ],
    notesHeading: "Pricing and logistics",
    notes: [
      `A second nearby location is currently a $${secondLocation.price} add-on. For three or four stops, I'll confirm the add-ons, coverage time, and travel with you before you book.`,
      `Travel between stops takes time from the session, so multi-location plans usually need extra coverage. An extra 30 minutes is currently $${extra30Minutes.price}.`,
      "A four-location session needs much more than basic coverage, so we'll plan the time around the stops you choose instead of squeezing them in.",
    ],
    cta: {
      heading: "Planning Graduation Photos at Multiple Locations?",
      body: "I'd love to help you create a session that combines your favorite San Francisco locations. When you reach out, mention the spots you'd like to include, and I'll help plan the session around them.",
      label: "Plan my SFSU session",
    },
  },
  sections: [
    {
      id: "crowds",
      navLabel: "Crowds",
      heading: "How Busy Is SFSU During Graduation Season?",
      paragraphs: [
        "Compared with some of the other universities I photograph around the Bay Area, SF State generally feels less crowded during graduation photo sessions. Most of the time, it's relatively easy to move between campus locations without waiting long.",
        "The biggest exception is the main SFSU entrance sign at 19th Avenue and Holloway Avenue. As graduation approaches, more students gather there for cap-and-gown photos. In my experience the wait usually isn't too bad, and I generally haven't waited longer than around 15 minutes, but that can change with the day and how many graduates are out taking pictures.",
        "If we're including off-campus places like the Palace of Fine Arts, I recommend weekdays when possible, because those locations can draw many tourists and photographers.",
      ],
      bulletsLabel: "Key recommendations",
      bullets: [
        "Consider a weekday for off-campus photos.",
        "Avoid the busiest commencement days when possible.",
        "Be ready for an occasional wait at the SFSU sign.",
        "Expect tourist destinations to be much busier than campus.",
        "Plan extra time for multiple destinations.",
        "Keep the plan flexible.",
      ],
    },
    {
      id: "rules",
      navLabel: "Location rules",
      heading: "Campus and Location Rules",
      paragraphs: [
        "Every SF State photo I recommend in this guide is taken outdoors, including at the J. Paul Leonard Library, where we photograph the outside of the building.",
        "The Garden of Remembrance is a memorial. We keep to the paths, never climb the rocks or step into the plantings, and give other visitors space.",
        "Access rules, closures, and events at campus and city locations can change, so I check current conditions before your session and adjust the plan if a spot is unavailable.",
      ],
      links: [
        { label: "SF State campus map", href: "https://maps.sfsu.edu/" },
        { label: "About the Garden of Remembrance", href: "https://gallery.sfsu.edu/about-the-garden" },
        { label: "Palace of Fine Arts (SF Rec & Park)", href: "https://recpark.sf.gov/Facilities/Facility/Details/Palace-of-Fine-Arts-423" },
        { label: "Crissy Field", href: "https://www.parksconservancy.org/parks/crissy-field" },
        { label: "Golden Gate Bridge Welcome Center", href: "https://presidio.gov/explore/attractions/golden-gate-bridge-welcome-center" },
      ],
    },
  ],
  tips: [
    {
      title: "Tell me your must-have spots",
      body: "Let me know which campus spots or San Francisco places matter most to you, and I'll plan the session around them.",
    },
    {
      title: "Bring comfortable shoes",
      body: "Comfortable walking shoes help, especially for multi-location sessions. You can switch into your favorite pair for the photos.",
    },
    {
      title: "Prepare your graduation outfit",
      body: "Bring your cap, gown, stole, cords, and any meaningful accessories you'd like in your photos.",
    },
    {
      title: "Bring a layer",
      body: "The west side of San Francisco often runs cooler and breezier than downtown, so a jacket for between shots helps.",
    },
  ],
  faqs: [
    { q: "Where are the best places to take graduation photos at SFSU?", a: "My favorite on-campus locations are the SFSU entrance sign at 19th and Holloway, the main quad, the J. Paul Leonard Library, the Gator statue, and the Garden of Remembrance." },
    { q: "What's the best time for SFSU graduation pictures?", a: "I recommend sunrise or golden hour on sunny days. Cloudy days can also give beautiful, soft light, which makes morning, midday, and afternoon sessions possible." },
    { q: "Does cloudy weather ruin graduation pictures?", a: "Not at all! Cloudy skies can actually help, because they diffuse sunlight and soften shadows. That's one reason SFSU graduation sessions can be flexible with timing. Very heavy clouds can make it dark, so we'll keep an eye on the forecast." },
    { q: "Is SFSU crowded during graduation season?", a: "In my experience, SFSU is generally less crowded than some other universities. The main entrance sign can get busy, especially close to graduation, but the waits are often manageable." },
    { q: "Can I take SFSU graduation photos at the Palace of Fine Arts?", a: "Absolutely! Many SF State graduates take their photos at the Palace of Fine Arts, either instead of campus or as an additional location." },
    { q: "Can we take graduation pictures at both SFSU and the Golden Gate Bridge?", a: "Yes! We can plan a multi-location session that includes SF State and a Golden Gate Bridge location, depending on your session length and schedule." },
    { q: "Can I choose more than one location?", a: "Yes! You can add locations to your session, with the coverage time, travel, and add-on fees that go with them. I'll confirm everything before you book." },
    { q: "What if I want to take graduation photos somewhere other than SFSU?", a: "That's completely fine! Some graduates spend their whole session at the Palace of Fine Arts, the Legion of Honor, Crissy Field, or another San Francisco landmark." },
    { q: "What should I bring to my graduation session?", a: "Bring your graduation cap, gown, stole, cords, and any meaningful accessories you'd like in your pictures. Comfortable walking shoes help too, especially for multi-location sessions." },
    { q: "Will you help me pose?", a: "Absolutely! I'll guide you through the session and help with both classic graduation poses and natural, candid photos." },
  ],
};
