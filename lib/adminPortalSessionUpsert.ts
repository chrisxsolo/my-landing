import { type SupabaseClient } from "@supabase/supabase-js";
import {
  CLIENT_SESSION_TABLE,
  escapeIlikePattern,
  findMatchingClientSession,
  normalizeClientSessionEmail,
  normalizeClientSessionStatus,
  resolveEffectiveSessionStatus,
  type ClientSessionRow,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import {
  buildClientSessionSyncFields,
  type InquirySeedRow,
} from "@/lib/clientSessionInquirySeed";

type EnsureAdminPortalSessionInput = {
  id?: string;
  clientEmail: string;
  clientName?: string | null;
  sessionType?: string | null;
  sessionDate?: string | null;
  location?: string | null;
  invoiceStatus?: string | null;
  contractStatus?: string | null;
  currentStatus: ClientSessionStatus;
};

type MatchableClientSessionRow = Pick<ClientSessionRow, "id" | "client_email" | "session_type" | "session_date">;

export async function ensureAdminPortalSession(
  supabase: SupabaseClient,
  input: EnsureAdminPortalSessionInput,
) {
  const normalizedEmail = normalizeClientSessionEmail(input.clientEmail);
  if (!normalizedEmail) {
    throw new Error("Client email is required.");
  }

  if (input.id) {
    const { data, error } = await supabase
      .from(CLIENT_SESSION_TABLE)
      .select("id")
      .eq("id", input.id)
      .single<Pick<ClientSessionRow, "id">>();

    if (error) throw error;
    return data.id;
  }

  const { data: existingRows, error: existingError } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .select("id,client_email,session_type,session_date")
    .eq("client_email", normalizedEmail)
    .returns<MatchableClientSessionRow[]>();

  if (existingError) throw existingError;

  const matched = findMatchingClientSession(existingRows ?? [], {
    clientEmail: normalizedEmail,
    sessionType: input.sessionType,
    sessionDate: input.sessionDate,
  });

  if (matched) {
    const updateFields: Record<string, unknown> = {};
    if (input.location) updateFields.location = input.location.trim();
    if (input.invoiceStatus) updateFields.invoice_status = input.invoiceStatus;
    if (input.contractStatus) updateFields.contract_status = input.contractStatus;
    if (Object.keys(updateFields).length > 0) {
      await supabase.from(CLIENT_SESSION_TABLE).update(updateFields).eq("id", matched.id);
    }
    return matched.id;
  }

  const { data: created, error: createError } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .insert({
      client_email: normalizedEmail,
      client_name: input.clientName?.trim() || null,
      session_type: input.sessionType?.trim() || null,
      session_date: input.sessionDate || null,
      location: input.location?.trim() || null,
      invoice_status: input.invoiceStatus || null,
      contract_status: input.contractStatus || null,
      current_status: input.currentStatus,
    })
    .select("id")
    .single<Pick<ClientSessionRow, "id">>();

  if (createError) throw createError;
  return created.id;
}

type DepositPortalSessionInput = {
  clientEmail: string;
  clientName?: string | null;
  sessionType?: string | null;
  sessionDate?: string | null;
  location?: string | null;
};

export type DepositPortalSessionResult = "created" | "advanced" | "unchanged" | "ambiguous" | "skipped";

/**
 * Deposit-paid side effect: guarantees the client has a portal session at
 * least at "booked". Creates one when the client has none; advances an
 * existing one forward only (a manually set later stage is never regressed).
 * When the client has several sessions and none matches by type + date,
 * returns "ambiguous" and touches nothing.
 */
export async function advancePortalSessionForDeposit(
  supabase: SupabaseClient,
  input: DepositPortalSessionInput,
): Promise<DepositPortalSessionResult> {
  const email = normalizeClientSessionEmail(input.clientEmail);
  if (!email) return "skipped";

  type DepositMatchRow = MatchableClientSessionRow & Pick<ClientSessionRow, "current_status">;
  const { data: rows, error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .select("id,client_email,session_type,session_date,current_status")
    .ilike("client_email", escapeIlikePattern(email))
    .returns<DepositMatchRow[]>();
  if (error) throw error;

  if (!rows?.length) {
    const { error: createError } = await supabase.from(CLIENT_SESSION_TABLE).insert({
      client_email: email,
      client_name: input.clientName?.trim() || null,
      session_type: input.sessionType?.trim() || null,
      session_date: input.sessionDate || null,
      location: input.location?.trim() || null,
      invoice_status: "paid",
      current_status: "booked",
    });
    if (createError) throw createError;
    return "created";
  }

  const target = rows.length === 1
    ? rows[0]
    : findMatchingClientSession(rows, {
        clientEmail: email,
        sessionType: input.sessionType,
        sessionDate: input.sessionDate,
      }) as DepositMatchRow | null;
  if (!target) return "ambiguous";

  const stored = normalizeClientSessionStatus(target.current_status);
  const next = resolveEffectiveSessionStatus(stored, true);
  const updates: Record<string, unknown> = { invoice_status: "paid" };
  if (next !== stored) updates.current_status = next;
  if (input.sessionDate && !target.session_date) updates.session_date = input.sessionDate;

  const { error: updateError } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .update(updates)
    .eq("id", target.id);
  if (updateError) throw updateError;
  return next !== stored ? "advanced" : "unchanged";
}

export async function syncAdminInquiryPortalSession(
  supabase: SupabaseClient,
  previous: InquirySeedRow,
  next: InquirySeedRow,
) {
  const email = normalizeClientSessionEmail(previous.email);
  if (!email) return;

  const { data: rows, error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .select("id,client_email,session_type,session_date")
    .ilike("client_email", escapeIlikePattern(email))
    .returns<MatchableClientSessionRow[]>();
  if (error) throw error;
  if (!rows?.length) return;

  const target = rows.length === 1
    ? rows[0]
    : findMatchingClientSession(rows, {
        clientEmail: previous.email,
        sessionType: previous.session_type,
        sessionDate: previous.session_date ?? previous.date_in_mind,
      });
  if (!target) return;

  const { error: updateError } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .update(buildClientSessionSyncFields(next))
    .eq("id", target.id);
  if (updateError) throw updateError;
}
