import type { Metadata } from "next";
import SchoolLandingTemplate, { buildSchoolMetadata, type SchoolLandingData } from "@/app/components/SchoolLandingTemplate";

const data: SchoolLandingData = {
  school: "USF",
  schoolShort: "USF",
  slug: "usf",
  city: "San Francisco, CA",
  metaTitle: "USF Graduation Photographer | University of San Francisco",
  metaDescription:
    "Graduation portraits at the University of San Francisco by Chris Solorzano. St. Ignatius, Lone Mountain, Kalmanovitz Hall — no travel fee, guided sessions, fast delivery.",
  canonicalPath: "/grads/usf",
  heroTagline:
    "Graduation portraits at the University of San Francisco — a beautiful campus with strong architecture and one of the best views in the city. No travel fee, and the option to extend into nearby SF locations.",
  bodyIntro:
    "USF has one of the most visually distinctive campuses in San Francisco — St. Ignatius Church, the Lone Mountain steps, and the view corridors toward the city skyline all photograph exceptionally well. Being located in San Francisco also means no travel fee and the flexibility to add nearby locations if you want more variety in the gallery.",
  spots: [
    {
      name: "St. Ignatius Church",
      description:
        "The architectural centerpiece of USF. The steps and facade are classic for formal portraits, and the interior light is beautiful for detail shots.",
    },
    {
      name: "Lone Mountain Steps",
      description:
        "Iconic location with panoramic views of San Francisco. Works especially well in late afternoon and golden hour.",
    },
    {
      name: "Kalmanovitz Hall",
      description:
        "Modern architecture with clean lines and shade. Good option for a different visual texture within the same session.",
    },
    {
      name: "Campus Green / Quad Area",
      description:
        "Open lawn with good shade from mature trees. Relaxed and versatile for group shots or candid frames.",
    },
  ],
  travelNote: "No travel fee for USF — all San Francisco campus sessions are included.",
  sessionNote:
    "USF commencement is typically in late May. Early inquiries are recommended for peak spring dates.",
};

export const metadata: Metadata = buildSchoolMetadata(data);

export default function USFGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
