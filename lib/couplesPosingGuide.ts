export const COUPLES_PROMPT_CATEGORIES = [
  "Walking and Movement",
  "Playful",
  "Standing and Intimate",
  "From Behind",
  "Sitting",
  "Piggyback and Lifts",
] as const;

export const COUPLES_INSPIRATION_CATEGORIES = [
  ...COUPLES_PROMPT_CATEGORIES,
  "Lighting",
  "Composition",
  "Styling",
  "Documentary Moments",
  "Detail Shots",
  "Other",
] as const;

export const COUPLES_IMAGE_VISIBILITIES = [
  "private",
  "client_shareable",
  "public",
] as const;

export const COUPLES_INSPIRATION_BUCKET = "couples-posing-inspiration";
export const COUPLES_INSPIRATION_TABLE = "couples_inspiration_images";
export const COUPLES_PROMPTS_TABLE = "couples_posing_prompts";
export const COUPLES_GUIDE_FAVORITES_KEY = "couples_guide_favorites";
export const COUPLES_GUIDE_USED_KEY = "couples_guide_recently_used";
export const MAX_COUPLES_IMAGE_BYTES = 6 * 1024 * 1024;
export const COUPLES_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type CouplesPromptCategory = (typeof COUPLES_PROMPT_CATEGORIES)[number];
export type CouplesInspirationCategory = (typeof COUPLES_INSPIRATION_CATEGORIES)[number];
export type CouplesImageVisibility = (typeof COUPLES_IMAGE_VISIBILITIES)[number];
export type CouplesGuideMode = "photographer" | "client" | "public";

export type CouplesPosingPrompt = {
  number: number;
  slug: string;
  title: string;
  category: CouplesPromptCategory;
  instructions: string;
  keywords: string[];
};

