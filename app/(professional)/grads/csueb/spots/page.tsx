import type { Metadata } from "next";
import { data } from "../data";
import SchoolSpotsTemplate, { buildSpotsMetadata } from "@/app/components/SchoolSpotsTemplate";
import { schoolSocialImage } from "@/app/components/SchoolLandingTemplate";

export const revalidate = 3600; // hourly ISR backstop

export async function generateMetadata(): Promise<Metadata> {
  return buildSpotsMetadata(data, await schoolSocialImage(data));
}

export default function CSUEBSpotsPage() {
  return <SchoolSpotsTemplate data={data} />;
}
