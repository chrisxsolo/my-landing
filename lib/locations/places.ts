// Verified photography places — the deterministic gazetteer the Content Engine
// matches session locations against. A place is a PHYSICAL location: every
// alias here names the same spot on the ground, so two different places never
// share an alias. The keys of places that already have a static guide page
// equal that page's slug (enforced by tests/unit/locationMatching.test.ts).
//
// Places the photographer confirms from the admin live in the
// verified_locations table and are merged in at runtime (lib/locations/registry.ts),
// so a new spot never needs a deploy. Coordinates are approximate centers used
// only to match photo GPS — they are never published. Leave them out when unsure.

export interface KnownPlace {
  /** Stable kebab-case identity, e.g. "shark-fin-cove". */
  key: string;
  /** Canonical display name. */
  name: string;
  /** Other names for the SAME physical place (case/punctuation-insensitive). */
  aliases: string[];
  /** City or nearest town. */
  city: string;
  county: string;
  state: string;
  /** The city name people search with ("Santa Cruz" for a Davenport beach). */
  searchArea: string;
  /** Region chip used on guide hubs ("San Francisco", "Santa Cruz County"). */
  region: string;
  /** Neighborhood / landmark context, e.g. "Presidio". Used to accept qualifiers. */
  areaTerms: string[];
  latitude?: number;
  longitude?: number;
  /** GPS match radius in meters (parks and long beaches need more). */
  radiusMeters?: number;
  /** Photographer-verified facts (parking, access, permits). Only these may be published. */
  verifiedFacts: string[];
}

const SF: Pick<KnownPlace, "city" | "county" | "state" | "searchArea" | "region" | "verifiedFacts"> = {
  city: "San Francisco", county: "San Francisco County", state: "CA",
  searchArea: "San Francisco", region: "San Francisco", verifiedFacts: [],
};

export const KNOWN_PLACES: readonly KnownPlace[] = [
  {
    ...SF, key: "palace-of-fine-arts", name: "Palace of Fine Arts",
    aliases: ["Palace of Fine Arts Theatre", "Palace of Fine Arts SF"],
    areaTerms: ["Marina", "Marina District"],
    latitude: 37.8029, longitude: -122.4484, radiusMeters: 500,
  },
  {
    ...SF, key: "crissy-field", name: "Crissy Field",
    aliases: ["Crissy Field Beach", "Crissy Field East Beach"],
    areaTerms: ["Presidio", "Marina"],
    latitude: 37.8037, longitude: -122.4651, radiusMeters: 1500,
  },
  {
    ...SF, key: "lovers-lane", name: "Lovers' Lane",
    aliases: ["Lovers Lane", "Lover's Lane", "Lovers Lane Presidio"],
    areaTerms: ["Presidio"],
    latitude: 37.7935, longitude: -122.4515, radiusMeters: 800,
  },
  {
    ...SF, key: "legion-of-honor", name: "Legion of Honor",
    aliases: ["California Palace of the Legion of Honor", "Legion of Honor Museum"],
    areaTerms: ["Lincoln Park", "Outer Richmond"],
    latitude: 37.7845, longitude: -122.5008, radiusMeters: 500,
  },
  {
    ...SF, key: "ocean-beach", name: "Ocean Beach",
    aliases: ["Ocean Beach SF", "Ocean Beach San Francisco"],
    areaTerms: ["Outer Sunset", "Outer Richmond", "Sunset District", "Great Highway"],
    latitude: 37.7594, longitude: -122.5108, radiusMeters: 3500,
  },
  {
    ...SF, key: "baker-beach", name: "Baker Beach",
    aliases: [], areaTerms: ["Presidio"],
    latitude: 37.7936, longitude: -122.4836, radiusMeters: 800,
  },
  {
    ...SF, key: "embarcadero", name: "Embarcadero & Ferry Building",
    aliases: ["Embarcadero", "The Embarcadero", "Ferry Building", "Embarcadero and Ferry Building"],
    areaTerms: ["Downtown", "Financial District"],
    latitude: 37.7955, longitude: -122.3937, radiusMeters: 2000,
  },
  {
    ...SF, key: "golden-gate-park", name: "Golden Gate Park",
    aliases: ["GG Park", "Golden Gate Park SF"],
    areaTerms: ["Richmond", "Sunset"],
    latitude: 37.7694, longitude: -122.4862, radiusMeters: 2500,
  },
  {
    ...SF, key: "mission-murals", name: "Mission District Murals",
    aliases: ["Mission Murals", "Balmy Alley", "Clarion Alley"],
    areaTerms: ["Mission", "Mission District"],
    latitude: 37.757, longitude: -122.417, radiusMeters: 1200,
  },
  {
    ...SF, key: "yerba-buena-gardens", name: "Yerba Buena Gardens",
    aliases: ["Yerba Buena Garden"], areaTerms: ["SoMa", "South of Market"],
  },
  {
    ...SF, key: "lands-end", name: "Lands End",
    aliases: ["Land's End", "Lands End Trail"], areaTerms: ["Outer Richmond", "Lincoln Park"],
  },
  {
    ...SF, key: "sutro-baths", name: "Sutro Baths",
    aliases: ["Sutro Bath Ruins"], areaTerms: ["Outer Richmond", "Lands End"],
  },
  {
    ...SF, key: "marshalls-beach", name: "Marshall's Beach",
    aliases: ["Marshalls Beach"], areaTerms: ["Presidio"],
  },
  {
    key: "redwood-grove-nature-preserve", name: "Redwood Grove Nature Preserve",
    aliases: ["Redwood Grove Los Altos", "Redwood Grove Preserve"],
    city: "Los Altos", county: "Santa Clara County", state: "CA",
    searchArea: "Los Altos", region: "South Bay", areaTerms: ["South Bay"],
    verifiedFacts: [],
  },
  {
    key: "gamble-garden", name: "Gamble Garden",
    aliases: ["Gamble Gardens", "Elizabeth F. Gamble Garden"],
    city: "Palo Alto", county: "Santa Clara County", state: "CA",
    searchArea: "Palo Alto", region: "Peninsula", areaTerms: ["Peninsula"],
    verifiedFacts: [],
  },
  {
    key: "montalvo-arts-center", name: "Montalvo Arts Center",
    aliases: ["Montalvo", "Villa Montalvo"],
    city: "Saratoga", county: "Santa Clara County", state: "CA",
    searchArea: "Saratoga", region: "South Bay", areaTerms: ["South Bay"],
    verifiedFacts: [],
  },
  {
    key: "shark-fin-cove", name: "Shark Fin Cove",
    aliases: ["Shark Fin Beach", "Shark Fin Cove Beach"],
    city: "Davenport", county: "Santa Cruz County", state: "CA",
    searchArea: "Santa Cruz", region: "Santa Cruz County",
    areaTerms: ["Santa Cruz", "Highway 1", "Santa Cruz Coast", "North Coast"],
    latitude: 37.0036, longitude: -122.1856, radiusMeters: 600,
    verifiedFacts: [],
  },
];

/** "Davenport, Santa Cruz County" / "Presidio, San Francisco" — the human area line. */
export function placeAreaLine(place: KnownPlace): string {
  if (place.city === "San Francisco") {
    return place.areaTerms[0] ? `${place.areaTerms[0]}, San Francisco` : "San Francisco";
  }
  return `${place.city}, ${place.county}`;
}
