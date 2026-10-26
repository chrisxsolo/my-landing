import type { SchoolLandingData } from "@/app/components/SchoolLandingTemplate";
import { spotsGuide } from "./spotsGuide";

// Spots, timing, and crowd notes come from Chris's own SF State sessions.
// Spot keys match lib/schoolSpots.ts, which the photo tags are stored under.
export const data: SchoolLandingData = {
  school: "SF State",
  schoolShort: "SFSU",
  slug: "sf-state",
  city: "San Francisco, CA",
  metaTitle: "SF State Graduation Photographer | SFSU",
  metaDescription:
    "SFSU graduation portraits by Chris Solorzano at the 19th & Holloway sign, the quad, and the library, or at the Palace of Fine Arts and other SF landmarks.",
  canonicalPath: "/grads/sf-state",
  heroTagline:
    "Graduation portraits at SF State, from the entrance sign at 19th and Holloway to the quad and the Garden of Remembrance, or at San Francisco landmarks like the Palace of Fine Arts.",
  bodyIntro:
    "SF State has some great graduation photo spots, and in my experience it's generally less crowded than some of the busier Bay Area campuses, so we can move between locations easily. Many of my SF State graduates also add a San Francisco location like the Palace of Fine Arts, the Legion of Honor, or the Golden Gate Bridge.",
  spots: [
    {
      key: "sfsu-entrance-sign",
      name: "SFSU Entrance Sign",
      priority: "must-have",
      role: "19th Ave & Holloway Ave",
      description:
        "The tall, narrow university sign at 19th and Holloway. The classic SF State graduation photo, and the one spot I almost always include.",
      details: [
        "The San Francisco State University entrance sign is easily one of my favorite locations for graduation photos on campus. It's the tall, narrow university sign near the intersection of 19th Avenue and Holloway Avenue.",
        "This is one of those classic graduation spots I almost always recommend, because it immediately connects your photos to SF State. It's perfect for traditional cap-and-gown portraits, smiling graduation pictures, and more relaxed celebratory images.",
      ],
      photoIdeas: [
        "Classic cap-and-gown portraits",
        "Full-body graduation pictures",
        "Standing beside the university sign",
        "Close-up smiling portraits",
        "Celebratory photos showing the school name",
      ],
      tip: "This is probably the most popular graduation photo landmark at SFSU, so as graduation approaches you may find other graduates waiting their turn. In my experience the wait usually isn't too bad, and I generally haven't waited longer than around 15 minutes, but crowds change, so it helps to stay flexible.",
    },
    {
      key: "sfsu-main-quad",
      name: "SFSU Main Quad",
      priority: "highly-recommended",
      description:
        "An open campus setting for walking, candid, and wide portraits after the classic sign photos.",
      details: [
        "The main quad is another great place for SFSU graduation pictures. It's a more open campus setting than the entrance sign, which makes it useful for a variety of traditional and candid photos.",
        "I like bringing different parts of the quad into a session to add variety throughout your gallery.",
      ],
      photoIdeas: [
        "Walking graduation portraits",
        "Natural smiling photos",
        "Wide campus portraits",
        "Traditional standing cap-and-gown pictures",
        "Fun candid photos",
      ],
      tip: "The quad is a good place for more natural, movement-based photos once we've captured the classic sign portraits. Cloudy skies are especially helpful here, keeping the light soft and even across the open space.",
    },
    {
      key: "j-paul-leonard-library",
      name: "J. Paul Leonard Library",
      priority: "recommended",
      description:
        "A different architectural background from the rest of campus, photographed from outside the building.",
      details: [
        "The J. Paul Leonard Library is another location I recommend for SFSU graduation pictures. Its architecture looks different from the rest of campus, which helps create a nice mix of photos throughout your session.",
        "It's a great stop for traditional graduation portraits as well as more relaxed images in front of the building.",
      ],
      photoIdeas: [
        "Full-body graduation portraits",
        "Standing photos with the library visible",
        "Natural walking photos",
        "Close-up portraits",
        "Architectural compositions",
      ],
      tip: "I like including the library because it adds a different setting without leaving SF State. We photograph the outside of the building only.",
    },
    {
      key: "sfsu-gator-statue",
      name: "SFSU Gator Statue",
      priority: "highly-recommended",
      role: "Don Nasser Family Plaza",
      description:
        "SF State's Gator mascot, a fun, school-spirited backdrop that feels different from architecture or greenery.",
      details: [
        "The Gator statue at Don Nasser Family Plaza is a recognizable campus landmark and a fun location to include in graduation photos.",
        "As SF State's mascot, the Gator makes a school-specific backdrop that feels different from traditional architecture or greenery. It's a great stop for graduates who want to show some school spirit and have fun with their photos.",
      ],
      photoIdeas: [
        "Portraits beside the Gator",
        "Smiling graduation photos",
        "Fun, playful poses",
        "Wider images that include the sculpture",
        "Traditional cap-and-gown portraits",
      ],
      tip: "I recommend the Gator for graduates who want their photos to feel especially connected to SF State.",
    },
    {
      key: "garden-of-remembrance",
      name: "Ruth Asawa Garden of Remembrance",
      priority: "recommended",
      role: "Between Burk Hall and Fine Arts",
      description:
        "A small waterfall with rocks, flowers, and greenery, and a memorial, for softer, more natural portraits on campus.",
      details: [
        "One of the prettiest natural backgrounds at SF State is the small waterfall surrounded by rocks, flowers, and greenery between Burk Hall and the Fine Arts building. This is the Ruth Asawa Garden of Remembrance.",
        "It has a completely different atmosphere from the library, the quad, and the entrance sign. The plants, rocks, and flowing water make beautiful graduation portraits with a softer, more organic feel.",
        "The garden is also a memorial. Artist Ruth Asawa designed it to honor Japanese Americans incarcerated during World War II, including 19 SF State students who were forced to leave their studies. We photograph it respectfully: we stay on the paths, never climb the rocks or step into the plantings, and give visitors space.",
      ],
      photoIdeas: [
        "Close-up portraits with greenery",
        "Graduation pictures near the waterfall",
        "Soft, natural portraits",
        "Compositions with flowers and plants",
        "Candid smiling photos",
      ],
      tip: "This is one of my recommended spots for graduates who want a natural background without leaving campus.",
    },
  ],
  sessionNote:
    "SF State ceremony dates vary by college, so confirm your ceremony date when you inquire. The entrance sign gets busier as commencement approaches.",
  bestTime:
    "Sunrise and golden hour before sunset are my favorites. San Francisco's cloudy days are a real advantage, though: overcast skies soften the light, so morning, midday, and afternoon sessions can all work. When it's cloudy I lean toward starting earlier.",
  whatToWear:
    "SF State's mix of architecture and greenery lets both neutral and saturated colors work, so bring the outfit you love. Pack a layer too: the west side of the city often runs cooler and breezier than downtown, especially if we add a waterfront location.",
  faqs: [
    { q: "Is there a travel fee at SF State?", a: "No. SF State and the San Francisco locations in my guide are inside San Francisco city limits, where travel is included. Adding a location is a separate add-on." },
    { q: "Which SF State spot should I prioritize?", a: "The entrance sign at 19th and Holloway. It's the one I almost always include, and my SFSU photo location guide covers the other campus spots and my favorite San Francisco locations." },
    { q: "How do ceremony dates affect booking?", a: "SF State ceremony dates vary by college, so confirm your date when you inquire and I'll help find a session time that fits around it." },
  ],
  spotsGuide,
};
