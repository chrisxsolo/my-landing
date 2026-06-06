import type { AdminInquiryCreate, AdminInquiryPatch } from "@/lib/adminInquiries";

type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };
type InputRecord = Record<string, unknown>;

const STATUS_VALUES = new Set(["new", "responded", "archived", "not_interested", "manual"]);
const PAYMENT_STATUS_VALUES = new Set(["paid", "unpaid"]);
const CREATE_FIELDS = new Set([
  "name", "email", "message", "phone", "session_type", "date_in_mind", "status",
  "payment_status", "booking_confirmed", "session_date", "instagram", "school",
  "preferred_time", "people", "location",
]);
const PATCH_FIELDS = new Set([
  "status", "session_type", "session_date", "preferred_time", "reply_sent_at",
  "invoice_sent_at", "contract_sent_at", "deposit_paid_at", "gallery_delivered_at",
  "confirmation_sent_at",
]);
const MAX_LENGTHS: Record<string, number> = {
  name: 100,
  email: 254,
  message: 3000,
  phone: 30,
  session_type: 100,
  date_in_mind: 100,
  status: 30,
  payment_status: 30,
  session_date: 10,
  instagram: 100,
  school: 150,
  preferred_time: 100,
  people: 100,
  location: 200,
};
const TIMESTAMP_FIELDS = new Set([
  "reply_sent_at", "invoice_sent_at", "contract_sent_at", "deposit_paid_at",
  "gallery_delivered_at", "confirmation_sent_at",
]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is InputRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknownFields(value: InputRecord, allowed: Set<string>): string | null {
  const unknown = Object.keys(value).find(key => !allowed.has(key));
  return unknown ? `Field "${unknown}" is not allowed.` : null;
}

function validateString(
  field: string,
  value: unknown,
  options: { nullable?: boolean; required?: boolean } = {},
): ValidationResult<string | null | undefined> {
  if (value === undefined && !options.required) return { ok: true, data: undefined };
  if (value === null && options.nullable) return { ok: true, data: null };
  if (typeof value !== "string") return { ok: false, error: `${field} must be a string.` };

  const cleaned = value.trim();
  if (options.required && !cleaned) return { ok: false, error: `${field} is required.` };
  if (!cleaned && options.nullable) return { ok: true, data: null };
  if (cleaned.length > (MAX_LENGTHS[field] ?? 200)) {
    return { ok: false, error: `${field} is too long.` };
  }
  return { ok: true, data: cleaned };
}

function copyNullableString(
  target: Record<string, unknown>,
  source: InputRecord,
  field: string,
): string | null {
  const result = validateString(field, source[field], { nullable: true });
  if (!result.ok) return result.error;
  if (result.data !== undefined) target[field] = result.data;
  return null;
}

function validateSessionDate(value: unknown): ValidationResult<string | null | undefined> {
  const result = validateString("session_date", value, { nullable: true });
  if (!result.ok || result.data === null || result.data === undefined) return result;
  if (!DATE_PATTERN.test(result.data) || Number.isNaN(Date.parse(`${result.data}T00:00:00Z`))) {
    return { ok: false, error: "session_date must be YYYY-MM-DD." };
  }
  return result;
}

export function parseInquiryId(value: unknown): ValidationResult<number> {
  const id = typeof value === "string" ? Number(value) : value;
  if (!Number.isSafeInteger(id) || Number(id) <= 0) {
    return { ok: false, error: "A valid inquiry id is required." };
  }
  return { ok: true, data: Number(id) };
}

export function validateInquiryCreate(value: unknown): ValidationResult<AdminInquiryCreate> {
  if (!isRecord(value)) return { ok: false, error: "Request body must be an object." };
  const unknownError = rejectUnknownFields(value, CREATE_FIELDS);
  if (unknownError) return { ok: false, error: unknownError };

  const name = validateString("name", value.name, { required: true });
  const email = validateString("email", value.email, { required: true });
  const message = validateString("message", value.message, { required: true });
  if (!name.ok) return { ok: false, error: name.error };
  if (!email.ok) return { ok: false, error: email.error };
  if (!message.ok) return { ok: false, error: message.error };
  if (!EMAIL_PATTERN.test(email.data!)) return { ok: false, error: "email must be valid." };

  const data: Record<string, unknown> = {
    name: name.data,
    email: email.data!.toLowerCase(),
    message: message.data,
  };
  for (const field of [
    "phone", "session_type", "date_in_mind", "instagram", "school",
    "preferred_time", "people", "location",
  ]) {
    const error = copyNullableString(data, value, field);
    if (error) return { ok: false, error };
  }

  const status = value.status ?? "manual";
  if (typeof status !== "string" || !STATUS_VALUES.has(status)) {
    return { ok: false, error: "status is not allowed." };
  }
  data.status = status;

  if (value.payment_status !== undefined && value.payment_status !== null) {
    if (typeof value.payment_status !== "string" || !PAYMENT_STATUS_VALUES.has(value.payment_status)) {
      return { ok: false, error: "payment_status is not allowed." };
    }
    data.payment_status = value.payment_status;
  } else if (value.payment_status === null) {
    data.payment_status = null;
  }

  if (value.booking_confirmed !== undefined) {
    if (value.booking_confirmed !== null && typeof value.booking_confirmed !== "boolean") {
      return { ok: false, error: "booking_confirmed must be boolean or null." };
    }
    data.booking_confirmed = value.booking_confirmed;
  }

  const sessionDate = validateSessionDate(value.session_date);
  if (!sessionDate.ok) return { ok: false, error: sessionDate.error };
  if (sessionDate.data !== undefined) data.session_date = sessionDate.data;
  return { ok: true, data: data as AdminInquiryCreate };
}

export function validateInquiryPatch(value: unknown): ValidationResult<{
  id: number;
  updates: AdminInquiryPatch;
}> {
  if (!isRecord(value)) return { ok: false, error: "Request body must be an object." };
  const unknownError = rejectUnknownFields(value, new Set(["id", "updates"]));
  if (unknownError) return { ok: false, error: unknownError };

  const id = parseInquiryId(value.id);
  if (!id.ok) return { ok: false, error: id.error };
  if (!isRecord(value.updates)) return { ok: false, error: "updates must be an object." };
  const updatesUnknownError = rejectUnknownFields(value.updates, PATCH_FIELDS);
  if (updatesUnknownError) return { ok: false, error: updatesUnknownError };
  if (Object.keys(value.updates).length === 0) {
    return { ok: false, error: "At least one update is required." };
  }

  const updates: Record<string, unknown> = {};
  for (const [field, fieldValue] of Object.entries(value.updates)) {
    if (field === "status") {
      if (typeof fieldValue !== "string" || !STATUS_VALUES.has(fieldValue)) {
        return { ok: false, error: "status is not allowed." };
      }
      updates.status = fieldValue;
      continue;
    }
    if (field === "session_date") {
      const result = validateSessionDate(fieldValue);
      if (!result.ok) return { ok: false, error: result.error };
      updates.session_date = result.data;
      continue;
    }
    if (TIMESTAMP_FIELDS.has(field)) {
      if (fieldValue !== null && (
        typeof fieldValue !== "string" || Number.isNaN(Date.parse(fieldValue))
      )) {
        return { ok: false, error: `${field} must be an ISO timestamp or null.` };
      }
      updates[field] = fieldValue;
      continue;
    }
    const error = copyNullableString(updates, value.updates, field);
    if (error) return { ok: false, error };
  }

  return { ok: true, data: { id: id.data, updates: updates as AdminInquiryPatch } };
}
