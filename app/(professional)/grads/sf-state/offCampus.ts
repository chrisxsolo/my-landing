import type { SchoolSpot } from "@/app/components/SchoolLandingTemplate";

// San Francisco places Chris's SF State graduates book most. Keys equal their
// place keys (lib/locations/places), so photos from SF State sessions shot
// there fill each section; a couples session at the same place never does.
// Nothing here promises an empty background, a visible bridge, or shade.
export const offCampusSpots: SchoolSpot[] = [
  {
    key: "palace-of-fine-arts",
    name: "Palace of Fine Arts",
    role: "Best: golden hour or sunrise",
    description: "Columns, grand architecture, and surrounding scenery for traditional and creative graduation portraits.",
    details: [
      "The Palace of Fine Arts is one of my favorite places for graduation photography in San Francisco. Its architecture, columns, and surrounding scenery make a beautiful setting for both traditional graduation portraits and more creative photos.",
      "I particularly recommend photographing here at golden hour or sunrise. The lower sun can create flattering portraits and helps bring out the atmosphere of the place.",
    ],
    photoIdeas: [
      "Full-body portraits with the columns",
      "Architectural compositions",
      "Classic cap-and-gown portraits",
      "Walking and candid photos",
    ],
    tip: "The Palace of Fine Arts can get extremely busy with tourists, visitors, and other photographers. I recommend weekdays when possible, and even then, expect some people in the background and leave a little extra time.",
    guideLink: { label: "Palace of Fine Arts portrait location guide", href: "/portrait-guide/locations/palace-of-fine-arts" },
  },
  {
    key: "legion-of-honor",
    name: "Legion of Honor",
    role: "Best: often flexible through the day",
    description: "Grand columns and elegant surroundings, with shaded architecture that gives more flexibility on timing.",
    details: [
      "The Legion of Honor is another excellent choice for San Francisco graduation photos. I love it for its grand architecture, columns, and elegant surroundings.",
      "One of its biggest advantages is that the architecture creates areas of shade, which gives us more flexibility with the time of day. Unlike more exposed locations, I can often find flattering light here even outside sunrise and sunset.",
    ],
    photoIdeas: [
      "Portraits along the colonnade",
      "Full facade compositions",
      "Celebratory cap-in-the-air photos",
      "Photos with family",
    ],
    tip: "The shaded architecture makes the Legion of Honor one of my more flexible recommendations for daytime graduation photos. The light still depends on where we stand, the sun's direction, and the weather, and I check current access rules before we plan specific areas.",
  },
  {
    key: "crissy-field",
    name: "Crissy Field",
    role: "Best for: Golden Gate Bridge backgrounds",
    description: "A waterfront setting where the bay, open scenery, and the Golden Gate Bridge become the background.",
    details: [
      "Crissy Field is a great choice for graduates who want the Golden Gate Bridge in their graduation photos. The waterfront setting feels completely different from campus: instead of columns and buildings, we can bring in the bay, open scenery, and the bridge.",
    ],
    photoIdeas: [
      "Wide portraits with the bridge",
      "Walking photos along the waterfront",
      "Windswept, candid moments",
      "Close-up portraits with the bay behind you",
    ],
    tip: "Crissy Field is especially useful for wider graduation portraits that show off San Francisco. Fog, wind, and visibility vary, so the bridge isn't always clearly visible.",
  },
  {
    key: "golden-gate-bridge-welcome-center",
    name: "Golden Gate Bridge Welcome Center",
    role: "Best for: recognizable bridge compositions",
    description: "The area near the Welcome Center offers recognizable Golden Gate Bridge backgrounds.",
    details: [
      "Another popular option is photographing near the Golden Gate Bridge Welcome Center. This area offers recognizable bridge backgrounds for graduates who want their photos to highlight San Francisco.",
      "I recommend considering it if having the Golden Gate Bridge in your graduation pictures is especially important to you.",
    ],
    photoIdeas: [
      "Portraits with the bridge behind you",
      "Full-body cap-and-gown photos",
      "Celebratory photos",
    ],
    tip: "Because this is a major visitor destination, it can get busy with tourists. Weekdays can be more manageable, though a quiet background isn't guaranteed, and fog, wind, and bridge visibility can change the shot.",
  },
];
