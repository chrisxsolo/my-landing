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
  created_at: string | null;
};

export type ClientSessionInsertSeed = {
  client_user_id: string;
  client_email: string;
  client_name: string | null;
  session_type: string | null;
  session_date: string | null;
  location: string | null;
  current_status: "inquiry_received";
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

export function pickNewestInquiry(rows: InquirySeedRow[]) {
  if (rows.length === 0) return null;

  return [...rows].sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at))[0] ?? null;
}

function normalizeSessionDate(row: InquirySeedRow) {
  const directDate = cleanText(row.session_date);
  if (directDate) return directDate;

  const dateInMind = cleanText(row.date_in_mind);
  if (!dateInMind) return null;

  const parsed = new Date(dateInMind);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function buildClientSessionInsertSeed(userId: string, inquiry: InquirySeedRow): ClientSessionInsertSeed | null {
  const email = normalizeClientEmail(inquiry.email);
  if (!email) return null;

  return {
    client_user_id: userId,
    client_email: email,
    client_name: cleanText(inquiry.name),
    session_type: cleanText(inquiry.session_type),
    session_date: normalizeSessionDate(inquiry),
    location: cleanText(inquiry.location) ?? cleanText(inquiry.school),
    current_status: "inquiry_received",
    google_linked_at: new Date().toISOString(),
  };
}
