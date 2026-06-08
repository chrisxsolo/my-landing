import type { Metadata } from "next";
import SchoolLandingTemplate, { buildSchoolMetadata, type SchoolLandingData } from "@/app/components/SchoolLandingTemplate";

const data: SchoolLandingData = {
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
    },
    {
      name: "Campus Library Area",
      description:
        "Clean, modern surroundings with good ambient light. Less crowded than the main hub on most shoot days.",
    },
    {
      name: "Lake Merced Nearby",
      description:
        "A short walk from campus. Natural setting with water and trees — good contrast from campus architecture.",
    },
    {
      name: "SF Extensions (Dolores Park, GGP)",
      description:
        "If you want San Francisco in the background, we can build an itinerary that includes campus and nearby SF spots in the same session.",
    },
  ],
  travelNote: "No travel fee for SF State and all San Francisco locations.",
  sessionNote:
    "SF State ceremony dates vary by college — confirm your ceremony date when you inquire.",
};

export const metadata: Metadata = buildSchoolMetadata(data);

export default function SFStateGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
