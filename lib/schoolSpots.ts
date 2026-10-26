// Campus photo spots that a school guide (/grads/<slug>/spots) has a section
// for. A spot key is the stable identity stored in school_spot_photos, so keys
// must never change once photos are tagged. Pure module — safe for client
// components (the admin tag picker reads it).
//
// Tags are set by the photographer only. suggestSpotFromText() reads a photo's
// own title/alt text and is shown in admin as a hint to confirm; it never tags
// a photo by itself, because AI-written alt text guesses at scenery.
import type { SchoolSlug } from "@/lib/contentEngine/taxonomy";

export const SCHOOL_SPOT_PHOTOS_TABLE = "school_spot_photos";

export interface SchoolSpotDef {
  key: string;
  /** Short label for admin and image alt text. */
  name: string;
  /** location_spots rows (/grad-guide/campus-spots) that show this same spot. */
  campusSpotNames: readonly string[];
  /** Words in a photo's own text that suggest this spot (hint only). */
  hintTerms: readonly string[];
}

export const SCHOOL_SPOTS: Partial<Record<SchoolSlug, readonly SchoolSpotDef[]>> = {
  sjsu: [
    {
      key: "sjsu-sign", name: "SJSU Sign",
      campusSpotNames: ["The SJSU Sign Wall"],
      hintTerms: ["sjsu sign", "san jose state sign", "san jose state university sign", "campus sign", "sign wall"],
    },
    {
      key: "tower-hall-lawn", name: "Tower Hall Lawn",
      campusSpotNames: [],
      hintTerms: ["tower hall lawn", "tower lawn", "tower hall"],
    },
    {
      key: "student-union", name: "Student Union on 7th Street",
      campusSpotNames: ["Student Union Center"],
      hintTerms: ["student union"],
    },
    {
      key: "seventh-street-palms", name: "7th Street Palm Trees",
      campusSpotNames: ["7th Street Palm Trees"],
      hintTerms: ["palm", "7th street", "seventh street"],
    },
    {
      key: "tower-hall-steps", name: "Steps near Tower Hall Lawn",
      campusSpotNames: ["Tower Lawn Steps"],
      hintTerms: ["tower hall steps", "tower lawn steps"],
    },
  ],
};

export const SPOT_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function spotsForSchool(slug: string): readonly SchoolSpotDef[] {
  return SCHOOL_SPOTS[slug as SchoolSlug] ?? [];
}

export function isSchoolSpotKey(slug: string, key: unknown): key is string {
  return typeof key === "string" && spotsForSchool(slug).some((spot) => spot.key === key);
}

const normalize = (text: string) =>
  text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ");

/**
 * The single spot a photo's own text names, for an admin hint. A term inside
 * a longer matched term doesn't count ("tower hall" in "tower hall steps");
 * two different spots named → no hint.
 */
export function suggestSpotFromText(slug: string, text: string): SchoolSpotDef | null {
  const haystack = ` ${normalize(text)} `;
  const hits = spotsForSchool(slug).flatMap((spot) =>
    spot.hintTerms
      .map((term) => normalize(term).trim())
      .filter((term) => haystack.includes(` ${term} `))
      .map((term) => ({ spot, term })));
  const specific = hits.filter((h) => !hits.some((o) => o.term !== h.term && o.term.includes(h.term)));
  const keys = new Set(specific.map((h) => h.spot.key));
  return keys.size === 1 ? specific[0].spot : null;
}
