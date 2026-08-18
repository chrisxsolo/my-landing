// ─────────────────────────────────────────────────────────────────────────────
// Gmail + AI pass behind the booking confirmation email.
//
// Reads the client's actual conversation for the three things the database
// often can't supply for a shoot booked over email: the agreed shoot date, the
// deposit the client actually sent, and the session price that was quoted.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { extractEmailText, type GmailMimePart } from "@/lib/gmailBodyText";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_THREAD_EMAILS = 15;
const BODY_CHAR_LIMIT = 2000;

export type ThreadDetails = {
  /** Readable confirmed shoot date, e.g. "Friday, June 20, 2026". */
  confirmedDateLabel: string | null;
  /** Money the client has already paid, as written in the thread. */
  paidAmount: string;
  /** How they paid — Venmo, Zelle, … */
  method: string;
  /** Session price the photographer quoted in the thread. */
  quotedTotal: string;
};

export function formatSessionDate(sessionDate: string): string {
  return new Date(sessionDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
}

function extractJson(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function scanSystemPrompt(today: string, currentYear: number): string {
  return `You extract booking facts from the email thread between a photographer (SoloxSnaps) and one client. Today is ${today}. Current year is ${currentYear}.

Confirmed session date:
- Find the ONE date that was most recently agreed upon between the photographer and client
- Prefer dates with confirmation language: "works", "perfect", "see you then", "confirmed", "sounds good", "can't wait"
- A date proposed + positive reply = confirmed
- If multiple dates were discussed, return only the final agreed one
- If only month+day is given, use ${currentYear}. Use ${currentYear + 1} only if the date has already passed.

Money — report digits only, e.g. "450" or "450.50", and null when not clearly stated:
- paid: what the client has already PAID ("just sent you $225", a payment confirmation, or the photographer acknowledging "got your $225"). A quote, package price, or remaining balance is NOT a payment.
- method: how they paid — Venmo, Zelle, PayPal, Cash App, Square, Cash.
- total: the FULL session price the photographer quoted for this shoot, including any add-ons and travel fee. Not the deposit, and not the remaining balance. If the photographer wrote "$450 total, $225 to book", total is "450" and paid (if sent) is "225".

Return ONLY valid JSON, no markdown:
{"readable":"Friday, June 20, 2026","paid":"225","method":"Venmo","total":"450"}
Use null for any field you cannot determine.`;
}

async function fetchThreadContext(auth: string, email: string): Promise<string> {
  const searchRes = await fetch(
    `${GMAIL_API}/messages?q=${encodeURIComponent(`from:${email} OR to:${email}`)}&maxResults=20`,
    { headers: { Authorization: auth } },
  );
  if (!searchRes.ok) return "";

  const searchData = await searchRes.json() as { messages?: { id: string }[] };
  const ids = (searchData.messages ?? []).map(m => m.id).slice(0, MAX_THREAD_EMAILS);
  if (!ids.length) return "";

  const bodies = await Promise.all(ids.map(async id => {
    try {
      const r = await fetch(`${GMAIL_API}/messages/${id}?format=full`, { headers: { Authorization: auth } });
      if (!r.ok) return "";
      const msg = await r.json() as { payload?: GmailMimePart; snippet?: string };
      return extractEmailText(msg.payload, BODY_CHAR_LIMIT) || msg.snippet || "";
    } catch { return ""; }
  }));

  return bodies
    .filter(Boolean)
    .map((b, i) => `--- Email ${i + 1} ---\n${b}`)
    .join("\n\n");
}

/** Scan the thread for the shoot date, the deposit paid, and the quoted price.
 *  Skipped entirely when the caller already knows the date and needs no money
 *  — a stored session_date plus a ledger amount needs no AI pass. */
export async function detectThreadDetails(opts: {
  email: string;
  dateInMind: string | null;
  sessionDate: string | null;
  needMoney: boolean;
}): Promise<ThreadDetails> {
  const { email, dateInMind, sessionDate, needMoney } = opts;
  const knownDateLabel = sessionDate ? formatSessionDate(sessionDate) : null;
  const fallback: ThreadDetails = {
    confirmedDateLabel: knownDateLabel ?? dateInMind ?? null,
    paidAmount: "", method: "", quotedTotal: "",
  };
  if (knownDateLabel && !needMoney) return fallback;

  const tokens = await getValidTokens();
  if (!tokens) return fallback;

  const emailContext = await fetchThreadContext(`Bearer ${tokens.access_token}`, email);
  if (!emailContext) return fallback;

  const today = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();

  const res = await new Anthropic().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 250,
    system: scanSystemPrompt(today, currentYear),
    messages: [{
      role: "user",
      content: `Client's original date request: ${dateInMind ?? "not specified"}\n\nEmail thread:\n${emailContext}`,
    }],
  });

  try {
    const raw = res.content[0].type === "text" ? res.content[0].text : "{}";
    const result = JSON.parse(extractJson(raw)) as {
      readable: string | null; paid: string | null; method: string | null; total: string | null;
    };
    return {
      confirmedDateLabel: knownDateLabel ?? result.readable ?? dateInMind ?? null,
      paidAmount: typeof result.paid === "string" ? result.paid : "",
      method: typeof result.method === "string" ? result.method.trim().slice(0, 40) : "",
      quotedTotal: typeof result.total === "string" ? result.total : "",
    };
  } catch (error) {
    console.error(`[confirmationThreadScan] bad AI response for ${email}:`, error);
    return fallback;
  }
}
