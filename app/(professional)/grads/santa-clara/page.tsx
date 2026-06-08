import type { Metadata } from "next";
import SchoolLandingTemplate, { buildSchoolMetadata, type SchoolLandingData } from "@/app/components/SchoolLandingTemplate";

const data: SchoolLandingData = {
  school: "Santa Clara University",
  schoolShort: "Santa Clara",
  slug: "santa-clara",
  city: "Santa Clara, CA",
  metaTitle: "Santa Clara University Graduation Photographer",
  metaDescription:
    "Graduation portraits at Santa Clara University by Chris Solorzano. Mission Santa Clara, the Rose Garden, palm-lined walkways — clean direction, fast communication, private gallery delivery.",
  canonicalPath: "/grads/santa-clara",
  heroTagline:
    "Clean, directed graduation portraits around Santa Clara's most beautiful campus spots — Mission Santa Clara, the Rose Garden, and the palm-lined walkways. I guide every session so you always know what to do and the photos feel natural.",
  bodyIntro:
    "Santa Clara University is one of the most photogenic campuses in the South Bay — the historic Mission, manicured gardens, and Spanish-revival architecture give grad portraits a warm, timeless feel that very few Bay Area campuses can match. I've shot grad sessions across the South Bay and know which SCU spots hold the best light through the afternoon, which areas stay quiet on busy ceremony days, and how to route a session so you get real variety without ever feeling rushed.",
  spots: [
    {
      name: "Mission Santa Clara de Asís",
      description:
        "The signature SCU landmark. The adobe facade and bell wall make a warm, instantly recognizable backdrop. Best in late afternoon when the light turns golden against the stucco.",
    },
    {
      name: "Mission Gardens & Rose Garden",
      description:
        "Lush, manicured beds and mature roses just steps from the Mission. Soft, even light and plenty of color — ideal for close, editorial compositions.",
    },
    {
      name: "Palm-Lined Walkway (The Alameda entrance)",
      description:
        "Tall palms and clean symmetry frame portraits beautifully down the central walkway. Strong depth and a polished, collegiate feel.",
    },
    {
      name: "Abby Sobrato Mall",
      description:
        "The open central lawn with mature trees and room to move. Works especially well for wide shots, group photos, and the classic cap-toss.",
    },
  ],
  travelNote: "Santa Clara sessions include a $70 travel fee from San Francisco.",
  sessionNote:
    "Spring graduation season (June) books quickly — inquire early if you have a specific date in mind.",
};

export const metadata: Metadata = buildSchoolMetadata(data);

export default function SantaClaraGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
