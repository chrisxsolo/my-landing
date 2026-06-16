export const TESTIMONIAL_DISPLAY_PREFERENCES = [
  "first_name_last_initial",
  "full_name",
  "first_name_only",
] as const;

export const TESTIMONIAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "archived",
] as const;

export const TESTIMONIAL_SOURCES = [
  "direct_link",
  "gallery",
  "email",
  "manual",
] as const;

export type TestimonialDisplayPreference = typeof TESTIMONIAL_DISPLAY_PREFERENCES[number];
export type TestimonialStatus = typeof TESTIMONIAL_STATUSES[number];
export type TestimonialSource = typeof TESTIMONIAL_SOURCES[number];

type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };
type InputRecord = Record<string, unknown>;

export type PublicTestimonialInput = {
  first_name: string;
  last_name: string;
  email: string | null;
  message: string;
  consent_to_marketing: true;
  display_name_preference: TestimonialDisplayPreference;
  source: TestimonialSource;
  gallery_id: string | null;
  session_type: string | null;
};

export type PublicTestimonialInsert = PublicTestimonialInput & {
  consent_version: "2026-06-06";
  status: "pending";
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISPLAY_PREFERENCE_SET = new Set<string>(TESTIMONIAL_DISPLAY_PREFERENCES);
const STATUS_SET = new Set<string>(TESTIMONIAL_STATUSES);
const SOURCE_SET = new Set<string>(TESTIMONIAL_SOURCES);

function isRecord(value: unknown): value is InputRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function validateName(value: unknown, label: "first" | "last"): ValidationResult<string> {
  const name = cleanText(value);
  if (!name) return { ok: false, error: `Please enter your ${label} name` };
  if (name.length > 100) return { ok: false, error: `${label === "first" ? "First" : "Last"} name must be 100 characters or fewer` };
  return { ok: true, data: name };
}

function validateEmail(value: unknown): ValidationResult<string | null> {
  const email = cleanText(value);
  if (!email) return { ok: true, data: null };
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Please enter a valid email address" };
  }
  return { ok: true, data: email.toLowerCase() };
}

function sanitizeContext(value: unknown, maxLength: number, pattern: RegExp): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength).replace(pattern, "").trim() || null;
}

