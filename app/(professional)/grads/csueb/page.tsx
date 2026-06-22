import type { Metadata } from "next";
import SchoolLandingTemplate, { buildSchoolMetadata, type SchoolLandingData } from "@/app/components/SchoolLandingTemplate";

export const revalidate = 3600; // hourly ISR backstop; publish revalidates /grads/<slug> directly

const data: SchoolLandingData = {
  school: "CSU East Bay",
  schoolShort: "CSUEB",
  slug: "csueb",
  city: "Hayward, CA",
  metaTitle: "CSU East Bay Graduation Photographer | CSUEB",
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
  sessionNote:
    "Spring commencement at CSUEB typically falls in late May. Send an inquiry early if you need a specific date.",
  bestTime:
    "The Hayward Hills campus is built for golden hour — the elevation opens up Bay and skyline views that glow late in the day. Meiklejohn Hall and the central plazas photograph well in the afternoon, then we finish at the Pioneer Heights overlook as the sun drops for the wide, editorial frames.",
  whatToWear:
    "With big sky and Bay views behind you, mid-tone and warmer colors stand out against the blue backdrop. The hilltop gets breezy in the late afternoon, so structured fabrics and a light layer hold up better than anything that catches the wind.",
  faqs: [
    { q: "What makes CSU East Bay good for grad photos?", a: "The hilltop setting — few Bay Area campuses offer the elevation and skyline views you get from Pioneer Heights. It adds a sense of place you can't get on a flat urban campus." },
    { q: "When's the best time of day to shoot at CSUEB?", a: "Golden hour, hands down. The late-afternoon light on the hills and the Bay views behind you are hard to beat for wide, editorial portraits." },
    { q: "What are the main photo spots on campus?", a: "Meiklejohn Hall, the Student Union area, the Campus Greens, and the Pioneer Heights overlook for the skyline shots." },
    { q: "When should I book for CSUEB commencement?", a: "Spring commencement is usually late May, so send an inquiry early if you need a specific date during that window." },
  ],
};

export const metadata: Metadata = buildSchoolMetadata(data);

export default function CSUEBGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
