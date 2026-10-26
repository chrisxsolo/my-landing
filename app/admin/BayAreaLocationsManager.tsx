"use client";
// The Bay Guide tab now shows the Content Engine's location library — the
// same screen as /admin/content-engine/locations — so the public guide has
// one editor and one source of truth.
import LocationLibrary from "@/app/admin/content-engine/locations/LocationLibrary";

export default function BayAreaLocationsManager() {
  return <LocationLibrary embedded />;
}
