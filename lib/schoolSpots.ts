// Campus photo spots that a school guide (/grads/<slug>/spots) has a section
// for. A spot key is the stable identity stored in school_spot_photos, so keys
// must never change once photos are tagged. Pure module — safe for client
// components (the admin tag picker reads it).
//
// Tags are set by the photographer only. suggestSpotFromText() reads a photo's
// own title/alt text and is shown in admin as a hint to confirm; it never tags
// a photo by itself, because AI-written alt text guesses at scenery.
//
// An off-campus spot names its verified place (placeKey, lib/locations/places).
// Its section also shows untagged photos from this school whose location
// evidence (photo location tag, session location, or GPS for multi-location
// sessions) is that exact place — until the photographer tags any photo for
// it, after which the section is only the tagged photos.
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
  /** Known place this off-campus spot is (lib/locations/places key). */
  placeKey?: string;
  /**
   * A composition inside another spot's guide section (the church walkway
   * under St. Ignatius Church). Its photos keep their own tag but show in the
   * parent's section, after the parent's own photos.
   */
  parentKey?: string;
}

/**
 * The verified San Francisco off-campus graduation locations, shared by the SF
 * State and USF guides (content in app/(professional)/grads/sfOffCampus.ts).
 * Each school keeps its own photo tags under the same keys. Only add a place
 * Chris has established as a graduation recommendation.
 */