export function validatePublicTestimonial(value: unknown): ValidationResult<PublicTestimonialInput> {
  if (!isRecord(value)) return { ok: false, error: "Unable to submit this testimonial" };

  const firstName = validateName(value.first_name, "first");
  if (!firstName.ok) return firstName;
  const lastName = validateName(value.last_name, "last");
  if (!lastName.ok) return lastName;
  const email = validateEmail(value.email);
  if (!email.ok) return email;

  const message = typeof value.message === "string" ? value.message.trim() : "";
  if (message.length < 20) {
    return { ok: false, error: "Please share at least 20 characters about your experience" };
  }
  if (message.length > 2000) {
    return { ok: false, error: "Your testimonial must be 2,000 characters or fewer" };
  }
  if (value.consent_to_marketing !== true) {
    return { ok: false, error: "Please confirm that soloxsnaps may use your testimonial" };
  }
  if (typeof value.display_name_preference !== "string" || !DISPLAY_PREFERENCE_SET.has(value.display_name_preference)) {
    return { ok: false, error: "Please choose a valid display preference" };
  }

  const source = typeof value.source === "string" && SOURCE_SET.has(value.source)
    ? value.source as TestimonialSource
    : "direct_link";

  return {
    ok: true,
    data: {
      first_name: firstName.data,
      last_name: lastName.data,
      email: email.data,
      message,
      consent_to_marketing: true,
      display_name_preference: value.display_name_preference as TestimonialDisplayPreference,
      source,
      gallery_id: sanitizeContext(value.gallery_id, 120, /[^a-zA-Z0-9._:-]/g),
      session_type: sanitizeContext(value.session_type, 120, /[^a-zA-Z0-9 &'()./-]/g),
    },
  };
}

export function preparePublicTestimonialInsert(value: unknown): ValidationResult<PublicTestimonialInsert> {
  if (isRecord(value) && cleanText(value.website)) {
    return { ok: false, error: "Unable to submit this testimonial" };
  }
  const validated = validatePublicTestimonial(value);
  if (!validated.ok) return validated;
  return {
    ok: true,
    data: {
      ...validated.data,
      consent_version: "2026-06-06",
      status: "pending",
    },
  };
}

export function buildTestimonialDisplayName(
  firstName: unknown,
  lastName: unknown,
  preference: TestimonialDisplayPreference,
): string {
  const first = cleanText(firstName);
  const last = cleanText(lastName);
  if (!first) return "soloxsnaps client";
  if (preference === "first_name_only") return first;
  if (!last) return first;
  if (preference === "full_name") return `${first} ${last}`;
  return `${first} ${last.charAt(0).toUpperCase()}.`;
}

export type AdminTestimonialUpdates = {
  status?: TestimonialStatus;
  admin_notes?: string | null;
  published?: boolean;
  featured?: boolean;
  display_order?: number | null;
  session_type?: string | null;
  // Contextual-matching metadata (spec §8)
  school?: string | null;
  location?: string | null;
  session_year?: number | null;
  client_image_url?: string | null;
  gallery_url?: string | null;
  google_review_url?: string | null;
  tags?: string[];
};

const ADMIN_PATCH_KEYS = [
  "status", "admin_notes", "published", "featured", "display_order", "session_type",
  "school", "location", "session_year", "client_image_url", "gallery_url", "google_review_url", "tags",
];

// Accepts an http(s) URL or null. Rejects other protocols (e.g. javascript:) so
// these links are safe to render as anchors on public pages.
function cleanUrl(value: unknown): ValidationResult<string | null> {
  const cleaned = cleanText(value);
  if (!cleaned) return { ok: true, data: null };
  if (cleaned.length > 500) return { ok: false, error: "URL is too long." };
  let url: URL;
  try {
    url = new URL(cleaned);
  } catch {
    return { ok: false, error: "Please enter a full URL including https://." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "URLs must start with http:// or https://." };
  }
  return { ok: true, data: url.toString() };
}

// Normalizes free-text tags to deduped lowercase kebab-case slugs (e.g.
// "Nervous client" → "nervous-client"). Caps at 12 tags so the UI stays sane.
function cleanTags(value: unknown): ValidationResult<string[]> {
  if (value === null || value === undefined) return { ok: true, data: [] };
  if (!Array.isArray(value)) return { ok: false, error: "tags must be an array of strings." };
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") return { ok: false, error: "Each tag must be a string." };
    const tag = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
    if (tags.length >= 12) break;
  }
  return { ok: true, data: tags };
}

export function validateAdminTestimonialPatch(value: unknown): ValidationResult<{
  id: string;
  updates: AdminTestimonialUpdates;
}> {
  if (!isRecord(value) || typeof value.id !== "string" || !UUID_PATTERN.test(value.id)) {
    return { ok: false, error: "A valid testimonial id is required." };
  }
  if (!isRecord(value.updates)) return { ok: false, error: "updates must be an object." };
  const unknown = Object.keys(value.updates).find((key) => !ADMIN_PATCH_KEYS.includes(key));
  if (unknown) return { ok: false, error: `Field "${unknown}" is not allowed.` };
  if (Object.keys(value.updates).length === 0) return { ok: false, error: "At least one update is required." };

  const updates: AdminTestimonialUpdates = {};
  if (value.updates.status !== undefined) {
    if (typeof value.updates.status !== "string" || !STATUS_SET.has(value.updates.status)) {
      return { ok: false, error: "status is not allowed." };
    }
    updates.status = value.updates.status as TestimonialStatus;
  }
  if (value.updates.admin_notes !== undefined) {
    if (typeof value.updates.admin_notes !== "string" && value.updates.admin_notes !== null) {
      return { ok: false, error: "admin_notes must be a string or null." };
    }
    const notes = cleanText(value.updates.admin_notes);
    if (notes.length > 2000) return { ok: false, error: "admin_notes is too long." };
    updates.admin_notes = notes || null;
  }
  if (value.updates.published !== undefined) {
    if (typeof value.updates.published !== "boolean") return { ok: false, error: "published must be a boolean." };
    updates.published = value.updates.published;
  }
  if (value.updates.featured !== undefined) {
    if (typeof value.updates.featured !== "boolean") return { ok: false, error: "featured must be a boolean." };
    updates.featured = value.updates.featured;
  }
  if (value.updates.display_order !== undefined) {
    if (value.updates.display_order === null) {
      updates.display_order = null;
    } else if (typeof value.updates.display_order !== "number" || !Number.isInteger(value.updates.display_order) || value.updates.display_order < 0 || value.updates.display_order > 9999) {
      return { ok: false, error: "display_order must be an integer between 0 and 9999." };
    } else {
      updates.display_order = value.updates.display_order;
    }
  }
  if (value.updates.session_type !== undefined) {
    if (typeof value.updates.session_type !== "string" && value.updates.session_type !== null) {
      return { ok: false, error: "session_type must be a string or null." };
    }
    updates.session_type = sanitizeContext(value.updates.session_type, 120, /[^a-zA-Z0-9 &'()./-]/g);
  }
  if (value.updates.school !== undefined) {
    if (typeof value.updates.school !== "string" && value.updates.school !== null) {
      return { ok: false, error: "school must be a string or null." };
    }
    updates.school = sanitizeContext(value.updates.school, 120, /[^a-zA-Z0-9 &'()./-]/g);
  }
  if (value.updates.location !== undefined) {
    if (typeof value.updates.location !== "string" && value.updates.location !== null) {
      return { ok: false, error: "location must be a string or null." };
    }
    updates.location = sanitizeContext(value.updates.location, 120, /[^a-zA-Z0-9 ,&'()./-]/g);
  }
  if (value.updates.session_year !== undefined) {
    if (value.updates.session_year === null) {
      updates.session_year = null;
    } else if (
      typeof value.updates.session_year !== "number" ||
      !Number.isInteger(value.updates.session_year) ||
      value.updates.session_year < 1990 ||
      value.updates.session_year > 2100
    ) {
      return { ok: false, error: "session_year must be a year between 1990 and 2100." };
    } else {
      updates.session_year = value.updates.session_year;
    }
  }
  for (const key of ["client_image_url", "gallery_url", "google_review_url"] as const) {
    if (value.updates[key] !== undefined) {
      const url = cleanUrl(value.updates[key]);
      if (!url.ok) return url;
      updates[key] = url.data;
    }
  }
  if (value.updates.tags !== undefined) {
    const tags = cleanTags(value.updates.tags);
    if (!tags.ok) return tags;
    updates.tags = tags.data;
  }
  return { ok: true, data: { id: value.id, updates } };
}

export function parseTestimonialId(value: unknown): ValidationResult<string> {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    return { ok: false, error: "A valid testimonial id is required." };
  }
  return { ok: true, data: value };
}

export function sanitizeTestimonialSearch(value: unknown): string {
  return cleanText(value).replace(/[%_(),]/g, "").slice(0, 100);
}
