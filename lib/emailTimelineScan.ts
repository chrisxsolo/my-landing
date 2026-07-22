// ─────────────────────────────────────────────────────────────────────────────
// AI email-thread milestone scanning for the client timeline sync.
//
// For a given client, fetches their Gmail conversation (both directions),
// extracts message bodies, and asks Claude to identify which email — if any —
// shows each booking milestone happening. Timestamps come from the actual
// email, not the model.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from "@anthropic-ai/sdk";
import {
  CLIENT_SESSION_STATUS_VALUES,
  normalizeClientSessionStatus,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_EMAILS_PER_CLIENT = 12;
const BODY_CHAR_LIMIT = 1200;

export type EmailMilestones = {
  replySentAt: string | null;
  invoiceSentAt: string | null;
  contractSentAt: string | null;
  depositPaidAt: string | null;
  contractSignedAt: string | null;
  galleryDeliveredAt: string | null;
  /** Shoot date both sides agreed on in the thread, as YYYY-MM-DD. */
  sessionDate: string | null;
  /** Shoot start time both sides agreed on, as 24h HH:MM. */
  sessionTime: string | null;
};

export type MilestoneScanClient = { email: string; name: string | null };

type MimePart = { mimeType?: string; body?: { data?: string }; parts?: MimePart[] };
type GmailFullMessage = {
  internalDate?: string;
  snippet?: string;
  payload?: MimePart & { headers?: { name: string; value: string }[] };
};

function decodeBody(data: string): string {
  try {
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
    return decodeURIComponent(
      Array.from(atob(padded))
        .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
  } catch { return ""; }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
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

function extractJson(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

type ThreadEntry = { index: number; iso: string; direction: string; subject: string; body: string };

async function fetchClientThread(auth: string, clientEmail: string): Promise<ThreadEntry[]> {
  const searchRes = await fetch(
    `${GMAIL_API}/messages?q=${encodeURIComponent(`from:${clientEmail} OR to:${clientEmail}`)}&maxResults=20`,
    { headers: { Authorization: auth } },
  );
  if (!searchRes.ok) return [];
  const data = await searchRes.json() as { messages?: { id: string }[] };
  const ids = (data.messages ?? []).map(m => m.id).slice(0, MAX_EMAILS_PER_CLIENT);
  if (!ids.length) return [];

  const messages = await Promise.all(ids.map(async id => {
    try {
      const r = await fetch(`${GMAIL_API}/messages/${id}?format=full`, { headers: { Authorization: auth } });
      if (!r.ok) return null;
      return await r.json() as GmailFullMessage;
    } catch { return null; }
  }));

  const entries: ThreadEntry[] = [];
  for (const msg of messages) {
    if (!msg) continue;
    const headers = msg.payload?.headers ?? [];
    const header = (name: string) =>
      headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    const from = header("From").toLowerCase();
    const body = (extractBestText(msg.payload ?? {}) || msg.snippet || "").slice(0, BODY_CHAR_LIMIT);
    if (!body) continue;
    entries.push({
      index: 0, // assigned after sorting
      iso: msg.internalDate ? new Date(parseInt(msg.internalDate, 10)).toISOString() : new Date().toISOString(),
      direction: from.includes(clientEmail.toLowerCase()) ? "CLIENT → ME" : "ME → CLIENT",
      subject: header("Subject"),
      body,
    });
  }
  entries.sort((a, b) => a.iso.localeCompare(b.iso));
  return entries.map((e, i) => ({ ...e, index: i + 1 }));
}

type MilestoneIndices = {
  reply_sent: number | null;
  invoice_sent: number | null;
  contract_sent: number | null;
  deposit_paid: number | null;
  contract_signed: number | null;
  gallery_delivered: number | null;
  session_date: string | null;
  session_time: string | null;
};

const SCAN_SYSTEM_PROMPT = `You analyze the email thread between a photographer (SoloxSnaps) and one specific client to detect booking milestones. Emails are numbered chronologically and labeled with direction: "ME → CLIENT" is the photographer writing to the client, "CLIENT → ME" is the client writing back.

Identify the FIRST email (lowest number) that clearly shows each milestone:
- reply_sent: photographer's first reply to the client (any ME → CLIENT email responding to their inquiry)
- invoice_sent: photographer sent an invoice (invoice attached, linked, or explicitly mentioned as sent)
- contract_sent: photographer sent a contract / agreement for signing
- deposit_paid: clear evidence the client paid the deposit/retainer — client says they sent payment, a payment confirmation appears, or the photographer acknowledges receiving it
- contract_signed: clear evidence the client signed the contract — signed copy returned, client confirms signing, or e-sign completion notice
- gallery_delivered: photographer delivered the final photo gallery (gallery link such as Pixieset, "your photos are ready", download link)

Also extract:
- session_date: the shoot date once both sides clearly agree on it (e.g. client says "let's lock in 8/1" and the photographer confirms). Output as YYYY-MM-DD, inferring the year from the email dates around it. If the date was later rescheduled, use the FINAL agreed date. null when no date is clearly agreed — a list of candidate dates the client is still deciding between does NOT count.
- session_time: the shoot start time once both sides clearly agree on it (e.g. photographer proposes "Would 4:00pm work?" and the client confirms). Output as 24-hour HH:MM. If the time was later changed, use the FINAL agreed time. null when no time is clearly agreed.

Be conservative: only report a milestone when the evidence is clear for THIS client. Mentioning a future invoice ("I'll send an invoice") does NOT count as invoice_sent. Discussing price is not deposit_paid.

Respond ONLY with valid JSON — no markdown, no code fences, no explanation:
{"reply_sent":<email number or null>,"invoice_sent":<email number or null>,"contract_sent":<email number or null>,"deposit_paid":<email number or null>,"contract_signed":<email number or null>,"gallery_delivered":<email number or null>,"session_date":<"YYYY-MM-DD" or null>,"session_time":<"HH:MM" or null>}`;

export async function scanClientEmailMilestones(
  auth: string,
  client: MilestoneScanClient,
): Promise<EmailMilestones | null> {
  const entries = await fetchClientThread(auth, client.email);
  if (!entries.length) return null;

  const thread = entries
    .map(e => `--- Email ${e.index} | ${e.direction} | ${e.iso.slice(0, 10)} | Subject: ${e.subject} ---\n${e.body}`)
    .join("\n\n");

  const anthropic = new Anthropic();
  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 200,
    system: SCAN_SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `Client: ${client.name ?? "unknown"} <${client.email}>\n\nEmail thread:\n${thread}`,
    }],
  });

  let indices: MilestoneIndices;
  try {
    const raw = res.content[0].type === "text" ? res.content[0].text : "{}";
    indices = JSON.parse(extractJson(raw)) as MilestoneIndices;
  } catch (error) {
    console.error(`[emailTimelineScan] bad AI response for ${client.email}:`, error);
    return null;
  }

  const dateOf = (n: number | null) =>
    typeof n === "number" ? entries.find(e => e.index === n)?.iso ?? null : null;

  return {
    replySentAt: dateOf(indices.reply_sent),
    invoiceSentAt: dateOf(indices.invoice_sent),
    contractSentAt: dateOf(indices.contract_sent),
    depositPaidAt: dateOf(indices.deposit_paid),
    contractSignedAt: dateOf(indices.contract_signed),
    galleryDeliveredAt: dateOf(indices.gallery_delivered),
    sessionDate: typeof indices.session_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(indices.session_date)
      ? indices.session_date
      : null,
    sessionTime: typeof indices.session_time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(indices.session_time)
      ? indices.session_time
      : null,
  };
}

