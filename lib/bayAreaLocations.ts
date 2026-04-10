export type BayAreaLocationEntry = {
  id: number;
  title: string;
  slug: string;
  region: string;
  city: string;
  neighborhood: string | null;
  description: string;
  best_for: string;
  best_time: string;
  tip: string;
  tags: string[];
  image_url: string | null;
  order: number;
  active: boolean;
};

export const BAY_AREA_REGION_OPTIONS = [
  { value: "south-bay", label: "South Bay", shortLabel: "South Bay" },
  { value: "san-francisco", label: "San Francisco", shortLabel: "SF" },
  { value: "east-bay", label: "East Bay", shortLabel: "East Bay" },
  { value: "peninsula", label: "Peninsula", shortLabel: "Peninsula" },
  { value: "north-bay", label: "North Bay", shortLabel: "North Bay" },
] as const;

export const BAY_AREA_FILTER_CHIPS = [
  { value: "all", label: "All Spots" },
  { value: "south-bay", label: "South Bay" },
  { value: "san-francisco", label: "SF" },
  { value: "east-bay", label: "East Bay" },
  { value: "peninsula", label: "Peninsula" },
  { value: "beaches", label: "Beaches" },
] as const;

export const BAY_AREA_TAG_SUGGESTIONS = [
  "beaches",
  "city",
  "architecture",
  "gardens",
  "redwoods",
  "waterfront",
  "sunset",
  "views",
  "editorial",
  "nature",
] as const;

export const EMPTY_BAY_AREA_LOCATION_FORM = {
  title: "",
  slug: "",
  region: "south-bay",
  city: "",
  neighborhood: "",
  description: "",
  best_for: "",
  best_time: "",
  tip: "",
  tags: "",
  order: "",
  active: true,
};

export function slugifyLocation(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseLocationTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => slugifyLocation(item))
        .filter(Boolean)
    )
  );
}

export function formatLocationTags(tags: string[] | null | undefined) {
  return (tags ?? []).join(", ");
}

export function getLocationChipLabel(value: string) {
  const match = BAY_AREA_REGION_OPTIONS.find((item) => item.value === value);
  if (match) return match.shortLabel;
  if (value === "all") return "All Spots";
  return value
    .split("-")
    .map((part) => (part === "sf" ? "SF" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export const DRAFT_BAY_AREA_LOCATIONS: BayAreaLocationEntry[] = [
  {
    id: 1,
    title: "Baker Beach",
    slug: "baker-beach",
    region: "san-francisco",
    city: "San Francisco",
    neighborhood: "Presidio",
    description:
      "A classic coastline with sand, soft fog, and one of the cleanest Golden Gate views in the city.",
    best_for: "Golden hour portraits, movement, editorial couples photos",
    best_time: "About an hour before sunset on clearer evenings",
    tip: "The south end usually feels cleaner and more private than the main beach entrance.",
    tags: ["san-francisco", "beaches", "sunset", "views"],
    image_url: null,
    order: 1,
    active: true,
  },
  {
    id: 2,
    title: "Palace of Fine Arts",
    slug: "palace-of-fine-arts",
    region: "san-francisco",
    city: "San Francisco",
    neighborhood: "Marina District",
    description:
      "Warm stone textures, arches, and water reflections that make almost any session feel elevated.",
    best_for: "Dressy portraits, engagement sessions, timeless architecture",
    best_time: "Weekday mornings or late afternoon before the crowds build",
    tip: "Walk the perimeter and use the side colonnades when the main rotunda is packed.",
    tags: ["san-francisco", "architecture", "city", "editorial"],
    image_url: null,
    order: 2,
    active: true,
  },
  {
    id: 3,
    title: "Municipal Rose Garden",
    slug: "municipal-rose-garden",
    region: "south-bay",
    city: "San Jose",
    neighborhood: "Rose Garden",
    description:
      "Soft florals, layered greenery, and a relaxed park feel that works beautifully for warm spring portraits.",
    best_for: "Singles, couples, lifestyle portraits, softer color palettes",
    best_time: "Late afternoon or early evening in bloom season",
    tip: "Peak bloom changes every year, so check the garden before promising roses in every frame.",
    tags: ["south-bay", "gardens", "nature", "sunset"],
    image_url: null,
    order: 3,
    active: true,
  },
  {
    id: 4,
    title: "Hakone Estate and Gardens",
    slug: "hakone-estate-and-gardens",
    region: "south-bay",
    city: "Saratoga",
    neighborhood: null,
    description:
      "Layered stone paths, bamboo, and a more cinematic garden look than you usually get in the South Bay.",
    best_for: "Refined portraits, creative sessions, date-night energy",
    best_time: "Morning light or softer overcast afternoons",
    tip: "Plan outfits with a little contrast so they do not disappear into all the greenery.",
    tags: ["south-bay", "gardens", "editorial", "nature"],
    image_url: null,
    order: 4,
    active: true,
  },
  {
    id: 5,
    title: "Filoli Gardens",
    slug: "filoli-gardens",
    region: "peninsula",
    city: "Woodside",
    neighborhood: null,
    description:
      "Formal gardens and estate textures that feel polished, romantic, and very intentionally designed.",
    best_for: "Luxury-feeling portraits, florals, dressier looks",
    best_time: "Earlier in the day when the grounds feel more open",
    tip: "Check seasonal blooms and admission policies before building the whole session around it.",
    tags: ["peninsula", "gardens", "architecture", "editorial"],
    image_url: null,
    order: 5,
    active: true,
  },
  {
    id: 6,
    title: "Half Moon Bay Bluffs",
    slug: "half-moon-bay-bluffs",
    region: "peninsula",
    city: "Half Moon Bay",
    neighborhood: null,
    description:
      "Open coastline, grassy bluffs, and a softer beach feel that photographs beautifully in neutral tones.",
    best_for: "Beach portraits, couples, moody sunset sessions",
    best_time: "Golden hour, especially on slightly hazy evenings",
    tip: "Wind is part of the look here, so lean into movement-friendly outfits.",
    tags: ["peninsula", "beaches", "sunset", "views"],
    image_url: null,
    order: 6,
    active: true,
  },
  {
    id: 7,
    title: "Berkeley Marina",
    slug: "berkeley-marina",
    region: "east-bay",
    city: "Berkeley",
    neighborhood: "Marina",
    description:
      "Clean waterfront paths, open sky, and room for movement without the tight city feel.",
    best_for: "Lifestyle portraits, movement, skyline-adjacent sunset shots",
    best_time: "Late afternoon into sunset",
    tip: "It gets windy fast near the water, so I usually plan hairstyles and jackets with that in mind.",
    tags: ["east-bay", "waterfront", "sunset", "views"],
    image_url: null,
    order: 7,
    active: true,
  },
  {
    id: 8,
    title: "Tilden Regional Park",
    slug: "tilden-regional-park",
    region: "east-bay",
    city: "Berkeley",
    neighborhood: null,
    description:
      "A quieter, more natural East Bay option with hillside paths, tree cover, and a little breathing room.",
    best_for: "Nature portraits, casual sessions, layered green backdrops",
    best_time: "Golden hour or bright overcast afternoons",
    tip: "Pick one zone ahead of time because the park is bigger than it looks once you arrive.",
    tags: ["east-bay", "nature", "redwoods", "views"],
    image_url: null,
    order: 8,
    active: true,
  },
];
