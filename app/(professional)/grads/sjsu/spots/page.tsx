import type { Metadata } from "next";
import { data } from "../data";
import SchoolSpotsTemplate, { buildSpotsMetadata } from "@/app/components/SchoolSpotsTemplate";

export const revalidate = 3600; // hourly ISR backstop

export const metadata: Metadata = buildSpotsMetadata(data);

export default function SJSUSpotsPage() {
  return <SchoolSpotsTemplate data={data} />;
}
