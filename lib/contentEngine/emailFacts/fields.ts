// The closed set of session facts the email extractor may touch, and the
// coercion rules that turn one model-proposed string into a storable value.
//
// Nothing reaches the DB that is not accepted here: every enum field resolves
// through the canonical taxonomy, dates and times are format-checked, and a
// location that is really a date ("September 28") is rejected outright — the
// spec calls that confusion out by name. A field whose coercion returns null
// is dropped, never stored speculatively.
import {
  LIGHTING_CONDITIONS, VIBES, RELATIONSHIP_TYPES, SCHOOL_SLUGS,
  isLightingCondition, isVibe, isRelationshipType,
  normalizeServiceType, type SchoolSlug,
} from "@/lib/contentEngine/taxonomy";
import { firstNameOf } from "@/lib/contentEngine/prefill";
import { normalizeSchool } from "@/lib/schoolDetection";

export const EMAIL_FACT_FIELDS = [
  "public_display_name", "internal_client_name", "service_type", "school_slug",
  "primary_location", "secondary_locations", "session_date", "start_time",
  "lighting_condition", "vibe", "relationship_type", "outfit_styling",
  "best_moment", "public_session_summary", "internal_notes",
] as const;
export type EmailFactField = (typeof EMAIL_FACT_FIELDS)[number];

export const FACT_CONFIDENCES = ["high", "medium", "low"] as const;
export type FactConfidence = (typeof FACT_CONFIDENCES)[number];

// The standing of the value that came back — never of information the model
// discarded. A superseded or cancelled arrangement is not returned at all;
// the surviving value is, which is what these describe.
export const FACT_STATUSES = ["confirmed", "planned", "proposed", "tentative", "unknown"] as const;
export type FactStatus = (typeof FACT_STATUSES)[number];

export interface FieldSpec {
  /** Label for the review panel. */
  label: string;
  /** Private to the business — must never reach a public-content prompt. */
  internal?: boolean;
  /**
   * Written by the model rather than quoted from the thread, so no source
   * excerpt can be grounded against an email body (the summary and the notes).
   */
  derived?: boolean;
  /** A comma-separated list in the facts form rather than a single value. */
  multi?: boolean;
  /** Closed value set shown to the model; absent for free text. */
  allowed?: readonly string[];
  /** Model string → storable value, or null to drop the field. */
  coerce: (raw: string) => string | null;
}

const MAX_SHORT_TEXT = 300;
const MAX_LONG_TEXT = 2000;

const clean = (raw: string) => raw.replace(/\s+/g, " ").trim();

const shortText = (raw: string): string | null => {
  const value = clean(raw).slice(0, MAX_SHORT_TEXT);
  return value ? value : null;
};

const longText = (raw: string): string | null => {
  const value = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_LONG_TEXT);
  return value ? value : null;
};

// A location is a place. Bare dates, times and weekdays are the recurring
// failure mode, so anything that is *only* temporal is refused.
const DATE_ONLY = new RegExp(
  "^(?:(?:mon|tues|wednes|thurs|fri|satur|sun)day|" +
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|" +
  "aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|" +
  "\\d{1,4}|st|nd|rd|th|at|on|the|am|pm|[-/,:]|\\s)+$",
  "i",
);

const place = (raw: string): string | null => {
  const value = shortText(raw);
  if (!value) return null;
  return DATE_ONLY.test(value) ? null : value;
};

const enumOf = (guard: (v: unknown) => boolean) => (raw: string): string | null => {
  const value = clean(raw).toLowerCase().replace(/[\s-]+/g, "_");
  return guard(value) ? value : null;
};

const isRealDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(`${value}T00:00:00Z`);
  return date.getUTCFullYear() === Number(y)
    && date.getUTCMonth() + 1 === Number(m)
    && date.getUTCDate() === Number(d);
};

// canonicalName → /grads/<slug>. Typed against SCHOOL_SLUGS so adding a school
// page without teaching the extractor about it fails the build rather than
// silently extracting nothing. Schools outside the Bay Area page set resolve
// to no slug, which is correct — those pages do not exist.
const SCHOOL_CANONICAL_NAMES: Record<SchoolSlug, string> = {
  csueb: "California State University, East Bay",
  "santa-clara": "Santa Clara University",
  "sf-state": "San Francisco State University",
  sjsu: "San Jose State University",
  stanford: "Stanford University",
  "uc-berkeley": "University of California, Berkeley",
  usf: "University of San Francisco",
};

export const FIELD_SPECS: Record<EmailFactField, FieldSpec> = {
  public_display_name: {
    label: "Public display name",
    // First name only: a full legal name must never auto-publish (spec §3).
    coerce: (raw) => {
      const value = shortText(raw);
      return value ? firstNameOf(value) : null;
    },
  },
  internal_client_name: { label: "Internal client name", internal: true, coerce: shortText },
  service_type: {
    label: "Service type",
    coerce: (raw) => normalizeServiceType(raw),
  },
  school_slug: {
    label: "School",
    allowed: SCHOOL_SLUGS,
    coerce: (raw) => {
      const value = clean(raw);
      if (!value) return null;
      if ((SCHOOL_SLUGS as readonly string[]).includes(value.toLowerCase())) return value.toLowerCase();
      const school = normalizeSchool(value);
      if (!school) return null;
      const slug = (Object.keys(SCHOOL_CANONICAL_NAMES) as SchoolSlug[])
        .find((key) => SCHOOL_CANONICAL_NAMES[key] === school.canonicalName);
      return slug ?? null;
    },
  },
  primary_location: { label: "Primary location", coerce: place },
  secondary_locations: { label: "Secondary locations", multi: true, coerce: place },
  session_date: {
    label: "Session date",
    coerce: (raw) => {
      const value = clean(raw);
      return isRealDate(value) ? value : null;
    },
  },
  start_time: {
    label: "Session time",
    coerce: (raw) => {
      const value = clean(raw);
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
    },
  },
  lighting_condition: {
    label: "Lighting",
    allowed: LIGHTING_CONDITIONS,
    coerce: enumOf(isLightingCondition),
  },
  vibe: { label: "Vibe", allowed: VIBES, coerce: enumOf(isVibe) },
  relationship_type: {
    label: "Relationship type",
    allowed: RELATIONSHIP_TYPES,
    coerce: enumOf(isRelationshipType),
  },
  outfit_styling: { label: "Outfit / styling", coerce: shortText },
  best_moment: { label: "Best moment", coerce: shortText },
  public_session_summary: { label: "Public session summary", derived: true, coerce: longText },
  internal_notes: { label: "Internal notes", internal: true, derived: true, coerce: longText },
};

export const isEmailFactField = (value: unknown): value is EmailFactField =>
  typeof value === "string" && (EMAIL_FACT_FIELDS as readonly string[]).includes(value);
