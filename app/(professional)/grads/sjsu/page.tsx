import type { Metadata } from "next";
import SchoolLandingTemplate, { buildSchoolMetadata, type SchoolLandingData } from "@/app/components/SchoolLandingTemplate";

const data: SchoolLandingData = {
  school: "San Jose State",
  schoolShort: "SJSU",
  slug: "sjsu",
  city: "San Jose, CA",
  metaTitle: "SJSU Graduation Photographer | San Jose State | soloxsnaps",
  metaDescription:
    "Graduation portraits at San Jose State by Chris Solorzano. Tower Hall, the Event Center, campus quad — guided sessions, fast turnaround, private gallery delivery.",
  canonicalPath: "/grads/sjsu",
  heroTagline:
    "Graduation portraits at San Jose State with clear direction, premium editing, and a straightforward experience from inquiry to gallery. I know the campus and I know how to keep the session moving.",
  bodyIntro:
    "San Jose State sits in the heart of downtown San Jose with a mix of historic buildings, open plazas, and architectural details that make for strong graduation portraits. I know the best spots for light at different times of day and how to plan the route so the session stays efficient even during busy ceremony weeks.",
  spots: [
    {
      name: "Tower Hall",
      description:
        "SJSU's landmark building. The brick facade, archways, and surrounding lawn are classic backdrops for both formal and relaxed portraits.",
    },
    {
      name: "MLK Library Plaza",
      description:
        "Clean architecture with modern lines. Good for a different visual texture within the same session.",
    },
    {
      name: "Campus Quad",
      description:
        "Open central space with mature trees and shade — useful for group shots and relaxed individual frames.",
    },
    {
      name: "Seventh Street",
      description:
        "Tree-lined campus boundary with good shade and quiet compared to the main quad. Works well for candid movement shots.",
    },
  ],
  travelNote: "SJSU sessions include a $75 travel fee from San Francisco.",
  sessionNote:
    "May graduation week fills fast. If you have a specific date near your ceremony, send an inquiry early.",
};

export const metadata: Metadata = buildSchoolMetadata(data);

export default function SJSUGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
