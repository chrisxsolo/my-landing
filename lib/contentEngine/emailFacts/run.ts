// Orchestration for "Auto-fill from email": who is this client, which
// conversation is theirs, what does it currently say, and what changed since
// the last look.
//
// The AI processing permission gates this exactly as it gates photo analysis —
// a client's private correspondence is not sent to a model for a session that
// has not granted it.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelCaller } from "@/lib/contentEngine/aiClient";
import { normalizeEmail } from "@/lib/inquiryReconcile";
import { chooseThreads, numberConversation, type ThreadCandidate } from "./conversation";
import { fetchClientThreads } from "./gmailThreads";
import { extractSessionFacts, type DroppedFact, type ExtractedFact } from "./extract";
import { EMAIL_FACT_FIELDS, FIELD_SPECS, type EmailFactField } from "./fields";

export const PHOTOGRAPHY_SESSIONS_TABLE = "photography_sessions";
/** The business operates in the Bay Area; shoot dates and times are local. */
export const SESSION_TIMEZONE = "America/Los_Angeles";

export interface SessionContact {
  email: string;
  name: string | null;
  linkedThreadIds: string[];
}

export interface ThreadSummary {
  threadId: string;
  subject: string;
  firstAt: string;
  lastAt: string;
  messageCount: number;
}

export type ExtractionOutcome =
  | { outcome: "no_contact" }
  | { outcome: "no_conversation"; contact: SessionContact }
  | { outcome: "ambiguous"; contact: SessionContact; threads: ThreadSummary[] }
  | {
      outcome: "extracted";
      contact: SessionContact;
      threads: ThreadSummary[];
      messageCount: number;
      latestMessageAt: string;
      facts: ExtractedFact[];
      dropped: DroppedFact[];
      usage: { model: string; input_tokens: number; output_tokens: number }[];
      promptVersion: string;
    };

const summarize = (candidate: ThreadCandidate): ThreadSummary => ({
  threadId: candidate.threadId,
  subject: candidate.subject || "(no subject)",
  firstAt: candidate.firstAt,
  lastAt: candidate.lastAt,
  messageCount: candidate.messages.length,
});

