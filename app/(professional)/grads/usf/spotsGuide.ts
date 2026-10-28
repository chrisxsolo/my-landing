import type { SchoolSpotsGuide } from "@/app/components/schoolSpotsGuideTypes";
import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import { SF_OFF_CAMPUS_SPOTS, sfOffCampusSpot } from "../sfOffCampus";

// The USF photo location guide (/grads/usf/spots). Written from Chris's own
// USF sessions. Four locations: the wolf sculpture is part of the Gleeson
// Library stop and the stairs are part of the Lone Mountain stop, never
// their own route steps. Landmark names checked against USF's own pages: St.
// Ignatius Church, Gleeson Library | Geschke Center, Los Lobos de Loyola by
// Pancho Cárdenas (installed in front of Gleeson in 2011), and Lone Mountain.
//
// Internal notes (never published):
// - The glass hallway's building is unconfirmed. The Lo Schiavo Center's
//   documented link to Harney is an underground corridor, not glass, so the
//   page keeps Chris's label "USF Glass Hallway" until he confirms it.
// - The student-ID requirement is Chris's experience; whether a professional
//   photographer may shoot inside, and USF's commercial-photography rules,
//   are unverified, so the page says access must be authorized.
// - The route is Chris's preferred order, not a measured walk: no durations.
// - Prices come from the pricing catalog; never type an amount here.
// - Off-campus places come only from the shared, verified San Francisco list
//   (../sfOffCampus, the same list as SF State). Never name another place.
// - Not stated on purpose: parking, transit, walking times, clock times, sun
//   angles at specific buildings, and interior church or library photography.
const { secondLocation, extra30Minutes } = PRICING_CATALOG.graduation.addOns;
const palace = sfOffCampusSpot("palace-of-fine-arts");
const legion = sfOffCampusSpot("legion-of-honor");