export type AdminCouplesPosingPrompt = CouplesPosingPrompt & {
  id: string;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type CouplesInspirationImage = {
  id: string;
  storage_path: string | null;
  external_source_url: string | null;
  image_url: string | null;
  title: string;
  internal_notes: string | null;
  client_notes: string | null;
  creator_name: string | null;
  attribution_text: string | null;
  categories: string[];
  tags: string[];
  related_prompt_number: number | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  visibility: CouplesImageVisibility;
  is_published: boolean;
  display_order: number;
  rights_confirmed: boolean;
  created_at: string;
  updated_at: string;
};

export function normalizeCouplesPromptRow<T extends { prompt_number: number }>(
  row: T,
): Omit<T, "prompt_number"> & { number: number } {
  const { prompt_number: number, ...prompt } = row;
  return { ...prompt, number };
}

const prompt = (
  number: number,
  slug: string,
  title: string,
  category: CouplesPromptCategory,
  instructions: string,
  keywords: string[],
): CouplesPosingPrompt => ({ number, slug, title, category, instructions, keywords });

export const COUPLES_POSING_PROMPTS: CouplesPosingPrompt[] = [
  prompt(1, "high-arm-swing-walk", "High Arm Swing Walk", "Walking and Movement", "Have them slowly walk toward the camera while looking at each other and swinging their arms really high", ["walk", "arms", "movement"]),
  prompt(2, "drunk-walk", "Drunk Walk", "Walking and Movement", "Have them act like they’re drunk while walking in place or slowly walking toward the camera\n\nThey should hold hands, lean into each other, and bump hips as they walk", ["walk", "hands", "hips", "playful"]),
  prompt(3, "she-leads-him", "She Leads Him", "Walking and Movement", "Have them hold hands and let her take the lead\n\nShe should walk ahead of him, look back at him, and guide him forward\n\nWhile they’re moving, have her pull him toward her so they end up really close, looking at each other and smiling", ["walk", "lead", "hands", "pull"]),
  prompt(4, "arm-hold-walk", "Arm-Hold Walk", "Walking and Movement", "Have him place one hand in his pocket and leave his other arm hanging naturally\n\nHave her wrap both hands around his free arm and walk very close beside him toward the camera\n\nTell them to alternate between looking where they’re walking and looking at each other", ["walk", "arm", "close"]),
  prompt(5, "swimming-arms-walk", "Swimming Arms Walk", "Walking and Movement", "Have him stand directly behind her while they hold hands\n\nBring their arms outward to the sides and have them walk toward the camera while moving their arms like they’re swimming through water\n\nHave them look at each other as they move", ["walk", "behind", "arms", "swimming"]),
  prompt(6, "walk-away-together", "Walk Away Together", "Walking and Movement", "Have them walk off into the distance together and pretend I’m not there", ["walk", "away", "candid"]),
  prompt(7, "circle-chase", "Circle Chase", "Playful", "Have them chase each other around in a circle\n\nThe girl should look back at him and smile like she’s barely getting away while the guy runs after her\n\nTell them they’re just playing and not to take the movement too seriously", ["chase", "circle", "run", "playful"]),
  prompt(8, "playfully-refuse-the-kiss", "Playfully Refuse the Kiss", "Playful", "Have the guy try to kiss her on the cheek while she playfully turns her head away and tries not to let him kiss her\n\nThey should stay close and hold onto each other while doing it", ["kiss", "cheek", "playful"]),
  prompt(9, "ring-around-the-rosie", "Ring Around the Rosie", "Playful", "Have them hold hands and play Ring Around the Rosie together\n\nLet them spin, laugh, and move naturally", ["spin", "laugh", "hands", "playful"]),
  prompt(10, "airport-hug", "Airport Hug", "Playful", "Start them far apart and facing away from each other\n\nOn the count of three, have them turn around, run toward each other, and give each other a huge bear hug\n\nTell them to hug like they haven’t seen each other in months and are finally seeing each other at the airport", ["run", "hug", "airport", "playful"]),
  prompt(11, "chase-catch-and-swing", "Chase, Catch, and Swing", "Playful", "Have the girl run away while the guy chases after her\n\nHave him catch her from behind, wrap his arms around her, pick her up, and swing her around", ["chase", "catch", "lift", "swing"]),
  prompt(12, "sit-and-kiss-from-behind", "Sit and Kiss From Behind", "Standing and Intimate", "Have the guy sit down\n\nHave the girl stand behind him, lean over him, and go in for a kiss from behind", ["sit", "kiss", "behind"]),
  prompt(13, "whisper-a-random-answer", "Whisper a Random Answer", "Standing and Intimate", "Have them stand facing each other and hold hands\n\nHave him lean toward her and whisper something into her ear, such as his favorite cereal\n\nPhotograph her reaction rather than the whisper itself", ["whisper", "reaction", "hands", "intimate"]),
  prompt(14, "smell-her-hair", "Smell Her Hair", "Standing and Intimate", "Have him stand behind her and wrap his arms around her waist\n\nHave them overlap or hold hands around her waist\n\nTell him to smell her hair while she turns her face toward the direction he’s smelling", ["behind", "hair", "hug", "waist"]),
  prompt(15, "hands-in-back-pockets", "Hands in Back Pockets", "Standing and Intimate", "Have them stand face to face and get extremely close\n\nPlace his hands inside her back pockets and have her place her hands against his chest\n\nHave them gently squish together\n\nUse this for a tighter detail shot", ["hands", "pockets", "close", "detail"]),
  prompt(16, "walk-up-and-touch-noses", "Walk Up and Touch Noses", "Standing and Intimate", "Have him remain still while she slowly walks toward him\n\nHave her place one arm around his neck and the other around his stomach or waist\n\nTell her to try touching her nose to his nose and then lean into him", ["walk", "nose", "neck", "waist"]),
  prompt(17, "nose-rub", "Nose Rub", "Standing and Intimate", "Have them stand face to face\n\nHer hands should be on his shoulders and his hands should be around her waist\n\nHave them gently rub their noses together and smile at each other", ["nose", "smile", "waist", "intimate"]),
  prompt(18, "temple-kiss", "Temple Kiss", "Standing and Intimate", "Have them stand side by side\n\nTell him to pull her closer and kiss her on the temple", ["kiss", "temple", "close"]),
  prompt(19, "swimming-arms-into-a-hug", "Swimming Arms Into a Hug", "From Behind", "Have him stand behind her with her back against his chest\n\nHave them hold hands and extend their arms outward\n\nTell them to wave their arms around like they’re swimming in place\n\nOn the count of three, have him pull her arms inward and wrap her in a hug", ["behind", "arms", "swimming", "hug"]),
  prompt(20, "head-on-his-back-and-cheek-kiss", "Head on His Back and Cheek Kiss", "From Behind", "Have her stand behind him and rest her head against his back\n\nHave them hold hands\n\nPlace her far hand, the hand away from the camera, on his cheek and have her gently pull his head toward her\n\nThen have her kiss him on the cheek while he smiles", ["behind", "head", "cheek", "kiss"]),
  prompt(21, "head-on-his-neck", "Head on His Neck", "From Behind", "Have her stand directly behind him while they hold hands\n\nHave her rest her head against his neck\n\nTell them to look toward each other and make sure he smiles", ["behind", "head", "neck", "smile"]),
  prompt(22, "seated-cuddle", "Seated Cuddle", "Sitting", "Have him sit down with her sitting between his legs\n\nHer legs should be kicked outward to one side\n\nHave them cuddle closely and tell him to gently hold her cheek", ["sit", "cuddle", "legs", "cheek"]),
  prompt(23, "piggyback-sway", "Piggyback Sway", "Piggyback and Lifts", "Have her jump onto his back for a piggyback ride\n\nTell them to sway from side to side and look up toward each other\n\nHave her whisper something into his ear, smile near his ear, and give him small kisses on the cheek or ear", ["piggyback", "lift", "sway", "whisper", "kiss"]),
];

export function filterCouplesPosingPrompts(
  prompts: CouplesPosingPrompt[],
  search: string,
  category = "All",
) {
  const needle = search.trim().toLowerCase();
  return prompts.filter((item) => {
    if (category !== "All" && item.category !== category) return false;
    if (!needle) return true;
    return [
      item.title,
      item.instructions,
      item.category,
      ...item.keywords,
    ].some((value) => value.toLowerCase().includes(needle));
  });
}

export function filterInspirationImagesForMode<T extends {
  visibility: string;
  is_published: boolean;
  rights_confirmed: boolean;
}>(images: T[], mode: CouplesGuideMode) {
  if (mode === "photographer") return images;
  if (mode === "public") {
    return images.filter((image) =>
      image.is_published &&
      image.visibility === "public" &&
      image.rights_confirmed
    );
  }
  return images.filter((image) =>
    image.is_published &&
    (
      image.visibility === "client_shareable" ||
      (image.visibility === "public" && image.rights_confirmed)
    )
  );
}

export function getOwnedStoragePaths(
  images: Array<{ storage_path: string | null; external_source_url: string | null }>,
) {
  return images.flatMap((image) => {
    const path = image.storage_path?.trim();
    return path ? [path] : [];
  });
}

function optionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function stringList(value: unknown, allowed?: readonly string[]) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const trimmed = item.trim();
    if (!trimmed || (allowed && !allowed.includes(trimmed))) return [];
    return [trimmed.slice(0, 80)];
  }))).slice(0, 20);
}

