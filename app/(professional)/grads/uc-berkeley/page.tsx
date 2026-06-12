import type { Metadata } from "next";
import SchoolLandingTemplate, { buildSchoolMetadata, type SchoolLandingData } from "@/app/components/SchoolLandingTemplate";

export const revalidate = 3600; // hourly ISR backstop; publish revalidates /grads/<slug> directly

const data: SchoolLandingData = {
  school: "UC Berkeley",
  schoolShort: "Berkeley",
  slug: "uc-berkeley",
  city: "Berkeley, CA",
  metaTitle: "UC Berkeley Graduation Photographer",
  metaDescription:
    "Graduation portraits at UC Berkeley by Chris Solorzano. Sather Gate, Memorial Glade, the Campanile — clean direction, fast communication, private gallery delivery.",
  canonicalPath: "/grads/uc-berkeley",
  heroTagline:
    "Clean, directed graduation portraits around Berkeley's most iconic campus spots — Sather Gate, the Campanile, Memorial Glade, and more. I guide every session so you always know what to do and the photos feel natural.",
  bodyIntro:
    "UC Berkeley is one of the best campuses in the Bay Area for grad portraits — varied architecture, mature trees, and landmark spots that photograph beautifully at any time of day. I've shot here across multiple graduation seasons and know which spots work best in morning light versus afternoon, which areas fill up fast on ceremony days, and how to route the session efficiently so nothing feels rushed.",
  spots: [
    {
      name: "Sather Gate",
      description:
        "The most iconic Berkeley landmark. Best in early morning before it fills with foot traffic. The arch frames portraits cleanly against the plaza.",
    },
    {
      name: "Campanile (Sather Tower)",
      description:
        "Strong architectural backdrop with great contrast. The surrounding plaza and wide angles give plenty of variety within a few steps.",
    },
    {
      name: "Memorial Glade",
      description:
        "Open lawn with mature trees and soft light. Works especially well for wide, editorial compositions and group shots.",
    },
    {
      name: "Faculty Glade",
      description:
        "Tucked away with redwood canopy and dappled light. One of the more serene and less crowded spots on campus.",
    },
  ],
  sessionNote:
    "Spring graduation season (May) books quickly — inquire early if you have a specific date in mind.",
};

export const metadata: Metadata = buildSchoolMetadata(data);

export default function UCBerkeleyGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
