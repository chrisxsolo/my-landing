import type { Metadata } from "next";
import { data } from "./data";
import SchoolLandingTemplate, { buildSchoolMetadata, schoolSocialImage } from "@/app/components/SchoolLandingTemplate";

export const revalidate = 3600; // hourly ISR backstop; publish revalidates /grads/<slug> directly

export async function generateMetadata(): Promise<Metadata> {
  return buildSchoolMetadata(data, await schoolSocialImage(data));
}

export default function USFGradPage() {
  return <SchoolLandingTemplate data={data} />;
}
