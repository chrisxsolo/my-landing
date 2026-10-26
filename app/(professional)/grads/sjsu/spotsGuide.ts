import type { SchoolSpotsGuide } from "@/app/components/schoolSpotsGuideTypes";

// The SJSU photo location guide (/grads/sjsu/spots). Written from Chris's own
// SJSU sessions. Deliberately left out until verified: the sign's exact spot on
// campus, building orientations / sun angles, parking, access rules, permits,
// walking times, and commencement dates.
export const spotsGuide: SchoolSpotsGuide = {
  metaTitle: "Best SJSU Graduation Photo Locations",
  metaDescription:
    "Discover the best SJSU graduation photo spots, including Tower Hall, the Student Union, and 7th Street. Tips from a San Jose State graduation photographer.",
  keywords: [
    "SJSU graduation photographer",
    "SJSU graduation photos",
    "San Jose State graduation photographer",
    "SJSU graduation photo locations",
    "best places for SJSU graduation pictures",
    "Tower Hall graduation photos",
    "San Jose State graduation pictures",
    "SJSU graduation photoshoot",
    "SJSU golden hour photography",
  ],
  h1: "The Best Places for SJSU Graduation Photos",
  intro: [
    "San Jose State University has some fantastic locations for graduation photography, from its palm-lined walkways to the historic architecture surrounding Tower Hall.",
    "After photographing graduates around SJSU, I've found that a few locations consistently stand out for their backgrounds, their light, and their connection to the university.",
    "Whether you want traditional cap-and-gown portraits or something more natural and candid, these are the spots I'd recommend for your SJSU graduation session.",
  ],
  mustHaveIntro:
    "If we only get to three spots, these are the ones: the SJSU sign, Tower Hall Lawn, and the Student Union on 7th Street.",
  spotsHeading: "My five favorite SJSU graduation photo spots",
  bestTime: {
    heading: "When is the best time to take graduation photos at SJSU?",
    paragraphs: [
      "My favorite times to photograph graduation sessions at SJSU are golden hour and sunrise.",
      "Golden hour happens shortly before sunset, when the sun is lower in the sky and the light tends to be softer and warmer. That makes for more flattering portraits and beautiful natural light around campus.",
      "Sunrise is another excellent option, especially if you prefer an early-morning session. It's also a chance to photograph the popular landmarks before the busiest part of the day, although quiet conditions aren't guaranteed.",
      "I generally recommend avoiding midday when possible. Direct overhead sunlight creates harsh shadows on the face and makes portraits more challenging.",
      "For the best results, plan your session around sunrise or roughly the hour before sunset. The light on the day still depends on the season, the weather, and shade from buildings and trees, so not every spot looks the same at the same moment. I plan the order of stops around the conditions on your date.",
    ],
    weather:
      "San Jose generally has a relatively warm climate, which makes outdoor graduation photos appealing for much of the year. No forecast is guaranteed, though, so we'll keep an eye on the weather together as your date gets closer.",
    // Downtown San Jose (city center, not a campus landmark) — only used to
    // compute approximate sunset times; never published.
    sunsetCoords: { latitude: 37.3382, longitude: -121.8863 },
  },
  route: {
    heading: "My Recommended One-Hour SJSU Graduation Photo Route",
    intro: [
      "I recommend a 60-minute graduation session at SJSU. An hour is a great starting point for capturing several of the campus's most recognizable spots, with time for both classic portraits and relaxed, candid photos.",
      "Here's the order I usually start from:",
    ],
    steps: [
      { spotKey: "student-union", text: "Start in front of the Student Union on 7th Street." },
      { spotKey: "seventh-street-palms", text: "Walk along 7th Street with the palm trees." },
      { spotKey: "tower-hall-lawn", text: "Move toward Tower Hall Lawn." },
      { spotKey: "tower-hall-steps", text: "Capture portraits around the lawn and the nearby steps." },
      { spotKey: "sjsu-sign", text: "Include the SJSU sign, an essential stop." },
    ],
    notes: [
      "This is a suggested order, not a fixed walking route. I rearrange it around the light, crowds, walking distance, and where we meet, and the SJSU sign can come earlier or later depending on the day.",
      "If time gets tight, the three must-haves come first: the SJSU sign, Tower Hall Lawn, and the Student Union. How much we fit beyond that depends on things like outfit changes, group shots, and how busy campus is.",
    ],
  },
  tips: [
    {
      title: "Avoid graduation week when possible",
      body: "The most popular landmarks get extremely busy during graduation week. If your schedule is flexible, consider a date before the biggest celebrations.",
    },
    {
      title: "Choose sunrise or sunset",
      body: "The light is generally more flattering in the early morning or the hour before sunset than in direct midday sun.",
    },
    {
      title: "Bring comfortable shoes",
      body: "We'll walk between several campus spots, so comfortable shoes help. You can switch into your favorite shoes for the photos themselves.",
    },
    {
      title: "Prepare your graduation outfit",
      body: "Bring your cap, gown, stole, cords, and any meaningful accessories you'd like in the photos.",
    },
    {
      title: "Keep it relaxed",
      body: "A great session mixes traditional portraits with natural moments. I give posing direction the whole way through, so you don't need any modeling experience.",
    },
    {
      title: "Stay flexible",
      body: "Crowds, weather, and changing light can shift the order we visit each spot. That's normal, and I'll plan around it on the day.",
    },
  ],
  faqs: [
    { q: "Where should I take my SJSU graduation pictures?", a: "My top recommendations are the SJSU sign, Tower Hall Lawn, and the area in front of the Student Union. The palm trees along 7th Street and the steps near Tower Hall are also excellent options." },
    { q: "What time is best for SJSU graduation pictures?", a: "I recommend golden hour before sunset, or sunrise. Both give you beautiful natural light, while midday sun is generally less flattering." },
    { q: "Is one hour enough for SJSU graduation photos?", a: "Yes! I recommend a 60-minute graduation session at SJSU. It's enough time to capture a variety of portraits at several campus locations when the session is planned efficiently." },
    { q: "Should I take graduation photos during graduation week?", a: "I recommend avoiding the busiest parts of graduation week when possible, because popular landmarks can get crowded." },
    { q: "What should I bring to my SJSU graduation photoshoot?", a: "Bring your graduation cap, gown, stole, cords, and any personal accessories you'd like to include. Comfortable walking shoes and water are also helpful." },
    { q: "Do I need to know how to pose?", a: "Not at all! I'll guide you through the session and help with both natural poses and classic graduation photos." },
  ],
};
