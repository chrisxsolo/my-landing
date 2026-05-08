import type { Metadata } from "next";
import SchoolLandingTemplate, { buildSchoolMetadata, type SchoolLandingData } from "@/app/components/SchoolLandingTemplate";

const data: SchoolLandingData = {
  school: "CSU East Bay",
  schoolShort: "CSUEB",
  slug: "csueb",
  city: "Hayward, CA",
  metaTitle: "CSU East Bay Graduation Photographer | CSUEB | soloxsnaps",
  metaDescription:
    "Graduation portraits at CSU East Bay by Chris Solorzano. Meiklejohn Hall, the Pioneer Heights, Main Street — guided sessions, fast turnaround, private gallery delivery.",
  canonicalPath: "/grads/csueb",
  heroTagline:
    "Graduation portraits at CSU East Bay with clear direction and a smooth, efficient session. I plan the campus route around light and timing so you're never standing around wondering what happens next.",
  bodyIntro:
    "CSU East Bay's Hayward Hills campus has a mix of architectural variety and natural surroundings that photograph well year-round. The hillside setting creates some unique elevation and skyline framing opportunities not available on flat urban campuses. I know the spots that photograph best and how to route the session so we cover variety without wasting time.",
  spots: [
    {
      name: "Meiklejohn Hall",
      description:
        "The main academic building with recognizable architecture. Steps, columns, and the surrounding plaza offer classic graduation portrait options.",
    },
    {
      name: "Student Union Area",
      description:
        "Central hub with open space and mixed shade. Works well for group shots and candid movement frames.",
    },
    {
      name: "Pioneer Heights Overlook",
      description:
        "Elevated campus areas with views of the Bay. Adds geographic context and a different visual dimension to the gallery.",
    },
    {
      name: "Campus Greens",
      description:
        "Landscaped open areas with mature trees. Good for relaxed individual portraits away from the main architectural backdrops.",
    },
  ],
  travelNote: "CSU East Bay sessions include a $30 travel fee from San Francisco.",
  sessionNote:
    "Spring commencement at CSUEB typically falls in late May. Send an inquiry early if you need a specific date.",
};

export const metadata: Metadata = buildSchoolMetadata(data);

export default function CSUEBGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
