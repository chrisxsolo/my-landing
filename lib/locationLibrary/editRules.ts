// Pure validation for admin edits to a library location. Every edited
// editorial field is locked (sync and AI leave it alone afterwards); an
// explicit "unlock" returns one field to automatic management.
import type { KnownPlace } from "@/lib/locations/places";
import {
  LOCKABLE_FIELDS, isEnvironment, isLibraryRegion, isLockableField, regionForPlace, sortEnvironments,
  type LockableField,
} from "@/lib/locationLibrary/taxonomy";
import { CROWD_NOTE_MAX, normalizeCrowdNote, parseLightTags } from "@/lib/photoConditions";

export class LocationEditError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "LocationEditError";
  }
}

const TEXT_LIMITS: Record<Exclude<LockableField, "region" | "environments">, number> = {
  title: 120, city: 80, neighborhood: 80, description: 1200, best_for: 300, best_time: 300, tip: 600,
};

export interface ParsedPatch {
  fields: Record<string, unknown>;
  lock: LockableField[];
  unlock: LockableField[];
}

function parseText(field: keyof typeof TEXT_LIMITS, value: unknown): string | null {
  if (field === "neighborhood" && (value === null || value === "")) return null;
  if (typeof value !== "string") throw new LocationEditError(`${field} must be text`);
  const text = value.trim();
  if (text.length > TEXT_LIMITS[field]) throw new LocationEditError(`${field} is too long (max ${TEXT_LIMITS[field]})`);
  if ((field === "title" || field === "city") && !text) throw new LocationEditError(`${field} cannot be empty`);
  return text;
}

function parseEditorialField(field: LockableField, value: unknown): unknown {
  if (field === "region") {
    if (!isLibraryRegion(value)) throw new LocationEditError("unknown region");
    return value;
  }
  if (field === "environments") {
    if (!Array.isArray(value) || !value.every(isEnvironment)) throw new LocationEditError("unknown environment");
    return sortEnvironments(value);
  }
  return parseText(field, value);
}

function parseFlags(body: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if ("order" in body) {
    if (typeof body.order !== "number" || !Number.isInteger(body.order) || body.order < 0 || body.order > 100_000) {
      throw new LocationEditError("order must be a whole number");
    }
    fields.order = body.order;
  }
  if ("clear_manual_image" in body && body.clear_manual_image === true) fields.image_url = null;
  return fields;
}

/**
 * Light tags and the crowd note. Photographer-only: sync and AI never write
 * them, so saving one needs no lock.
 */
function parseConditions(body: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if ("light_tags" in body) {
    const tags = parseLightTags(body.light_tags);
    if (!tags) throw new LocationEditError("unknown light condition");
    fields.light_tags = tags;
  }
  if ("crowd_note" in body) {
    const note = normalizeCrowdNote(body.crowd_note);
    if (note === undefined) throw new LocationEditError(`crowd note must be text up to ${CROWD_NOTE_MAX} characters`);
    fields.crowd_note = note;
  }
  return fields;
}

/** { title?, city?, …, environments?, light_tags?, crowd_note?, order?, clear_manual_image?, unlock?: string[] } */
export function parseLocationPatch(body: Record<string, unknown>): ParsedPatch {
  const fields: Record<string, unknown> = { ...parseFlags(body), ...parseConditions(body) };
  const lock: LockableField[] = [];
  for (const field of LOCKABLE_FIELDS) {
    if (!(field in body)) continue;
    fields[field] = parseEditorialField(field, body[field]);
    lock.push(field);
  }
  const unlockRaw = body.unlock ?? [];
  if (!Array.isArray(unlockRaw) || !unlockRaw.every(isLockableField)) throw new LocationEditError("unlock must list editable fields");
  const unlock = unlockRaw.filter((f) => !lock.includes(f));
  return { fields, lock, unlock };
}

export function nextLockedFields(current: readonly string[], lock: readonly string[], unlock: readonly string[]): string[] {
  const set = new Set([...current, ...lock]);
  for (const f of unlock) set.delete(f);
  return LOCKABLE_FIELDS.filter((f) => set.has(f));
}

/** Values a geography field returns to when unlocked (from the verified place). */
export function placeDefaults(place: KnownPlace): Partial<Record<LockableField, unknown>> {
  return {
    title: place.name,
    city: place.city,
    region: regionForPlace(place),
    neighborhood: place.city === "San Francisco" ? place.areaTerms[0] ?? null : null,
  };
}

export interface PublishCheck {
  title: string;
  description: string;
}

/** A card goes public only with a name and a description a visitor can read. */
export function publishProblems(row: PublishCheck): string[] {
  const problems: string[] = [];
  if (!row.title.trim()) problems.push("a name");
  if (!row.description.trim()) problems.push("a description");
  return problems;
}