export function todayInSessionTimezone(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SESSION_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

const SESSION_SELECT = [
  "id", "client_session_id", "inquiry_id", "internal_client_name", "ai_processing_allowed",
  "service_type", "session_date", "primary_location",
  "email_facts_thread_ids", "email_facts_last_message_id", "email_facts_last_message_at",
  "email_facts_extracted_at",
].join(",");

export interface SessionRow {
  id: string;
  client_session_id: string | null;
  inquiry_id: number | null;
  internal_client_name: string | null;
  ai_processing_allowed: boolean;
  service_type: string;
  session_date: string | null;
  primary_location: string | null;
  email_facts_thread_ids: string[] | null;
  email_facts_last_message_id: string | null;
  email_facts_last_message_at: string | null;
  email_facts_extracted_at: string | null;
}

export async function loadSession(client: SupabaseClient, sessionId: string): Promise<SessionRow> {
  const { data, error } = await client
    .from(PHOTOGRAPHY_SESSIONS_TABLE).select(SESSION_SELECT).eq("id", sessionId).maybeSingle();
  if (error) throw new Error(`session lookup failed: ${error.message}`);
  if (!data) throw new Error("photography session not found");
  return data as unknown as SessionRow;
}

/**
 * The client's email address and any Gmail thread already linked to this
 * booking. The inquiry is preferred — it is the row the reply-status
 * reconciliation keeps thread ids on — then the client session.
 */
export async function resolveSessionContact(
  client: SupabaseClient, session: SessionRow,
): Promise<SessionContact | null> {
  const linked = new Set<string>(session.email_facts_thread_ids ?? []);
  let email: string | null = null;
  let name: string | null = session.internal_client_name;

  if (session.inquiry_id !== null) {
    const { data } = await client.from("inquiries")
      .select("email,name,gmail_thread_ids").eq("id", session.inquiry_id).maybeSingle();
    if (data?.email) {
      email = normalizeEmail(data.email as string);
      name = name ?? (data.name as string | null);
    }
    for (const threadId of (data?.gmail_thread_ids as string[] | null) ?? []) linked.add(threadId);
  }

  if (!email && session.client_session_id) {
    const { data } = await client.from("client_sessions")
      .select("client_email,client_name").eq("id", session.client_session_id).maybeSingle();
    if (data?.client_email) {
      email = normalizeEmail(data.client_email as string);
      name = name ?? (data.client_name as string | null);
    }
  }

  if (!email?.includes("@")) return null;
  return { email, name, linkedThreadIds: [...linked] };
}

/** The facts already on the session, as context for the extraction prompt. */
export function knownFactsFor(session: Record<string, unknown>): Partial<Record<EmailFactField, string>> {
  const known: Partial<Record<EmailFactField, string>> = {};
  for (const field of EMAIL_FACT_FIELDS) {
    // Internal notes are private to the business: they are never sent to a
    // model, not even as context for reading the client's own emails.
    if (FIELD_SPECS[field].internal) continue;
    const value = session[field];
    if (Array.isArray(value) && value.length) known[field] = value.join(", ");
    else if (typeof value === "string" && value.trim()) known[field] = value;
  }
  return known;
}

/**
 * The Gmail side of the run, injectable for the same reason ModelCaller is:
 * integration tests drive the whole pipeline against a deterministic
 * conversation instead of a live mailbox.
 */
export type ThreadFetcher = (args: {
  auth: string;
  clientEmail: string;
  connectedEmails: string[];
  linkedThreadIds?: string[];
}) => Promise<ThreadCandidate[]>;

export interface RunExtractionArgs {
  client: SupabaseClient;
  callModel: ModelCaller;
  auth: string;
  connectedEmails: string[];
  sessionId: string;
  /** Set when the photographer picked the conversation themselves. */
  threadId?: string | null;
  model?: string;
  now?: Date;
  fetchThreads?: ThreadFetcher;
}

export async function runEmailFactExtraction(args: RunExtractionArgs): Promise<ExtractionOutcome> {
  const { client, sessionId } = args;
  const session = await loadSession(client, sessionId);
  if (!session.ai_processing_allowed) {
    throw new Error("ai processing is not allowed for this session");
  }

  // The full session row carries the current facts for the prompt context.
  const { data: fullSession } = await client
    .from(PHOTOGRAPHY_SESSIONS_TABLE).select("*").eq("id", sessionId).single();

  const contact = await resolveSessionContact(client, session);
  if (!contact) return { outcome: "no_contact" };

  const fetchThreads = args.fetchThreads ?? fetchClientThreads;
  const candidates = await fetchThreads({
    auth: args.auth,
    clientEmail: contact.email,
    connectedEmails: args.connectedEmails,
    linkedThreadIds: contact.linkedThreadIds,
  });
  if (!candidates.length) return { outcome: "no_conversation", contact };

  let chosen: ThreadCandidate[];
  if (args.threadId) {
    const picked = candidates.find((c) => c.threadId === args.threadId);
    if (!picked) return { outcome: "no_conversation", contact };
    chosen = [picked];
  } else {
    const choice = chooseThreads(
      candidates,
      {
        serviceType: session.service_type,
        sessionDate: session.session_date,
        primaryLocation: session.primary_location,
      },
      contact.linkedThreadIds,
    );
    if (choice.outcome === "ambiguous") {
      return {
        outcome: "ambiguous", contact,
        threads: choice.candidates.map((ranked) => summarize(ranked.candidate)),
      };
    }
    chosen = choice.threads;
  }
  if (!chosen.length) return { outcome: "no_conversation", contact };

  const messages = numberConversation(chosen.flatMap((thread) => thread.messages));
  if (!messages.length) return { outcome: "no_conversation", contact };
  const latest = messages[messages.length - 1];

  const extraction = await extractSessionFacts({
    callModel: args.callModel,
    messages,
    model: args.model,
    today: todayInSessionTimezone(args.now),
    knownFacts: knownFactsFor(fullSession ?? {}),
  });

  // Remember what was read, so the cheap freshness check has a baseline and a
  // thread the photographer disambiguated once stays disambiguated.
  const { error: markErr } = await client.from(PHOTOGRAPHY_SESSIONS_TABLE).update({
    email_facts_extracted_at: new Date().toISOString(),
    email_facts_last_message_id: latest.gmailMessageId,
    email_facts_last_message_at: latest.at,
    email_facts_thread_ids: chosen.map((thread) => thread.threadId),
  }).eq("id", sessionId);
  if (markErr) console.error("[email-facts] could not record extraction marker", markErr.message);

  return {
    outcome: "extracted",
    contact,
    threads: chosen.map(summarize),
    messageCount: messages.length,
    latestMessageAt: latest.at,
    facts: extraction.facts,
    dropped: extraction.dropped,
    usage: extraction.usage,
    promptVersion: extraction.promptVersion,
  };
}

export type FreshnessOutcome =
  | { outcome: "never_extracted" }
  | { outcome: "unchanged"; lastMessageAt: string | null }
  | { outcome: "new_messages"; newest: string; since: string | null };

/**
 * Has the conversation moved since the last extraction? Gmail metadata only —
 * no bodies, no model call — so the workspace can show an indicator without
 * spending anything. Returns `never_extracted` when there is no baseline,
 * which is how the workspace avoids calling Gmail for sessions that have
 * never used the feature.
 */
export async function checkForNewMessages(args: {
  client: SupabaseClient;
  auth: string;
  sessionId: string;
}): Promise<FreshnessOutcome> {
  const session = await loadSession(args.client, args.sessionId);
  if (!session.email_facts_extracted_at || !(session.email_facts_thread_ids ?? []).length) {
    return { outcome: "never_extracted" };
  }

  let newest: string | null = null;
  for (const threadId of session.email_facts_thread_ids ?? []) {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=minimal`,
      { headers: { Authorization: args.auth } },
    );
    if (!res.ok) continue;
    const thread = await res.json() as { messages?: { internalDate?: string; labelIds?: string[] }[] };
    for (const message of thread.messages ?? []) {
      if (message.labelIds?.includes("DRAFT")) continue;
      if (!message.internalDate) continue;
      const at = new Date(Number(message.internalDate)).toISOString();
      if (!newest || at > newest) newest = at;
    }
  }

  const baseline = session.email_facts_last_message_at;
  // Postgres hands back "2026-10-23 14:02:08.13+00", not strict ISO, so these
  // are compared as instants rather than as strings.
  const baselineMs = baseline ? Date.parse(baseline.replace(" ", "T")) : NaN;
  if (newest && (Number.isNaN(baselineMs) || Date.parse(newest) > baselineMs)) {
    return { outcome: "new_messages", newest, since: baseline };
  }
  return { outcome: "unchanged", lastMessageAt: baseline };
}