export const spotsGuide: SchoolSpotsGuide = {
  metaTitle: "Best USF Graduation Photo Locations",
  metaDescription:
    "Discover the best USF graduation photo spots, including Gleeson Library, St. Ignatius Church, and Lone Mountain, with lighting and photography tips.",
  keywords: [
    "USF graduation photographer",
    "University of San Francisco graduation photos",
    "USF graduation pictures",
    "USF graduation photo locations",
    "USF Lone Mountain graduation photos",
    "Gleeson Library graduation photos",
    "St. Ignatius Church graduation pictures",
    "USF golden hour graduation photography",
    "University of San Francisco graduation photographer",
    "USF graduation photoshoot",
    "USF graduation photo guide",
  ],
  h1: "Best USF Graduation Photo Locations",
  intro: [
    "The University of San Francisco has some beautiful locations for graduation photography, from the historic architecture of St. Ignatius Church to the modern glass hallway and iconic palm trees at Lone Mountain.",
    "One of my favorite things about photographing USF graduates is the variety of backgrounds we can capture in a single session. We can begin with elegant architectural portraits around the church and library, move into something more modern at the glass hallway, and finish with beautiful sunset photos at Lone Mountain.",
    "Over time, I've developed a preferred route that makes the most of the light and creates a variety of graduation portraits without moving back and forth across campus. In this guide, I'll share my favorite USF graduation photo locations, the best times to photograph them, and some important tips for planning your session.",
  ],
  mustHaveHeading: "The best USF graduation photo spots at a glance",
  mustHaveIntro:
    "Start around St. Ignatius Church, then Gleeson Library with the wolf sculpture right outside it, add the glass hallway when access allows, and head up to Lone Mountain for a sunset finish under the palm trees.",
  mustHaveKeys: ["st-ignatius-church", "gleeson-library", "usf-glass-hallway", "lone-mountain-palm-walkway"],
  spotsHeading: "My favorite USF graduation photo spots",
  bestTime: {
    heading: "When Is the Best Time to Take USF Graduation Photos?",
    paragraphs: [
      "My favorite time to photograph graduation sessions at the University of San Francisco is golden hour before sunset. On sunny days, I generally recommend avoiding the middle of the day and early afternoon, when direct sunlight can create harsher shadows.",
      "Starting closer to sunset gives us softer, more flattering light around campus, and I particularly like planning the session so we finish at Lone Mountain around sunset. The palm trees, architecture, and warm evening light make a beautiful setting for the final graduation photos.",
      "Cloudy days are excellent too. One of the best things about photographing graduations in San Francisco is that overcast weather can actually be ideal: clouds diffuse the sunlight and soften it, so portraits can look beautiful even outside golden hour. On overcast days we have much more flexibility, and morning or afternoon sessions can work well.",
    ],
    lists: [
      {
        label: "Sunny days",
        items: [
          "Golden hour is strongly recommended.",
          "Save Lone Mountain for sunset.",
          "Avoid harsh direct midday light when possible.",
        ],
      },
      {
        label: "Overcast days",
        items: [
          "Morning photography can be excellent.",
          "Midday and afternoon sessions can work well.",
          "Soft, diffused light is often flattering.",
          "Sunset color isn't guaranteed.",
        ],
      },
    ],
    weather:
      "San Francisco weather can change during a session, and very heavy cloud can make it quite dark. I can't promise clear skies, sunset colors, or shadow-free light, so we'll watch the forecast together and adjust the plan as your date gets closer.",
    // San Francisco city center, only used to compute approximate sunset
    // times; never published.
    sunsetCoords: { latitude: 37.7749, longitude: -122.4194 },
  },
  route: {
    navLabel: "My route",
    heading: "How I Like to Photograph a USF Graduation Session",
    intro: [
      "When photographing USF graduates, I like following a route that gives us a variety of photos while making the most of the available light.",
      "I generally begin around St. Ignatius Church and Gleeson Library, two of the most recognizable places on campus, photographing the Los Lobos de Loyola wolf sculpture as part of the library stop, then move to the glass hallway if access is authorized. After the lower-campus locations, we head up to Lone Mountain, using the stairs on the way up for a few compositions before the palm trees and main building. My favorite way to finish is with the final photos at Lone Mountain around sunset.",
    ],
    steps: [
      { spotKey: "st-ignatius-church", text: "St. Ignatius Church, outside the church and along the walkway in front." },
      { spotKey: "gleeson-library", text: "The front entrance of Gleeson Library and the Los Lobos de Loyola wolf sculpture right outside it." },
      { spotKey: "usf-glass-hallway", text: "The glass hallway, only when access is authorized." },
      { spotKey: "lone-mountain-palm-walkway", text: "Lone Mountain: the stairs on the way up, then the palm trees and main building at sunset." },
    ],
    notes: [
      "The session can also begin near Gleeson Library if that suits where we meet or the light. The lower-campus order stays flexible; the one timing priority is finishing at Lone Mountain around sunset when conditions allow.",
      "Covering every location takes more time than a short session, because we also walk up to Lone Mountain. I'll recommend a coverage time for the stops you choose, and if time is limited I prioritize your favorites and my strongest compositions rather than rushing through every stop.",
    ],
  },
  afterRoute: [
    {
      id: "what-to-bring",
      navLabel: "Wind & what to bring",
      heading: "What to Bring to Your USF Graduation Photoshoot",
      paragraphs: [
        "One thing I always recommend for USF graduation sessions is preparing for the wind. Lone Mountain is elevated and can get particularly windy, especially in open areas.",
        "If you have long hair, bring hair ties, clips, or bobby pins to keep everything under control. A few small clips or safety pins for your graduation gown or other loose clothing help too; use them on seams or the inside of the gown rather than pushing pins through delicate fabric. Comfortable shoes are a good idea, since we'll be walking between different parts of campus.",
        "A breeze can add natural movement to a portrait, but if strong gusts make posing uncomfortable, we'll move to a more sheltered spot.",
      ],
      bulletsLabel: "Recommended items",
      bullets: [
        "Graduation cap and gown",
        "Graduation stole and cords",
        "Hair ties and hair clips",
        "Bobby pins",
        "Small clothing clips or safety pins",
        "Comfortable walking shoes",
        "Water",
        "Any meaningful graduation accessories",
      ],
    },
  ],
  offCampus: {
    navLabel: "Off campus",
    heading: "Want to Take USF Graduation Photos Somewhere Else in San Francisco?",
    intro: [
      "Another great thing about graduating from USF is having so many interesting locations throughout San Francisco. Some graduates prefer to take all their photos on campus, while others want to combine their university portraits with another part of the city.",
      `For example, we can photograph around St. Ignatius Church, Gleeson Library, and Lone Mountain before heading to the ${palace.name} or the ${legion.name} for a different atmosphere. Combining locations is a great way to create a gallery with more variety.`,
    ],
    spots: [...SF_OFF_CAMPUS_SPOTS],
  },
  plans: {
    navLabel: "Multiple locations",
    heading: "Can I Take USF Graduation Photos at Multiple Locations?",
    intro: [
      "Yes! We can plan a session that combines USF campus portraits with an additional San Francisco location. Additional locations aren't part of a standard graduation session; they're planned and priced as add-ons.",
    ],
    optionsHeading: "Example session plans",
    options: [
      { label: "Option A", title: "Classic USF graduation", body: "Campus only: St. Ignatius Church, Gleeson Library and the wolf sculpture, the glass hallway when student access allows, and Lone Mountain at sunset." },
      { label: "Option B", title: `USF + ${palace.name}`, body: `Classic campus portraits first, then architectural portraits with the columns at the ${palace.name}.` },
      { label: "Option C", title: `USF + ${legion.name}`, body: `Campus portraits combined with the grand columns and elegant architecture of the ${legion.name}.` },
    ],
    notesHeading: "Pricing and logistics",
    notes: [
      `A second nearby location is currently a $${secondLocation.price} add-on. I'll confirm the add-ons, coverage time, and travel with you before you book.`,
      `Travel between stops takes time from the session, so multi-location plans usually need extra coverage. An extra 30 minutes is currently $${extra30Minutes.price}.`,
      "When we add a location, finishing at Lone Mountain at sunset may not fit, so we'll decide together which stop gets the best light.",
    ],
    cta: {
      heading: "Planning USF Graduation Photos at Multiple Locations?",
      body: "Tell me the campus spots and San Francisco locations you'd like to include, and I'll help plan a session around them.",
      label: "Plan my USF session",
    },
  },
  sections: [
    {
      id: "rules",
      navLabel: "Location rules",
      heading: "Campus and Location Rules",
      paragraphs: [
        "We photograph the outside of St. Ignatius Church and Gleeson Library. Interior photography isn't part of a standard session and isn't something I assume is permitted.",
        "Los Lobos de Loyola, the wolf sculpture outside Gleeson Library, is a work of art. We never climb, stand, or sit on it, and seated portraits use the surrounding surfaces where sitting is allowed.",
        "The glass hallway is indoors and access-controlled. We include it only when access and photography are authorized; otherwise the session continues at the outdoor spots.",
        "On the stairs up to Lone Mountain we keep the walkway clear and avoid railings and edges. Campus access rules, closures, and events can change, so I check current conditions before your session and adjust the plan if a spot is unavailable.",
      ],
      links: [
        { label: "USF campus map", href: "https://www.usfca.edu/campus-map" },
        { label: "USF landmarks", href: "https://www.usfca.edu/news/9-stunning-landmarks-make-usf-unique" },
        { label: "Gleeson Library access", href: "https://library.usfca.edu/access-privileges" },
      ],
    },
  ],
  tips: [
    {
      title: "Come prepared for the wind",
      body: "Hair ties, clips, bobby pins, and a few small clothing clips or safety pins make Lone Mountain much easier.",
    },
    {
      title: "Tell me your must-have spots",
      body: "Let me know which campus spots or San Francisco places matter most to you, and I'll plan the route around them.",
    },
    {
      title: "Bring comfortable shoes",
      body: "We walk between the main campus and Lone Mountain. Wear comfortable shoes and switch into your favorite pair for the photos.",
    },
    {
      title: "Let me know about stairs",
      body: "If stairs or steep walks aren't comfortable for you, tell me ahead of time and I'll plan an accessible route and alternative spots.",
    },
  ],
  faqs: [
    { q: "Where are the best places for USF graduation pictures?", a: "My favorite spots are St. Ignatius Church, Gleeson Library with the Los Lobos de Loyola wolf sculpture right outside it, the modern glass hallway, and Lone Mountain. I particularly recommend finishing at Lone Mountain around sunset." },
    { q: "What time is best for USF graduation photos?", a: "Golden hour before sunset is my favorite time on sunny days. Cloudy days are also excellent, because the softer light makes photography possible throughout more of the day." },
    { q: "Where should we start our USF graduation session?", a: "I usually like beginning near St. Ignatius Church or Gleeson Library before working through campus and finishing at Lone Mountain." },
    { q: "Why do you recommend Lone Mountain at sunset?", a: "I love the palm trees, architecture, and warm evening light around Lone Mountain. Saving it for sunset can produce some of my favorite compositions from a USF session." },
    { q: "Can we take photos in the USF glass hallway?", a: "The hallway is an indoor, access-controlled location. In my experience a student ID is required to get in, but professional photography there must also be authorized. We can include it when the necessary access and permission are available." },
    { q: "Can we take graduation photos with the USF wolf sculpture?", a: "Yes, when the area outside Gleeson Library is accessible. Los Lobos de Loyola is part of the Gleeson Library stop and one of my favorite recognizable USF landmarks. We photograph around it without climbing or sitting on the artwork." },
    { q: "Is Lone Mountain windy?", a: "It can be very windy! I recommend bringing hair clips, hair ties, and small clothing clips to help secure your hair and graduation outfit." },
    { q: "What if it's cloudy during my graduation photoshoot?", a: "Cloudy skies can actually be ideal for portraits. The clouds soften the light, which lets us create beautiful photos throughout more of the day." },
    { q: "Can I take USF graduation photos at multiple locations?", a: "Yes! We can plan a session that combines USF campus portraits with an additional San Francisco location like the Palace of Fine Arts or the Legion of Honor, depending on coverage time, travel, and the location add-on." },
    { q: "Will you help me pose?", a: "Absolutely! I'll guide you through the session and help you feel comfortable with both classic graduation poses and more natural photos." },
  ],
};
