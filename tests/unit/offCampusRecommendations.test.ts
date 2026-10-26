import { describe, expect, it } from "vitest";
import type { SchoolLandingData } from "@/app/components/SchoolLandingTemplate";
import { SF_OFF_CAMPUS_SPOTS } from "@/app/(professional)/grads/sfOffCampus";
import { data as csueb } from "@/app/(professional)/grads/csueb/data";
import { data as santaClara } from "@/app/(professional)/grads/santa-clara/data";
import { data as sfState } from "@/app/(professional)/grads/sf-state/data";
import { data as sjsu } from "@/app/(professional)/grads/sjsu/data";
import { data as stanford } from "@/app/(professional)/grads/stanford/data";
import { data as ucBerkeley } from "@/app/(professional)/grads/uc-berkeley/data";
import { data as usf } from "@/app/(professional)/grads/usf/data";
import { normalizePlaceName } from "@/lib/locations/match";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { SCHOOL_SPOTS, SF_OFF_CAMPUS_SPOT_DEFS, spotsForSchool } from "@/lib/schoolSpots";

// Off-campus recommendations on school pages come only from a verified,
// shared collection. A place being near a campus, or appearing in Content
// Engine sessions, never makes it a recommendation.
const SCHOOL_PAGES: Record<string, SchoolLandingData> = {
  "uc-berkeley": ucBerkeley, sjsu, usf, "sf-state": sfState, csueb, stanford, "santa-clara": santaClara,
};
const SF_SCHOOLS = ["sf-state", "usf"];
const SF_KEYS = SF_OFF_CAMPUS_SPOT_DEFS.map((s) => s.key);

function placesNamedIn(page: SchoolLandingData): string[] {
  const text = ` ${normalizePlaceName(JSON.stringify(page))} `;
  return KNOWN_PLACES
    .filter((p) => [p.name, ...p.aliases].some((n) => text.includes(` ${normalizePlaceName(n)} `)))
    .map((p) => p.key);
}

describe("shared San Francisco off-campus locations", () => {
  it("content and photo-tag definitions list the same verified places", () => {
    expect(SF_OFF_CAMPUS_SPOTS.map((s) => s.key)).toEqual(SF_KEYS);
    const placeKeys = new Set(KNOWN_PLACES.map((p) => p.key));
    expect(SF_OFF_CAMPUS_SPOT_DEFS.every((d) => d.placeKey === d.key && placeKeys.has(d.key))).toBe(true);
  });

  it("SF State and USF show the same off-campus list and keep their own campus spots", () => {
    for (const slug of SF_SCHOOLS) {
      expect(SCHOOL_PAGES[slug].spotsGuide!.offCampus!.spots).toEqual([...SF_OFF_CAMPUS_SPOTS]);
      expect(spotsForSchool(slug).filter((s) => s.placeKey).map((s) => s.key)).toEqual(SF_KEYS);
    }
    const campus = (slug: string) => SCHOOL_PAGES[slug].spots.map((s) => s.key);
    expect(campus("usf").filter((k) => campus("sf-state").includes(k!))).toEqual([]);
  });
});

describe("no school page recommends an unverified place", () => {
  it("only SF schools have off-campus spots, and only from the shared list", () => {
    for (const [slug, defs] of Object.entries(SCHOOL_SPOTS)) {
      const offCampus = (defs ?? []).filter((d) => d.placeKey).map((d) => d.key);
      expect(offCampus).toEqual(SF_SCHOOLS.includes(slug) ? SF_KEYS : []);
    }
    for (const [slug, page] of Object.entries(SCHOOL_PAGES)) {
      if (!SF_SCHOOLS.includes(slug)) expect(page.spotsGuide?.offCampus).toBeUndefined();
    }
  });

  it.each(Object.keys(SCHOOL_PAGES))("%s names no known place outside its verified off-campus list", (slug) => {
    const allowed = spotsForSchool(slug).flatMap((s) => (s.placeKey ? [s.placeKey] : []));
    expect(placesNamedIn(SCHOOL_PAGES[slug]).filter((key) => !allowed.includes(key))).toEqual([]);
  });
});
