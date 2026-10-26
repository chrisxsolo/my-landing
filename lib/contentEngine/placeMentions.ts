// Deterministic check that a journal post only names places this session was
// actually photographed at. The model may describe the session's own
// locations; it must never recommend or pair a place just because it is
// nearby. A named known place outside the session's recorded locations (or
// its school) blocks publishing until Chris removes it or records that he shot
// there. Markdown link text is skipped: links are validated separately, and a
// related-post link naming another session's place is not a recommendation.
import { matchPlacesByName, normalizePlaceName } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";

export interface SessionPlaceContext {
  /** Session locations as Chris recorded them (primary + secondary). */
  locations: readonly string[];
  /** The graduate's school names, so a campus that is also a known place is allowed. */
  schoolNames: readonly string[];
}

const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g;

function placeNames(place: KnownPlace): string[] {
  return [place.name, ...place.aliases].map(normalizePlaceName).filter((n) => n.length > 3);
}

function namedIn(place: KnownPlace, normalizedText: string): boolean {
  return placeNames(place).some((n) => normalizedText.includes(` ${n} `));
}

// A place counts as the session's own when a recorded location resolves to it
// ("Palace of Fine Arts, San Francisco") or names it ("USF and Palace of Fine Arts").
function sessionPlaceKeys(ctx: SessionPlaceContext, places: readonly KnownPlace[]): Set<string> {
  const recorded = [...ctx.locations, ...ctx.schoolNames].filter((t) => t.trim());
  const recordedText = ` ${recorded.map(normalizePlaceName).join("  ")} `;
  const resolved = recorded.flatMap((text) => matchPlacesByName(text, places).map((p) => p.key));
  return new Set([...resolved, ...places.filter((p) => namedIn(p, recordedText)).map((p) => p.key)]);
}

/** Names of known places the text mentions that this session was not photographed at. */
export function unsupportedPlaceMentions(
  texts: readonly string[], ctx: SessionPlaceContext, places: readonly KnownPlace[],
): string[] {
  const prose = ` ${normalizePlaceName(texts.join(" ").replace(MARKDOWN_LINK, " "))} `;
  const own = sessionPlaceKeys(ctx, places);
  return places.filter((p) => !own.has(p.key) && namedIn(p, prose)).map((p) => p.name);
}