export function createCouplesPromptSlug(title: string) {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "couples-prompt";
}

export function validateCouplesPromptInput(input: Record<string, unknown>) {
  const title = optionalText(input.title, 160);
  if (!title) return { ok: false as const, error: "Prompt title is required." };

  const instructions = optionalText(input.instructions, 5000);
  if (!instructions) {
    return { ok: false as const, error: "Directing language is required." };
  }

  const category = COUPLES_PROMPT_CATEGORIES.includes(
    input.category as CouplesPromptCategory,
  ) ? input.category as CouplesPromptCategory : null;
  if (!category) return { ok: false as const, error: "Choose a prompt category." };

  return {
    ok: true as const,
    data: {
      title,
      instructions,
      category,
      keywords: stringList(input.keywords),
      display_order: Number.isFinite(Number(input.display_order))
        ? Math.max(0, Math.trunc(Number(input.display_order)))
        : 0,
      is_published: input.is_published !== false,
    },
  };
}

export function validateInspirationUpload(file: { type: string; size: number }) {
  if (!COUPLES_IMAGE_TYPES.includes(file.type as (typeof COUPLES_IMAGE_TYPES)[number])) {
    return { ok: false as const, error: "Upload a JPEG, PNG, WebP, or AVIF image." };
  }
  if (file.size > MAX_COUPLES_IMAGE_BYTES) {
    return { ok: false as const, error: "Images must be 6 MB or smaller." };
  }
  return { ok: true as const };
}

export function validateInspirationImageInput(input: Record<string, unknown>) {
  const title = optionalText(input.title, 160);
  if (!title) return { ok: false as const, error: "Image title is required." };

  const visibility = COUPLES_IMAGE_VISIBILITIES.includes(
    input.visibility as CouplesImageVisibility,
  ) ? input.visibility as CouplesImageVisibility : "private";
  const rightsConfirmed = input.rights_confirmed === true;
  if (visibility === "public" && !rightsConfirmed) {
    return {
      ok: false as const,
      error: "Confirm that you own this image or have permission to display it publicly.",
    };
  }

  const storagePath = optionalText(input.storage_path, 500);
  const externalSourceUrl = optionalText(input.external_source_url, 2000);
  if (externalSourceUrl) {
    try {
      const url = new URL(externalSourceUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      return { ok: false as const, error: "Enter a valid source URL." };
    }
  }
  if (externalSourceUrl && !storagePath && visibility !== "private") {
    return {
      ok: false as const,
      error: "External references must remain private until an authorized copy is uploaded.",
    };
  }

  const promptNumber = Number(input.related_prompt_number);
  const relatedPromptNumber = Number.isInteger(promptNumber) && promptNumber > 0
    ? promptNumber
    : null;

  return {
    ok: true as const,
    data: {
      title,
      storage_path: storagePath,
      external_source_url: externalSourceUrl,
      internal_notes: optionalText(input.internal_notes, 4000),
      client_notes: optionalText(input.client_notes, 2000),
      creator_name: optionalText(input.creator_name, 160),
      attribution_text: optionalText(input.attribution_text, 500),
      categories: stringList(input.categories, COUPLES_INSPIRATION_CATEGORIES),
      tags: stringList(input.tags),
      related_prompt_number: relatedPromptNumber,
      width: Number.isInteger(Number(input.width)) && Number(input.width) > 0
        ? Number(input.width)
        : null,
      height: Number.isInteger(Number(input.height)) && Number(input.height) > 0
        ? Number(input.height)
        : null,
      alt_text: optionalText(input.alt_text, 300),
      visibility,
      is_published: input.is_published === true,
      display_order: Number.isFinite(Number(input.display_order))
        ? Math.max(0, Math.trunc(Number(input.display_order)))
        : 0,
      rights_confirmed: rightsConfirmed,
      owns_storage_object: Boolean(storagePath),
    },
  };
}
