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

export function validateAdminTestimonialPatch(value: unknown): ValidationResult<{
  id: string;
  updates: { status?: TestimonialStatus; admin_notes?: string | null };
}> {
  if (!isRecord(value) || typeof value.id !== "string" || !UUID_PATTERN.test(value.id)) {
    return { ok: false, error: "A valid testimonial id is required." };
  }
  if (!isRecord(value.updates)) return { ok: false, error: "updates must be an object." };
  const unknown = Object.keys(value.updates).find((key) => !["status", "admin_notes"].includes(key));
  if (unknown) return { ok: false, error: `Field "${unknown}" is not allowed.` };
  if (Object.keys(value.updates).length === 0) return { ok: false, error: "At least one update is required." };

  const updates: { status?: TestimonialStatus; admin_notes?: string | null } = {};
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
