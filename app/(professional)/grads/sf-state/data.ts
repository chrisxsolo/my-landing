import type { SchoolLandingData } from "@/app/components/SchoolLandingTemplate";

export const data: SchoolLandingData = {
  school: "SF State",
  schoolShort: "SFSU",
  slug: "sf-state",
  city: "San Francisco, CA",
  metaTitle: "SF State Graduation Photographer | SFSU",
  metaDescription:
    "Graduation portraits at SF State by Chris Solorzano. On-campus and nearby San Francisco locations — no travel fee, guided sessions, private gallery delivery.",
  canonicalPath: "/grads/sf-state",
  heroTagline:
    "Graduation portraits at SF State — on campus or at nearby San Francisco locations. No travel fee, clear direction, and a smooth experience from first message to final gallery.",
  bodyIntro:
    "SF State is a home campus — no travel fee, fast logistics, and the flexibility to extend the session to nearby San Francisco locations if you want more variety. Depending on your timing and outfit ideas, we can combine campus portraits with spots like Dolores Park, the waterfront, or Golden Gate Park within a single session.",
  spots: [
    {
      name: "Administration Building",
      description:
        "Classic campus backdrop with strong architectural lines. The steps and entrance work well for formal portraits.",
      bestTime: "Late morning",
    },
    {
      name: "Campus Library Area",
      description:
        "Clean, modern surroundings with good ambient light. Less crowded than the main hub on most shoot days.",
      bestTime: "Midday",
    },
    {
      name: "Lake Merced Nearby",
      description:
        "A short walk from campus. Natural setting with water and trees — good contrast from campus architecture.",
      bestTime: "Late afternoon",
    },
    {
      name: "SF Extensions (Dolores Park, GGP)",
      description:
        "If you want San Francisco in the background, we can build an itinerary that includes campus and nearby SF spots in the same session.",
      bestTime: "Golden hour",
    },
  ],
  sessionNote:
    "SF State ceremony dates vary by college — confirm your ceremony date when you inquire.",
  bestTime:
    "SF State's open plazas and the Administration Building light evenly through late morning and afternoon, and the coastal marine layer often keeps the light soft all day. If we extend to spots like Dolores Park or the waterfront, late afternoon and golden hour are ideal.",
  whatToWear:
    "The campus's modern, neutral architecture lets bolder colors stand out, so don't be afraid of a saturated outfit. If we add San Francisco locations, bring a layer — the west side of the city runs cooler and breezier than downtown.",
  faqs: [
    { q: "Is there a travel fee at SF State?", a: "No — SF State is a home campus, so there's no travel fee, and we can add nearby San Francisco locations to the same session if you'd like." },
    { q: "Can we combine campus photos with SF landmarks?", a: "Yes. A popular option pairs campus portraits with spots like Dolores Park, Golden Gate Park, or the waterfront in one itinerary — just mention it when you inquire so we can plan the timing." },
    { q: "What are the best spots on the SF State campus?", a: "The Administration Building, the library area, and the open plazas are the core campus backdrops, with Lake Merced a short walk away for a natural setting." },
    { q: "How do ceremony dates affect booking?", a: "SF State ceremony dates vary by college, so confirm your date when you inquire and I'll help find a session time that fits around it." },
  ],
};
