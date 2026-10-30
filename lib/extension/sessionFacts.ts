// What the client's Gmail thread settled: date, time, shoot location, session
// type and any price written down. Shared by the extension's detect-date and
// invoice-draft endpoints.
//
// The model's answer is treated as untrusted input: every field is checked
// and coerced before it is used, and a result is kept whenever ANY supported
// field came back (a thread that only names the location is still useful).

import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "../gmailTokens";
import { NO_FACTS, TOTAL_KINDS, type SessionFacts, type TotalKind } from "../invoiceDraft/types";
import { formatReadable, parseLooseDate } from "./sessionDates";

type MimePart = { mimeType?: string; body?: { data?: string }; parts?: MimePart[] };

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_THREAD_MESSAGES = 15;
const BODY_CHAR_LIMIT = 2000;
const MAX_LOCATION_CHARS = 120;
const MAX_FEE_DOLLARS = 100_000;

const SESSION_TYPES = new Set([
  "graduation", "family", "extended-family", "couples", "engagement", "proposal", "elopement", "maternity", "event", "other",
]);

function decodeBody(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    return decodeURIComponent(
      Array.from(atob(padded)).map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join(""),
    );
  } catch { return ""; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function extractBestText(part: MimePart): string {
  let plain = ""; let html = "";
  function walk(p: MimePart) {
    if (p.mimeType === "text/plain" && p.body?.data && !plain) plain = decodeBody(p.body.data);
    else if (p.mimeType === "text/html" && p.body?.data && !html) html = decodeBody(p.body.data);
    (p.parts ?? []).forEach(walk);
  }
  walk(part);
  return plain || stripHtml(html);
}

/** The client's thread, oldest first, as one labelled transcript. Empty when Gmail is unavailable. */
export async function fetchEmailContext(email: string): Promise<string> {
  const tokens = await getValidTokens();
  if (!tokens) return "";
  const headers = { Authorization: `Bearer ${tokens.access_token}` };
  const query = encodeURIComponent(`from:${email} OR to:${email}`);
  const searchRes = await fetch(`${GMAIL_API}/messages?q=${query}&maxResults=20`, { headers });
  if (!searchRes.ok) return "";
  const searchData = await searchRes.json() as { messages?: { id: string }[] };
  const ids = (searchData.messages ?? []).map(m => m.id).slice(0, MAX_THREAD_MESSAGES);
  const bodies = await Promise.all(ids.map(async id => {
    try {
      const r = await fetch(`${GMAIL_API}/messages/${id}?format=full`, { headers });
      if (!r.ok) return null;
      const msg = await r.json() as { payload?: MimePart; snippet?: string; internalDate?: string };
      const text = (extractBestText(msg.payload ?? {}) || msg.snippet || "").slice(0, BODY_CHAR_LIMIT);
      return text ? { ts: Number(msg.internalDate ?? 0), text } : null;
    } catch { return null; }
  }));
  const sorted = bodies.filter((b): b is { ts: number; text: string } => b != null).sort((a, b) => a.ts - b.ts);
  return sorted.map((b, i) => {
    const sent = b.ts ? new Date(b.ts).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "unknown date";
    return `--- Email ${i + 1} of ${sorted.length} (sent ${sent}) ---\n${b.text}`;
  }).join("\n\n");
}

export interface FactsInquiry {
  name: string;
  email: string;
  date_in_mind: string | null;
  message: string | null;
  session_type: string | null;
  school: string | null;
  people: string | number | null;
}

function systemPrompt(today: string, currentYear: number): string {
  return `You extract confirmed photography session details from email conversations. Today is ${today}. Current year is ${currentYear}.

Extract:
1. Date: the most recently confirmed/agreed session date
2. Time: the session time most recently discussed (e.g. "10:00 AM", "6:30 PM", "golden hour"). Prefer an explicitly confirmed time; if none was confirmed, use the most recently proposed time from either party. Format clock times like "6:00 PM". null only if no time was ever mentioned in any email.
3. Location: the school, park, neighborhood, city, or specific spot most recently discussed for the shoot (e.g. "UC Berkeley", "SJSU", "Golden Gate Park", "San Francisco City Hall"). If only a city was mentioned, return the city (e.g. "SF" → "San Francisco"). Return a short place name only — never a sentence or a quote from the email. null if not found.
4. Session type: one of "graduation", "family", "extended-family", "couples", "engagement", "proposal", "elopement", "maternity", "event", "other" — based on the inquiry and emails. null if unclear.
5. Total fee: the most recently quoted or agreed price for the session in dollars, as a plain number (e.g. 350). Prefer the photographer's most recent quote or an amount the client agreed to. null if no price was discussed.
6. Total kind: "agreed_total" when the wording plainly calls that amount the total, all-in or full price for the session; "quote" when it is a quoted session price that may not include everything; "unclear" when it could be a deposit, retainer, balance, add-on or anything else. null when total_fee is null.
7. Includes travel: true when the thread says that amount includes travel, false when it says travel is extra, null when travel is not mentioned alongside it.

Rules:
- Emails are in chronological order — the LAST email is the most recent. When emails disagree, the most recent one wins.
- Confirmation language: "works great", "sounds good", "perfect", "see you then", "confirmed"
- If month+day given without year, use ${currentYear}. Only use ${currentYear + 1} if date has already passed.
- Do NOT invent a price — only extract amounts actually written in the emails.

Respond ONLY with valid JSON:
{"date":"YYYY-MM-DD","readable":"e.g. July 24th, 2026","time":"e.g. 10:00 AM","location":"e.g. UC Berkeley","session_type":"family","total_fee":350,"total_kind":"agreed_total","includes_travel":true,"confidence":"high|medium|low"}
Use null for any field not found.`;
}

function extractJson(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

const shortText = (v: unknown, max: number): string | null => {
  const text = typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
  return text && text.length <= max ? text : null;
};

/** Checks and coerces the model's JSON. Unusable fields become null; nothing throws. */
export function normalizeExtractedFacts(raw: unknown): SessionFacts {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const iso = parseLooseDate(typeof r.date === "string" ? r.date : null) ?? parseLooseDate(typeof r.readable === "string" ? r.readable : null);
  const fee = typeof r.total_fee === "number" ? r.total_fee : Number(String(r.total_fee ?? "").replace(/[^0-9.\-]/g, ""));
  const total_fee = Number.isFinite(fee) && fee > 0 && fee < MAX_FEE_DOLLARS ? Math.round(fee * 100) / 100 : null;
  const kind = typeof r.total_kind === "string" && (TOTAL_KINDS as readonly string[]).includes(r.total_kind) ? r.total_kind as TotalKind : null;
  const sessionType = typeof r.session_type === "string" && SESSION_TYPES.has(r.session_type) ? r.session_type : null;
  const confidence = r.confidence === "high" || r.confidence === "medium" ? r.confidence : "low";
  return {
    date: iso,
    readable: iso ? formatReadable(iso) : null,
    time: shortText(r.time, 40),
    location: shortText(r.location, MAX_LOCATION_CHARS),
    session_type: sessionType,
    total_fee,
    total_kind: total_fee === null ? null : kind ?? "unclear",
    includes_travel: typeof r.includes_travel === "boolean" ? r.includes_travel : null,
    confidence,
    source: "email",
  };
}

/** Whether any supported field came back: a location-only or time-only answer still counts. */
export function hasUsefulFacts(facts: SessionFacts): boolean {
  return Boolean(facts.date || facts.time || facts.location || facts.session_type || facts.total_fee !== null);
}

/** What the inquiry form alone says, when the thread settles nothing. */
export function factsFromInquiry(inq: FactsInquiry): SessionFacts {
  const iso = parseLooseDate(inq.date_in_mind);
  return {
    ...NO_FACTS,
    date: iso,
    readable: iso ? formatReadable(iso) : inq.date_in_mind,
    session_type: inq.session_type ?? null,
    source: inq.date_in_mind ? "inquiry" : "none",
  };
}

async function askModel(inq: FactsInquiry, emailContext: string): Promise<SessionFacts | null> {
  const today = new Date().toISOString().split("T")[0];
  const anthropic = new Anthropic();
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 400,
    system: systemPrompt(today, new Date().getFullYear()),
    messages: [{ role: "user", content: `Client: ${inq.name}\nInquiry session type: ${inq.session_type ?? "not specified"}\nSchool: ${inq.school ?? "not specified"}\nGroup size: ${inq.people ?? "not specified"}\nOriginal request: ${inq.date_in_mind ?? "not specified"}\nInquiry message: ${inq.message ?? ""}\n\nEmail thread:\n${emailContext}` }],
  });
  const raw = res.content[0].type === "text" ? res.content[0].text : "{}";
  try {
    const facts = normalizeExtractedFacts(JSON.parse(extractJson(raw)));
    return hasUsefulFacts(facts) ? facts : null;
  } catch (err) {
    console.error("Extension session facts: model returned malformed JSON", err);
    return null;
  }
}

/** The thread's facts when Gmail and the model produce any, else the inquiry form's. */
export async function sessionFactsForInquiry(inq: FactsInquiry): Promise<SessionFacts> {
  const emailContext = await fetchEmailContext(inq.email);
  if (emailContext) {
    const facts = await askModel(inq, emailContext);
    if (facts) return facts;
  }
  return factsFromInquiry(inq);
}
