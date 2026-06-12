import type { Metadata } from "next";
import SchoolLandingTemplate, { buildSchoolMetadata, type SchoolLandingData } from "@/app/components/SchoolLandingTemplate";

export const revalidate = 3600; // hourly ISR backstop; publish revalidates /grads/<slug> directly

const data: SchoolLandingData = {
  school: "Stanford University",
  schoolShort: "Stanford",
  slug: "stanford",
  city: "Stanford, CA",
  metaTitle: "Stanford University Graduation Photographer",
  metaDescription:
    "Graduation portraits at Stanford University by Chris Solorzano. Main Quad, Memorial Church, Palm Drive, Hoover Tower — clean direction, fast communication, private gallery delivery.",
  canonicalPath: "/grads/stanford",
  heroTagline:
    "Clean, directed graduation portraits around Stanford's most iconic campus spots — the Main Quad, Memorial Church, Palm Drive, and Hoover Tower. I guide every session so you always know what to do and the photos feel natural.",
  bodyIntro:
    "Stanford is one of the most striking campuses in the Bay Area for grad portraits — sandstone arches, the mosaic facade of Memorial Church, and the long palm approach give sessions a grand, editorial feel. I've shot grad sessions across the Peninsula and South Bay and know which Stanford spots hold the best light through the afternoon, which areas stay quiet on busy ceremony days, and how to route a session so you get real variety without ever feeling rushed.",
  spots: [
    {
      name: "Main Quad & Memorial Church",
      description:
        "The signature Stanford backdrop. Sandstone arcades and the gold-mosaic facade of MemChu make instantly recognizable, timeless portraits. Soft, even light fills the arches through the afternoon.",
    },
    {
      name: "Palm Drive",
      description:
        "The long palm-lined approach to campus offers dramatic symmetry and depth. Best framed toward the foothills late in the day for a warm, polished look.",
    },
    {
      name: "Hoover Tower",
      description:
        "A landmark vertical backdrop with clean architectural lines. The surrounding lawns and walkways give plenty of variety within a short walk.",
    },
    {
      name: "The Oval & Arizona Cactus Garden",
      description:
        "Open lawn for wide, editorial compositions and the classic cap-toss, plus the unique textures of the historic cactus garden just a short walk away.",
    },
  ],
  sessionNote:
    "Spring graduation season (June) books quickly — inquire early if you have a specific date in mind.",
};

export const metadata: Metadata = buildSchoolMetadata(data);

export default function StanfordGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
