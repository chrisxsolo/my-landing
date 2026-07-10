// ─────────────────────────────────────────────────────────────────────────────
// POST /api/check-payment
//
// Scans Gmail for payment evidence for a given client, then uses Claude to
// decide whether payment has been received.
//
// Body: { inquiry_id, email, name, date_in_mind?, session_date? }
//   session_date: YYYY-MM-DD — if payment found, marks that date as "booked"
//
// Response:
//   200 { paid, amount, method, note, session_date_booked, evidence, warning? }
//   502 { error, code, raw_preview? }  — Gmail or analysis failed; nothing was
//       written. An analysis failure is an application error, not "unpaid".
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getValidTokens } from "@/lib/gmailTokens";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { requireAdmin } from "@/lib/requireAdmin";
import { extractEmailText, type GmailMimePart } from "@/lib/gmailBodyText";
import {
  FALLBACK_NOTE_UNPAID,
  findDeterministicPaymentEvidence,
  parsePaymentDetectionResult,
  sanitizeModelPreview,
} from "@/lib/paymentDetection";

export const dynamic = "force-dynamic";

const INQUIRIES_TABLE    = "inquiries";
const AVAILABILITY_TABLE = "availability";

const MAX_EMAILS         = 14;
const MAX_BODY_CHARS     = 1500;
const MAX_CONTEXT_CHARS  = 26000;
const CLIENT_THREAD_MAX  = 8;
const PER_QUERY_MAX      = 4;
const NAME_QUERY_MAX     = 6;

const PAYMENT_RESULT_JSON_SCHEMA = {
  type: "object",
  properties: {
    paid:   { type: "boolean", description: "true only when the emails contain positive payment evidence" },
    amount: { anyOf: [{ type: "string" }, { type: "null" }], description: 'Payment amount like "$200", or null when unknown' },
    method: { anyOf: [{ type: "string" }, { type: "null" }], description: 'Payment method like "Venmo", or null when unknown' },
    note:   { type: "string", description: "One-sentence summary of the evidence found" },
  },
  required: ["paid", "amount", "method", "note"],
  additionalProperties: false,
};

// ── Gmail helpers ─────────────────────────────────────────────────────────────

type GmailHeader = { name?: string; value?: string };

// From/Subject/Date let Claude tell the client's payment apart from Chris's
// own purchase notifications, which the generic provider searches also match.
function formatMessageHeaders(headers: GmailHeader[] | undefined): string {
  if (!headers?.length) return "";
  return ["From", "To", "Subject", "Date"]
    .map(name => {
      const value = headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value;
      return value ? `${name}: ${value}` : null;
    })
    .filter(Boolean)
    .join("\n");
}

// null = the request itself failed (network/API error); "" = empty message.
async function fetchMessageBody(id: string, auth: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      { headers: { Authorization: auth } }
    );
    if (!res.ok) return null;
    const msg = await res.json() as { payload?: GmailMimePart & { headers?: GmailHeader[] } };
    const headerLines = formatMessageHeaders(msg.payload?.headers);
    const body = extractEmailText(msg.payload, MAX_BODY_CHARS);
    return headerLines && body ? `${headerLines}\n${body}` : headerLines || body;
  } catch { return null; }
}

// null = the search request failed; [] = no matches.
async function searchMessageIds(query: string, auth: string, maxResults: number): Promise<string[] | null> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages` +
      `?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      { headers: { Authorization: auth } }
    );
    if (!res.ok) return null;
    const data = await res.json() as { messages?: { id: string }[] };
    return (data.messages ?? []).map(m => m.id);
  } catch { return null; }
}

const PROVIDER_FROM =
  "(venmo.com OR paypal.com OR zelle.com OR zellepay.com OR cash.app OR square.com OR squareup.com OR apple.com)";