export const SF_OFF_CAMPUS_SPOT_DEFS: readonly SchoolSpotDef[] = [
  {
    key: "palace-of-fine-arts", name: "Palace of Fine Arts", altPlace: "at the Palace of Fine Arts",
    campusSpotNames: [], placeKey: "palace-of-fine-arts",
    hintTerms: ["palace of fine arts"],
  },
  {
    key: "legion-of-honor", name: "Legion of Honor", altPlace: "at the Legion of Honor",
    campusSpotNames: [], placeKey: "legion-of-honor",
    hintTerms: ["legion of honor"],
  },
  {
    key: "crissy-field", name: "Crissy Field", altPlace: "at Crissy Field",
    campusSpotNames: [], placeKey: "crissy-field",
    hintTerms: ["crissy field"],
  },
  {
    key: "golden-gate-bridge-welcome-center", name: "Golden Gate Bridge Welcome Center",
    altPlace: "near the Golden Gate Bridge Welcome Center",
    campusSpotNames: [], placeKey: "golden-gate-bridge-welcome-center",
    hintTerms: ["golden gate bridge welcome center", "bridge welcome center", "golden gate bridge visitor center"],
  },
];

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
  // doe-library-interior isn't a numbered spot: its photos show in the
  // guide's "Inside Doe Library" section.
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
      key: "doe-library-interior", name: "Inside Doe Library", altPlace: "inside Doe Library",
      campusSpotNames: ["Inside Doe Library"],
      hintTerms: ["inside doe library", "doe library interior", "wingback", "library chair", "reading room"],
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
  // SF State: Chris's five campus spots, then the four San Francisco places
  // his SF State graduates book most. Off-campus keys equal their place keys.
  // The library is exterior only; the garden is a memorial, named as such.
  "sf-state": [
    {
      key: "sfsu-entrance-sign", name: "SFSU Entrance Sign", altPlace: "at the SF State entrance sign",
      campusSpotNames: ["SFSU Sign & Main Entrance"],
      hintTerms: ["sfsu sign", "sf state sign", "san francisco state sign", "entrance sign", "university sign", "19th and holloway", "19th avenue and holloway"],
    },
    {
      key: "sfsu-main-quad", name: "SFSU Main Quad", altPlace: "on the SF State quad",
      campusSpotNames: ["Campus Green & Open Quad"],
      hintTerms: ["main quad", "sfsu quad", "sf state quad", "campus quad"],
    },
    {
      key: "j-paul-leonard-library", name: "J. Paul Leonard Library", altPlace: "outside the J. Paul Leonard Library",
      campusSpotNames: [],
      hintTerms: ["j paul leonard", "leonard library", "sfsu library", "sf state library"],
    },
    {
      key: "sfsu-gator-statue", name: "SFSU Gator Statue", altPlace: "with the SF State Gator statue",
      campusSpotNames: [],
      hintTerms: ["gator statue", "gator sculpture", "gator spirit statue", "sfsu gator", "sf state gator", "don nasser"],
    },
    {
      key: "garden-of-remembrance", name: "Ruth Asawa Garden of Remembrance", altPlace: "at the Garden of Remembrance",
      campusSpotNames: [],
      hintTerms: ["garden of remembrance", "ruth asawa", "sfsu waterfall", "sf state waterfall", "sfsu rock garden", "sf state rock garden"],
    },
    ...SF_OFF_CAMPUS_SPOT_DEFS,
  ],
  // USF: Chris's six guide areas as eight compositions. The church walkway and
  // the Lone Mountain main-building background are children of their guide
  // sections; the stairs stay their own section. "Glass hallway" is Chris's
  // name for it until the building is confirmed. Bare "Lone Mountain" names
  // three spots, so it gives no hint; "Lyon Street Steps" is off campus and
  // must never hint the Lone Mountain stairs.
  usf: [
    {
      key: "st-ignatius-church", name: "St. Ignatius Church", altPlace: "in front of St. Ignatius Church",
      campusSpotNames: ["In Front of Church", "St. Ignatius Church Steps"],
      hintTerms: ["st ignatius", "saint ignatius", "st ignatius church", "saint ignatius church"],
    },
    {
      key: "st-ignatius-walkway", name: "St. Ignatius Church Walkway", altPlace: "on the walkway in front of St. Ignatius Church",
      campusSpotNames: [], parentKey: "st-ignatius-church",
      hintTerms: ["st ignatius walkway", "saint ignatius walkway", "church walkway"],
    },
    {
      key: "gleeson-library", name: "Gleeson Library | Geschke Center", altPlace: "outside Gleeson Library",
      campusSpotNames: ["Gleeson Library"],
      hintTerms: ["gleeson", "gleeson library", "geschke", "geschke center"],
    },
    {
      key: "los-lobos-de-loyola", name: "Los Lobos de Loyola Wolf Sculpture", altPlace: "with the Los Lobos de Loyola wolf sculpture",
      campusSpotNames: [],
      hintTerms: ["los lobos", "lobos de loyola", "wolf sculpture", "wolf statue", "wolves sculpture", "wolves and kettle"],
    },
    {
      key: "usf-glass-hallway", name: "USF Glass Hallway", altPlace: "in the USF glass hallway",
      campusSpotNames: ["Glass Hallway"],
      hintTerms: ["glass hallway", "glass corridor", "glass hall"],
    },
    {
      key: "lone-mountain-stairs", name: "Lone Mountain Stairs", altPlace: "on the Lone Mountain stairs",
      campusSpotNames: [],
      hintTerms: ["lone mountain stairs", "lone mountain steps", "lone mountain staircase"],
    },
    {
      key: "lone-mountain-palm-walkway", name: "Lone Mountain Palm Tree Walkway", altPlace: "under the Lone Mountain palm trees",
      campusSpotNames: ["Lone Mountain"],
      hintTerms: ["palm walkway", "palm lined walkway", "palm tree walkway", "lone mountain palm", "lone mountain palms"],
    },
    {
      key: "lone-mountain-main-building", name: "Lone Mountain Main Building Background",
      altPlace: "with the Lone Mountain main building behind", campusSpotNames: [], parentKey: "lone-mountain-palm-walkway",
      hintTerms: ["lone mountain main", "lone mountain building", "lone mountain main building"],
    },
    ...SF_OFF_CAMPUS_SPOT_DEFS,
  ],
};

/**
 * Campus Spots (/grad-guide/campus-spots) schools whose spot text comes from
 * the school's location guide instead of location_spots rows: location_spots
 * school_id → school slug. Their location_spots rows still hold the photos.
 */
export const GUIDE_SYNCED_CAMPUS_SPOTS: Readonly<Record<string, SchoolSlug>> = { usf: "usf" };

export const SPOT_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function spotsForSchool(slug: string): readonly SchoolSpotDef[] {
  return SCHOOL_SPOTS[slug as SchoolSlug] ?? [];
}

/** Off-campus spot key per place key, for place-matched section photos. */
export function spotKeysByPlace(slug: string): Record<string, string> {
  return Object.fromEntries(spotsForSchool(slug).flatMap((spot) => (spot.placeKey ? [[spot.placeKey, spot.key]] : [])));
}

/** A guide section's photo keys: the spot itself, then its child compositions. */
export function sectionSpotKeys(slug: string, key: string): string[] {
  return [key, ...spotsForSchool(slug).filter((spot) => spot.parentKey === key).map((spot) => spot.key)];
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

/** Light tags + crowd notes per spot (vocabulary in lib/photoConditions.ts). */
export const SCHOOL_SPOT_CONDITIONS_TABLE = "school_spot_conditions";
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
