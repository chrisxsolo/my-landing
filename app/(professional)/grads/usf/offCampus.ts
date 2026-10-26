import type { SchoolSpot } from "@/app/components/SchoolLandingTemplate";

// San Francisco places Chris's USF graduates add to a campus session. Keys
// equal their place keys (lib/locations/places), so photos from USF sessions
// shot there fill the section; a couples session at the same place never does.
// Haight-Ashbury is a neighborhood: specific stops are chosen with the client.
export const offCampusSpots: SchoolSpot[] = [
  {
    key: "haight-ashbury",
    name: "Haight-Ashbury",
    role: "Optional add-on location",
    description: "Colorful buildings, distinctive streets, and historic San Francisco character for more urban, lifestyle-style portraits.",
    details: [
      "Haight-Ashbury offers a different look from USF's traditional campus architecture. The neighborhood is known for its colorful buildings, distinctive streets, and historic San Francisco character.",
      "It's a great option for graduates looking for more urban or lifestyle-oriented portraits after the classic campus photos. Haight-Ashbury is a whole neighborhood rather than one photo spot, so we'll choose the specific streets and backdrops together when we plan your session.",
    ],
    photoIdeas: [
      "Walking portraits along colorful streets",
      "Cap-and-gown photos with neighborhood character",
      "Relaxed lifestyle portraits",
      "Close-up portraits with color in the background",
    ],
    tip: "I recommend choosing additional locations based on the kind of photos you want, rather than fitting in as many destinations as possible. A thoughtfully planned session usually produces a more cohesive gallery than rushing between too many stops.",
  },
];
