import type { Metadata } from "next";
import EngineShell from "@/app/admin/content-engine/EngineShell";
import LocationLibrary from "./LocationLibrary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Locations · Content Engine",
  description: "Bay Area location library fed by the Content Engine.",
  robots: { index: false, follow: false },
};

export default function ContentEngineLocationsPage() {
  return (
    <EngineShell>
      <LocationLibrary />
    </EngineShell>
  );
}
