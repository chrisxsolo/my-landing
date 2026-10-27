// The public site reads a Content Engine photo's own confirmed location
// (session_photos.photo_location) before any session-level location, so a
// shoot at several places puts each photo on the right location page.
import { describe, expect, it } from "vitest";
import { KNOWN_PLACES } from "@/lib/locations/places";
import { engineSourceFrom, toPortfolioSource } from "@/lib/pagePhotos/pool";
import { enginePhotoPlace, resolvePhoto, type EngineSource } from "@/lib/pagePhotos/resolve";

const BASE = "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

function engineRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "22222222-2222-4222-8222-000000000001", public_derivative_url: null, content_hash: null, excluded: false,
    quality_score: 8, width: 4000, height: 6000, gps_latitude: null, gps_longitude: null,
    photo_location: null, photo_location_source: null,
    photography_sessions: {
      id: SESSION_ID, public_display_name: "Ana & Leo", service_type: "couples", school_slug: null,
      primary_location: "Palace of Fine Arts", secondary_locations: ["Legion of Honor"],
      marketing_permission: true, marketing_permission_revoked_at: null,
    },
    ...overrides,
  };
}

describe("the public site reads photo-level locations", () => {
  const engine = (overrides: Partial<EngineSource> = {}): EngineSource => ({
    url: `${BASE}p1.jpg`, contentHash: null, sessionId: SESSION_ID, sessionName: "Ana & Leo", serviceType: "couples",
    schoolSlug: null, primaryLocation: "Palace of Fine Arts", secondaryLocations: ["Legion of Honor", "Crissy Field"],
    gpsLatitude: null, gpsLongitude: null, publishable: true, excluded: false, quality: 8, width: 4000, height: 6000,
    ...overrides,
  });

  it("reads photo_location from the session photo row", () => {
    const source = engineSourceFrom(engineRow({ photo_location: "Legion of Honor", photo_location_source: "manual" }), "u");
    expect(source).toMatchObject({ photoLocation: "Legion of Honor", photoLocationSource: "manual" });
  });

  it("places a photo by its own location before the session's", () => {
    expect(enginePhotoPlace(engine({ photoLocation: "Legion of Honor", photoLocationSource: "manual" }), KNOWN_PLACES)?.key)
      .toBe("legion-of-honor");
    // A single-location session no longer overrides the photo's own place.
    expect(enginePhotoPlace(engine({
      secondaryLocations: [], photoLocation: "Crissy Field", photoLocationSource: "manual",
    }), KNOWN_PLACES)?.key).toBe("crissy-field");
    // Unconfirmed photos of a multi-location session stay unplaced.
    expect(enginePhotoPlace(engine(), KNOWN_PLACES)).toBeNull();
  });

  it("puts a couples photo confirmed at the Palace on the Palace couples page (and only there)", () => {
    const row = { id: 1, title: "Couple", alt: "Couple", image_url: `${BASE}p1.jpg`, category_slug: "couples",
      featured: false, sort_order: 1, width: 4000, height: 6000, content_hash: null, school: null, location: null, session_label: null };
    const ctx = { places: KNOWN_PLACES, dbGuides: [] };
    const atPalace = resolvePhoto(toPortfolioSource(row)!, engine({ photoLocation: "Palace of Fine Arts", photoLocationSource: "manual" }), ctx);
    expect(atPalace.pages).toEqual(["couples/palace-of-fine-arts"]);
    expect(atPalace.placeSource).toBe("tag");
    const unconfirmed = resolvePhoto(toPortfolioSource(row)!, engine(), ctx);
    expect(unconfirmed.pages).toEqual([]);
    const hidden = resolvePhoto(toPortfolioSource(row)!, engine({ photoLocation: "Palace of Fine Arts", publishable: false }), ctx);
    expect(hidden.pages).toEqual([]);
  });

  it("never lets a session-level location beat the photographer's portfolio tag", () => {
    const row = { id: 2, title: "Couple", alt: "Couple", image_url: `${BASE}p1.jpg`, category_slug: "couples",
      featured: false, sort_order: 1, width: 4000, height: 6000, content_hash: null, school: null,
      location: "Crissy Field", session_label: null };
    const resolved = resolvePhoto(toPortfolioSource(row)!, engine({ photoLocation: "Legion of Honor" }), { places: KNOWN_PLACES, dbGuides: [] });
    expect(resolved.placeKey).toBe("crissy-field");
  });
});

