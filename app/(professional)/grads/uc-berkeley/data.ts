import type { SchoolLandingData } from "@/app/components/SchoolLandingTemplate";
import { spotsGuide } from "./spotsGuide";

// Spots, timing, and route come from Chris's own UC Berkeley sessions.
// Spot keys match lib/schoolSpots.ts, which the photo tags are stored under.
export const data: SchoolLandingData = {
  school: "UC Berkeley",
  schoolShort: "Berkeley",
  slug: "uc-berkeley",
  city: "Berkeley, CA",
  metaTitle: "UC Berkeley Graduation Photographer",
  metaDescription:
    "UC Berkeley graduation portraits by Chris Solorzano at Sather Gate, the Campanile, and Doe Library. Guided sessions, sunrise or golden-hour light, private gallery.",
  canonicalPath: "/grads/uc-berkeley",
  heroTagline:
    "Graduation portraits around Berkeley's most iconic landmarks: Sather Gate, the Campanile, and Doe Library. I guide every session so you always know what to do and the photos feel natural.",
  bodyIntro:
    "UC Berkeley is one of my favorite campuses for graduation photography, with beautiful architecture, iconic landmarks, and a lot of variety in a short walk. After photographing graduates here, I've settled on a route that starts at Sather Gate and finishes at Doe Library around sunset, so we make the most of the light.",
  spots: [
    {
      key: "sather-gate",
      name: "Sather Gate",
      priority: "must-have",
      role: "Where I start",
      description:
        "One of Berkeley's most recognizable landmarks and my favorite place to begin. The historic gate immediately connects your photos to the university.",
      details: [
        "Sather Gate is one of the most recognizable landmarks at UC Berkeley and one of my favorite places to begin a graduation session. The historic entrance creates a distinctive backdrop that immediately connects your photos to the university.",
        "I like starting here because we can capture traditional graduation portraits and then ease into more natural, candid photos around the surrounding campus.",
      ],
      photoIdeas: [
        "Standing beneath Sather Gate",
        "Full-body graduation portraits",
        "Walking toward or away from the gate",
        "Relaxed smiling portraits",
        "Wider frames showing the architecture",
        "Straight-on and diagonal angles of the gate",
      ],
      tip: "Sather Gate is a popular photo spot, especially during graduation season. Starting here lets us photograph it early in the session before we continue through campus.",
    },
    {
      key: "doe-library-entrance",
      name: "Doe Library Front Entrance",
      priority: "must-have",
      role: "Where I finish, near sunset",
      description:
        "Columns and grand architecture for classic graduation portraits. I save it for the end of the session, around sunset, when the light is easier to balance.",
      details: [
        "Doe Library is one of my favorite graduation backdrops at Berkeley. Its columns and impressive architecture make it an excellent location for classic graduation portraits.",
        "My favorite time to photograph the outside of Doe Library is around sunset. Earlier in the day, the building behind you can be much brighter than you are, which makes it harder to keep both the architecture and your face looking good in the same photo.",
        "By finishing at Doe Library around sunset, I can often get a better balance between you and the background, so the details of the building stay visible while the light on you stays soft and flattering. Weather still plays a part, so I adjust on the day.",
      ],
      photoIdeas: [
        "Classic cap-and-gown portraits",
        "Full-body photos with the columns visible",
        "Portraits showcasing the front entrance",
        "Close-up graduation portraits",
        "Natural celebratory photos",
      ],
      tip: "I generally save Doe Library for the end of the session, especially around golden hour. That's an intentional lighting decision, not just a convenient place to stop.",
    },
    {
      key: "doe-library-ledge",
      name: "Doe Library Ledge",
      priority: "must-have",
      role: "Part of the finish",
      description:
        "A different view of Doe Library: a wider frame that brings in the library's architecture and adds variety without a trip across campus.",
      details: [
        "Another favorite composition is photographing graduates near the ledge at Doe Library. This viewpoint lets us bring the library's architecture into a wider background and gives a different perspective from the entrance portraits.",
        "It adds variety to your gallery without traveling to a completely different part of campus, and a few strong frames here often end up among the favorites of the whole gallery.",
      ],
      photoIdeas: [
        "Wide environmental portraits",
        "Graduation portraits with Doe Library behind you",
        "Relaxed standing or seated portraits, where allowed",
        "Celebratory photos",
        "Frames that bring in the surrounding campus",
      ],
      tip: "We stay on solid ground near the ledge. I never ask anyone to stand on an edge or climb the architecture, and we keep walkways clear for everyone else.",
    },
    {
      key: "campanile",
      name: "Campanile (Sather Tower)",
      priority: "highly-recommended",
      description:
        "Berkeley's iconic tower makes an instantly recognizable backdrop for wide, walking, and candid portraits.",
      details: [
        "The Campanile is one of Berkeley's most iconic landmarks and a fantastic location for graduation portraits. The tower is an instantly recognizable university backdrop, and it works in a variety of wider compositions.",
        "I especially like including the Campanile because it shows off the campus without every image being a traditional portrait directly in front of a building.",
      ],
      photoIdeas: [
        "Full-body portraits featuring the tower",
        "Low-angle portraits that keep the whole tower in frame",
        "Walking portraits",
        "Wide environmental photos",
        "Candid and celebratory images",
      ],
      tip: "The Campanile is one of my favorite stops between Sather Gate and Doe Library. We can adjust the exact order around the light and the crowds.",
    },
    {
      key: "hearst-mining",
      name: "Hearst Memorial Mining Building",
      priority: "recommended",
      description:
        "Beautiful classic architecture that looks different from the Campanile and Doe Library, for more variety in your gallery.",
      details: [
        "The Hearst Memorial Mining Building is another beautiful architectural location for Berkeley graduation photos. It offers a different background from the Campanile and Doe Library, which helps create variety throughout the session.",
        "I recommend it if you love classic campus architecture and want a mix of recognizable university landmarks.",
      ],
      photoIdeas: [
        "Graduation portraits in front of the building",
        "Wide architectural photos",
        "Formal cap-and-gown portraits",
        "Natural smiling portraits",
      ],
    },
    {
      key: "mining-circle",
      name: "Mining Circle and Rondo II",
      priority: "recommended",
      description:
        "A round pool and Bruce Beasley's Rondo II sculpture in front of Hearst Mining, for creative portraits with water and art.",
      details: [
        "In front of the Hearst Memorial Mining Building is Mining Circle, with a round pool at its center and a distinctive stainless steel sculpture, Rondo II, by sculptor and Berkeley alumnus Bruce Beasley.",
        "It has a different feel from the traditional campus buildings. The water, the sculpture, and the surrounding architecture make it a fun spot for more creative graduation portraits.",
      ],
      photoIdeas: [
        "Portraits beside the water",
        "Frames that include the sculpture",
        "Wide campus photos",
        "Creative portraits with reflections, when the water allows",
      ],
      tip: "This is a useful optional stop when we're already at Hearst Mining, since the two spots give you two different backgrounds in one place. The pool isn't always filled and areas can be closed, so I treat it as a bonus.",
    },
    {
      key: "cherry-blossoms",
      name: "Cherry Blossoms (seasonal)",
      priority: "seasonal",
      description:
        "In spring, cherry blossoms near some of the campus entrances add soft color and texture, when the trees are in bloom.",
      details: [
        "Spring is an especially beautiful time for graduation photos at Berkeley. When the trees are flowering, some areas near the campus entrances have cherry blossoms that make colorful, natural backgrounds.",
        "I love these spots for graduates who want something softer and more seasonal than traditional architectural portraits. The blossoms add color and texture to your gallery and pair well with the classic landmarks.",
      ],
      photoIdeas: [
        "Soft portraits framed by blossoms",
        "Close-up portraits with color in the background",
        "Relaxed, candid moments under the trees",
      ],
      tip: "March can be a good time to look for blossoms, but the bloom changes from year to year. Stay flexible: the flowers may not be out on your date, and we'll plan the rest of the session either way.",
    },
  ],
  sessionNote:
    "UC Berkeley is one of the busiest campuses I photograph during graduation season. Weekdays earlier in the season are usually the easiest time to shoot, and if you need a date close to your ceremony, send an inquiry early.",
  bestTime:
    "My favorite times at Berkeley are sunrise and golden hour before sunset, when the light is softer and more flattering than in the middle of the day. For sunset sessions I like to start at Sather Gate and finish at Doe Library, where the evening light makes the building easier to balance against you. Actual light always depends on the season, the weather, and shade.",
  whatToWear:
    "Berkeley's stone, brick, and deep-green canopy make a rich backdrop, so solid, saturated colors read better than busy patterns. Bring your stole and any honor cords — they pop against the gown — and a second casual look if you'd like some relaxed photos once the cap-and-gown frames are done.",
  faqs: [
    { q: "Where do you start and finish a Berkeley grad session?", a: "I usually start at Sather Gate and finish at Doe Library around sunset. My UC Berkeley photo location guide covers all seven spots I recommend, my favorite route, and how to plan around graduation crowds." },
    { q: "Can we take photos around commencement day?", a: "Yes, though the days around commencement are the busiest on campus and book up first. If you want photos near your ceremony date, reach out early so we can lock in a time, and expect to wait a little at the most popular landmarks." },
    { q: "How early should I book a Berkeley grad session?", a: "Spring is peak season and fills quickly. Booking early also gives you a better chance at a weekday earlier in the season, which is usually easier than the busiest graduation dates." },
  ],
  spotsGuide,
};