// Scan several clients with bounded concurrency so a full sync stays inside
// the serverless time limit.
export async function scanMilestonesForClients(
  auth: string,
  clients: MilestoneScanClient[],
  concurrency = 4,
): Promise<Map<string, EmailMilestones>> {
  const results = new Map<string, EmailMilestones>();
  for (let i = 0; i < clients.length; i += concurrency) {
    const batch = clients.slice(i, i + concurrency);
    const scanned = await Promise.all(batch.map(async c => {
      try { return { email: c.email.toLowerCase(), milestones: await scanClientEmailMilestones(auth, c) }; }
      catch (error) {
        console.error(`[emailTimelineScan] scan failed for ${c.email}:`, error);
        return { email: c.email.toLowerCase(), milestones: null };
      }
    }));
    for (const s of scanned) {
      if (s.milestones) results.set(s.email, s.milestones);
    }
  }
  return results;
}

// ─── Portal-stage advancement ────────────────────────────────────────────────
// Maps detected milestones onto the 9-stage client portal progress. Only ever
// moves a session FORWARD — a manually set later stage is never regressed.

export type StatusSignals = {
  replySent: boolean;
  invoiceSent: boolean;
  contractSent: boolean;
  depositPaid: boolean;
  contractSigned: boolean;
  sessionDatePast: boolean;
  galleryDelivered: boolean;
};

const statusIdx = (s: ClientSessionStatus) => CLIENT_SESSION_STATUS_VALUES.indexOf(s);

export function computeAdvancedStatus(
  currentStatus: string,
  signals: StatusSignals,
): ClientSessionStatus | null {
  const currentIdx = statusIdx(normalizeClientSessionStatus(currentStatus));

  let target: ClientSessionStatus = "inquiry_received";
  if (signals.replySent || signals.invoiceSent || signals.contractSent || signals.contractSigned) {
    target = "booking_in_progress";
  }
  if (signals.depositPaid) target = "booked";
  // Only auto-complete a past session when there's booking evidence — a dead
  // lead with a stale tentative date shouldn't jump to "completed".
  if (signals.sessionDatePast && (signals.depositPaid || currentIdx >= statusIdx("booked"))) {
    target = "session_completed";
  }
  if (signals.galleryDelivered) target = "delivered";

  return statusIdx(target) > currentIdx ? target : null;
}
