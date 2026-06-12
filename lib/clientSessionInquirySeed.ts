import { CLIENT_SESSION_TIME_ZONE, normalizeClientSessionDate } from "@/lib/clientSessions";

export const INQUIRIES_TABLE = "inquiries";

export type InquirySeedRow = {
  id: number;
  name: string | null;
  email: string | null;
  session_type: string | null;
  session_date: string | null;
  date_in_mind: string | null;
  location: string | null;
  school: string | null;
  preferred_time?: string | null;
  booking_confirmed?: boolean | null;
  created_at: string | null;
};

export type ClientSessionInsertSeed = {
  client_user_id: string;
  client_email: string;
  client_name: string | null;
  session_type: string | null;
  session_date: string | null;
  location: string | null;
  current_status: "inquiry_received" | "booked";
  google_linked_at: string;
};

function cleanText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

export function normalizeClientEmail(value: string | null | undefined) {
  const text = cleanText(value)?.toLowerCase();
  return text && text.includes("@") ? text : null;
}

function timestamp(value: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function parsePreferredTime(value: string | null | undefined) {
  const text = cleanText(value);
  if (!text) return null;

  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const meridiem = match[3]?.toLowerCase();
  if (minutes > 59 || hours > (meridiem ? 12 : 23)) return null;
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  return { hours, minutes };
}

function timeZoneOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLIENT_SESSION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return asUtc - date.getTime();
}

function pacificDateTimeToIso(date: string, hours: number, minutes: number) {
  const [year, month, day] = date.split("-").map(Number);
  const wallTime = Date.UTC(year, month - 1, day, hours, minutes);
  let instant = new Date(wallTime);
  instant = new Date(wallTime - timeZoneOffsetMs(instant));
  instant = new Date(wallTime - timeZoneOffsetMs(instant));
  return instant.toISOString();
}

export function pickNewestInquiry(rows: InquirySeedRow[]) {
  if (rows.length === 0) return null;

  return [...rows].sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at))[0] ?? null;
}

export function buildClientSessionDateTime(
  sessionDate: string | null | undefined,
  dateInMind: string | null | undefined,
  preferredTime: string | null | undefined,
) {
  const date = normalizeClientSessionDate(sessionDate) ?? normalizeClientSessionDate(dateInMind);
  if (!date) return null;

  const time = parsePreferredTime(preferredTime);
  return time ? pacificDateTimeToIso(date, time.hours, time.minutes) : date;
}

export function buildClientSessionSyncFields(inquiry: InquirySeedRow) {
  return {
    client_name: cleanText(inquiry.name),
    session_type: cleanText(inquiry.session_type),
    session_date: buildClientSessionDateTime(
      inquiry.session_date,
      inquiry.date_in_mind,
      inquiry.preferred_time,
    ),
    location: cleanText(inquiry.location) ?? cleanText(inquiry.school),
  };
}

export function buildClientSessionInsertSeed(userId: string, inquiry: InquirySeedRow): ClientSessionInsertSeed | null {
  const email = normalizeClientEmail(inquiry.email);
  if (!email) return null;
  const details = buildClientSessionSyncFields(inquiry);

  return {
    client_user_id: userId,
    client_email: email,
    ...details,
    current_status: inquiry.booking_confirmed ? "booked" : "inquiry_received",
    google_linked_at: new Date().toISOString(),
  };
}