// Ordered most→least targeted. Results are deduped in this order and capped
// at MAX_EMAILS, so client-attributed evidence must come first — Gmail returns
// newest-first, and the generic provider searches surface Chris's own recent
// purchases, which would otherwise crowd out an older client payment.
function buildPaymentQueries(name: string, email: string): { q: string; max: number }[] {
  const safeFull  = name.replace(/["()]/g, "").trim();
  const firstName = safeFull.split(/\s+/)[0] ?? "";
  const queries: { q: string; max: number }[] = [];

  // 1. Provider notifications naming this client — "Ester Chan paid you $200".
  if (safeFull) queries.push({ q: `from:${PROVIDER_FROM} "${safeFull}"`, max: NAME_QUERY_MAX });
  if (firstName && firstName !== safeFull) {
    queries.push({ q: `from:${PROVIDER_FROM} "${firstName}"`, max: NAME_QUERY_MAX });
  }

  // 2. The direct email thread with the client.
  queries.push({ q: `from:${email} OR to:${email}`, max: CLIENT_THREAD_MAX });

  // 3. Any email pairing the client's name with payment keywords.
  if (firstName) {
    queries.push({ q: `"${firstName}" (deposit OR paid OR "payment sent") newer_than:1y`, max: PER_QUERY_MAX });
  }

  // 4. Generic provider notifications — fallback only; usually unrelated.
  queries.push(
    { q: `from:(venmo.com) (paid OR payment OR "sent you")`, max: PER_QUERY_MAX },
    { q: `from:(paypal.com) ("sent you" OR "received money" OR payment)`, max: PER_QUERY_MAX },
    { q: `from:(zelle.com OR zellepay.com) (sent OR received OR payment OR transfer)`, max: PER_QUERY_MAX },
    { q: `from:(cash.app OR square.com OR squareup.com) (paid OR payment OR received)`, max: PER_QUERY_MAX },
    { q: `from:(apple.com) ("apple cash" OR "apple pay")`, max: PER_QUERY_MAX },
    { q: `subject:(paid OR payment OR deposit OR transfer OR "sent you" OR "received money") newer_than:1y`, max: PER_QUERY_MAX },
  );
  return queries;
}

// ── Claude ────────────────────────────────────────────────────────────────────

function buildSystemPrompt(name: string): string {
  return `You are a payment detection assistant for a photographer named Chris.
Analyze the provided emails and decide whether client "${name}" has paid a deposit or session fee.

Payment evidence includes:
- Venmo/Zelle/PayPal/Cash App/Square/Apple Cash transfer notifications
- The client saying "I sent it", "I paid", "payment sent", "just paid", "deposit sent"
- Bank transfer receipts or payment confirmations
- Dollar amounts ($) mentioned in a payment context

A generic mention of the word "payment" with no confirmation is NOT evidence.

The inbox belongs to Chris, so provider notifications may include HIS OWN
purchases and outgoing payments. Only count money Chris RECEIVED, and only when
the payer matches "${name}" (use the From/Subject lines and any names in the
email body). Payments from anyone else are NOT evidence for this client.

Output contract — follow it exactly:
- Return a single JSON object and nothing else: no markdown fences, no prose before or after it.
- Use exactly these property names: paid, amount, method, note.
- "paid" must be a JSON boolean (true or false), never a string.
- "amount" must be a string like "$200", or null when unknown.
- "method" must be a string like "Venmo", or null when unknown.
- "note" must be a short one-sentence summary of the evidence, or "${FALLBACK_NOTE_UNPAID}".`;
}

// Structured outputs (output_config.format) pin the response to the schema.
// If the API rejects the option (e.g. an older model), retry once without it —
// the defensive parser still guards the plain-text path.
async function runPaymentAnalysis(system: string, userContent: string) {
  const anthropic = new Anthropic();
  const base = {
    model:      "claude-sonnet-4-6" as const,
    max_tokens: 300,
    system,
    messages:   [{ role: "user" as const, content: userContent }],
  };
  try {
    return await anthropic.messages.create({
      ...base,
      output_config: { format: { type: "json_schema", schema: PAYMENT_RESULT_JSON_SCHEMA } },
    });
  } catch (err) {
    if ((err as { status?: number })?.status === 400) return anthropic.messages.create(base);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: Record<string, string>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { inquiry_id, email, name, session_date } = body;
  if (!inquiry_id || !email || !name) {
    return NextResponse.json({ error: "inquiry_id, email, and name are required" }, { status: 400 });
  }

  const tokens = await getValidTokens();
  if (!tokens) return NextResponse.json({ error: "Gmail not connected" }, { status: 401 });

  const auth = `Bearer ${tokens.access_token}`;

  // ── 1. Search: client-attributed evidence first, generic providers last ───
  const queries = buildPaymentQueries(name, email);
  const searchResults = await Promise.all(queries.map(({ q, max }) => searchMessageIds(q, auth, max)));

  if (searchResults.every(r => r === null)) {
    console.error("[check-payment] all Gmail searches failed for inquiry", inquiry_id);
    return NextResponse.json(
      { error: "Gmail search failed. No payment status was changed.", code: "GMAIL_SEARCH_FAILED" },
      { status: 502 }
    );
  }

  const allIds = [...new Set(searchResults.filter(Boolean).flat() as string[])].slice(0, MAX_EMAILS);

  if (!allIds.length) {
    return NextResponse.json({
      paid: false, amount: null, method: null,
      note: "No emails found to analyze.",
      session_date_booked: false, evidence: [],
    });
  }

  // ── 2. Load message bodies in parallel ────────────────────────────────────
  const bodies = await Promise.all(allIds.map(id => fetchMessageBody(id, auth)));
  if (bodies.every(b => b === null)) {
    console.error("[check-payment] all Gmail message fetches failed for inquiry", inquiry_id);
    return NextResponse.json(
      { error: "Gmail message fetch failed. No payment status was changed.", code: "GMAIL_FETCH_FAILED" },
      { status: 502 }
    );
  }

  const emailContext = bodies
    .map((b, i) => b ? `--- Email ${i + 1} ---\n${b}` : null)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, MAX_CONTEXT_CHARS);

  if (!emailContext) {
    return NextResponse.json({
      paid: false, amount: null, method: null,
      note: "No readable email content found.",
      session_date_booked: false, evidence: [],
    });
  }

  // ── 3. Deterministic evidence scan (fed to Claude, echoed in the note) ────
  const evidence = findDeterministicPaymentEvidence(emailContext);

  // ── 4. Ask Claude to classify ──────────────────────────────────────────────
  let claudeRes: Awaited<ReturnType<typeof runPaymentAnalysis>>;
  try {
    claudeRes = await runPaymentAnalysis(
      buildSystemPrompt(name),
      `Client name: ${name}\nClient email: ${email}\n\n` +
      `Deterministic keyword scan: ${evidence.length ? evidence.join("; ") : "no high-confidence payment phrases found"}.\n\n` +
      `Emails to analyze:\n\n${emailContext}`
    );
  } catch (err) {
    console.error("[check-payment] Claude request failed:", err);
    return NextResponse.json(
      { error: "Payment analysis request failed.", code: "PAYMENT_ANALYSIS_FAILED" },
      { status: 502 }
    );
  }

  const rawText = claudeRes.content.find(b => b.type === "text")?.text ?? "";
  const result  = parsePaymentDetectionResult(rawText);

  // A parse failure is an application error, not proof of non-payment:
  // touch nothing in the database and surface a 502.
  if (!result) {
    console.error("[check-payment] unparseable model output:", sanitizeModelPreview(rawText));
    return NextResponse.json({
      error:       "Payment analysis returned an invalid response.",
      code:        "PAYMENT_RESPONSE_PARSE_FAILED",
      raw_preview: sanitizeModelPreview(rawText),
    }, { status: 502 });
  }

  // ── 5. Persist the outcome ─────────────────────────────────────────────────
  const supabase = createSupabaseServerClient();
  const noteParts = [result.note, result.amount, result.method && `via ${result.method}`];
  if (result.paid && evidence.length) noteParts.push(`Detected: ${evidence.slice(0, 3).join(", ")}`);
  const paymentNote = noteParts.filter(Boolean).join(" · ");

  const validSessionDate = session_date && /^\d{4}-\d{2}-\d{2}$/.test(session_date) ? session_date : null;
  let warning: string | undefined;

  if (result.paid) {
    const now = new Date().toISOString();
    const { error: updateError } = await supabase.from(INQUIRIES_TABLE).update({
      payment_status:      "paid",
      payment_note:        paymentNote,
      payment_detected_at: now,
      deposit_paid_at:     now,
      booking_confirmed:   true,
      ...(validSessionDate ? { session_date: validSessionDate } : {}),
    }).eq("id", inquiry_id);

    if (updateError) {
      console.error("[check-payment] inquiry update failed:", updateError);
      return NextResponse.json(
        { error: "Payment was detected but the inquiry could not be updated.", code: "DB_UPDATE_FAILED" },
        { status: 500 }
      );
    }
    if (session_date && !validSessionDate) {
      warning = "session_date was not in YYYY-MM-DD format and was not saved.";
    }
  } else {
    // Record that we checked; non-critical, so a failure only warns.
    const { error: noteError } = await supabase.from(INQUIRIES_TABLE).update({
      payment_note: paymentNote || FALLBACK_NOTE_UNPAID,
    }).eq("id", inquiry_id);
    if (noteError) {
      console.error("[check-payment] payment_note update failed:", noteError);
      warning = "Result was not saved to the inquiry.";
    }
  }

  // ── 6. Mark availability date as booked if payment found ──────────────────
  let session_date_booked = false;
  if (result.paid && validSessionDate) {
    const { error: availError } = await supabase.from(AVAILABILITY_TABLE).upsert(
      { date: validSessionDate, status: "booked", note: `Booked — ${name}` },
      { onConflict: "date" }
    );
    if (availError) {
      console.error("[check-payment] availability upsert failed:", availError);
      warning = "Payment saved, but the calendar date could not be marked as booked.";
    } else {
      session_date_booked = true;
    }
  }

  return NextResponse.json({
    paid:   result.paid,
    amount: result.amount,
    method: result.method,
    note:   paymentNote,
    session_date_booked,
    evidence,
    ...(warning ? { warning } : {}),
  });
}
