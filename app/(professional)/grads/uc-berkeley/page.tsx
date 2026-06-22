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
  bestTime:
    "Sather Gate and the Campanile plaza are best in early morning, when the light is soft and the campus is quiet before foot traffic builds. Memorial Glade and Faculty Glade hold beautiful dappled light later in the day, so a morning start lets us catch the landmarks first and finish under the trees.",
  whatToWear:
    "Berkeley's stone, brick, and deep-green canopy make a rich backdrop, so solid, saturated colors read better than busy patterns. Bring your stole and any honor cords — they pop against the gown — and a second casual look photographs well on Memorial Glade once the cap-and-gown frames are done.",
  faqs: [
    { q: "What are the best photo spots at UC Berkeley?", a: "Sather Gate, the Campanile (Sather Tower), Memorial Glade, and Faculty Glade are the signature backdrops. In one session we usually hit two or three landmarks plus a quieter, tree-shaded spot for relaxed frames." },
    { q: "When should we shoot to avoid crowds at Sather Gate?", a: "Early morning is best — Sather Gate and the central plaza fill with foot traffic as the day goes on, so an early start keeps the iconic shots clean." },
    { q: "Can we take photos around commencement day?", a: "Yes, though ceremony days and the surrounding weekend are the busiest and book up first. If you want photos near your ceremony date, reach out early so we can lock in a time." },
    { q: "How early should I book a Berkeley grad session?", a: "Spring (May) is peak season and fills quickly. Inquiring a few weeks to a month ahead gives the best choice of dates, especially for weekend and golden-hour slots." },
  ],
};

export const metadata: Metadata = buildSchoolMetadata(data);

export default function UCBerkeleyGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
