import type { Metadata } from "next";
import { data } from "./data";
import SchoolLandingTemplate, { buildSchoolMetadata } from "@/app/components/SchoolLandingTemplate";

export const revalidate = 3600; // hourly ISR backstop; publish revalidates /grads/<slug> directly

export const metadata: Metadata = buildSchoolMetadata(data);

export default function StanfordGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
