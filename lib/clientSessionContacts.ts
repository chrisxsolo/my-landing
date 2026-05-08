export type ClientSessionContactSource = "inquiry" | "session";

export type ClientSessionContactRow = {
  source: ClientSessionContactSource;
  id: string;
  name: string | null;
  email: string | null;
  session_type: string | null;
  session_date: string | null;
  date_in_mind?: string | null;
  location?: string | null;
  school?: string | null;
  created_at: string | null;
};

export type ClientSessionContactOption = {
  id: string;
  source: ClientSessionContactSource;
  name: string | null;
  email: string;
  sessionType: string | null;
  sessionDate: string | null;
  location: string | null;
  createdAt: string | null;
};

function cleanText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

function normalizeEmail(value: string | null | undefined) {
  const text = cleanText(value)?.toLowerCase();
  return text && text.includes("@") ? text : null;
}

function timestamp(value: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function buildClientSessionContactOptions(rows: ClientSessionContactRow[]) {
  const optionsByEmail = new Map<string, ClientSessionContactOption>();

  for (const row of rows) {
    const email = normalizeEmail(row.email);
    if (!email) continue;

    const option: ClientSessionContactOption = {
      id: `${row.source}:${row.id}`,
      source: row.source,
      name: cleanText(row.name),
      email,
      sessionType: cleanText(row.session_type),
      sessionDate: cleanText(row.session_date),
      location: cleanText(row.location) ?? cleanText(row.school),
      createdAt: cleanText(row.created_at),
    };

    const existing = optionsByEmail.get(email);
    if (!existing || timestamp(option.createdAt) > timestamp(existing.createdAt)) {
      optionsByEmail.set(email, option);
    }
  }

  return [...optionsByEmail.values()].sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt));
}
