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
  /** How alt text names the place ("at Sather Gate"); default "at the <name>". */
  altPlace?: string;
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
  // UC Berkeley: Chris's seven guide spots. The two Doe Library compositions
  // stay separate keys; bare "Doe Library" names both, so it gives no hint.
  // Never map the "Inside Doe Library" campus-spots row: the Library doesn't
  // allow staged graduation photos inside its buildings.
  "uc-berkeley": [
    {
      key: "sather-gate", name: "Sather Gate", altPlace: "at Sather Gate",
      campusSpotNames: ["Sather Gate"],
      hintTerms: ["sather gate"],
    },
    {
      key: "doe-library-entrance", name: "Doe Library Front Entrance", altPlace: "at the front of Doe Library",
      campusSpotNames: ["Front of Doe Library"],
      hintTerms: ["doe library", "doe memorial library", "front of doe library", "doe library entrance", "doe library steps", "doe library columns"],
    },
    {
      key: "doe-library-ledge", name: "Doe Library Ledge", altPlace: "on the Doe Library ledge",
      campusSpotNames: ["Doe Library Ledge"],
      hintTerms: ["doe library", "doe memorial library", "doe library ledge", "doe ledge"],
    },
    {
      key: "campanile", name: "Campanile (Sather Tower)", altPlace: "with the Campanile",
      campusSpotNames: ["The Campanile"],
      hintTerms: ["campanile", "sather tower"],
    },
    {
      key: "hearst-mining", name: "Hearst Memorial Mining Building", altPlace: "at the Hearst Memorial Mining Building",
      campusSpotNames: [],
      hintTerms: ["hearst mining", "hearst memorial mining"],
    },
    {
      key: "mining-circle", name: "Mining Circle and Rondo II", altPlace: "at Mining Circle",
      campusSpotNames: [],
      hintTerms: ["mining circle", "hearst mining circle", "rondo ii", "rondo 2"],
    },
    {
      key: "cherry-blossoms", name: "Cherry Blossoms (seasonal)", altPlace: "under the cherry blossoms",
      campusSpotNames: ["Cherry Blossoms"],
      hintTerms: ["cherry blossom", "cherry blossoms", "cherry tree", "cherry trees"],
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

// ── "Where to find it" notes (school_spot_notes) ────────────────────────────

export const SCHOOL_SPOT_NOTES_TABLE = "school_spot_notes";
export const SPOT_NOTE_MAX = 240;

/**
 * A photographer's location note as stored: one plain-text line, whitespace
 * collapsed, control characters removed. "" / null clears it; undefined means
 * the value is not acceptable (not a string, or too long).
 */
export function normalizeSpotNote(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (clean === "") return null;
  return clean.length <= SPOT_NOTE_MAX ? clean : undefined;
}
