// Photography conditions the photographer knows from shooting a place: when
// the light works there, and whether it gets busy. One vocabulary shared by
// the Bay Area location library and the school location guides, so a tag
// means the same thing everywhere. Client-safe (no server imports).
//
// Set by the photographer only. Sync and AI never write these: a light or
// crowd claim is firsthand knowledge, not something to infer from photos.

export const LIGHT_TAGS = [
  { value: "golden-hour", label: "Golden hour / sunset", short: "Golden hour" },
  { value: "sunrise", label: "Sunrise", short: "Sunrise" },
  { value: "overcast", label: "Fog / overcast-friendly", short: "Overcast-friendly" },
  { value: "midday-shade", label: "Open shade at midday", short: "Midday shade" },
  { value: "indoor-backup", label: "Indoor / rain backup", short: "Rain backup" },
] as const;
export type LightTag = (typeof LIGHT_TAGS)[number]["value"];

const LIGHT_VALUES: readonly string[] = LIGHT_TAGS.map((t) => t.value);

export const isLightTag = (v: unknown): v is LightTag => typeof v === "string" && LIGHT_VALUES.includes(v);

export function lightTagLabel(value: string, short = false): string {
  const hit = LIGHT_TAGS.find((t) => t.value === value);
  return hit ? (short ? hit.short : hit.label) : value;
}

/** Known tags only, deduplicated, in vocabulary order so chips read the same everywhere. */
export function sortLightTags(tags: Iterable<string>): LightTag[] {
  const set = new Set(tags);
  return LIGHT_TAGS.map((t) => t.value).filter((v) => set.has(v));
}

/** A submitted tag list, or undefined when it isn't an array of known tags. */
export function parseLightTags(value: unknown): LightTag[] | undefined {
  if (!Array.isArray(value) || !value.every(isLightTag)) return undefined;
  return sortLightTags(value);
}

/** A crowd note is the "Gets busy" badge's timing hint, e.g. "Weekends; go weekday mornings". */
export const CROWD_NOTE_MAX = 160;

/**
 * A crowd note as stored: one plain-text line, whitespace collapsed, control
 * characters removed. "" / null clears it (no badge); undefined means the
 * value is not acceptable (not a string, or too long).
 */
export function normalizeCrowdNote(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (clean === "") return null;
  return clean.length <= CROWD_NOTE_MAX ? clean : undefined;
}
