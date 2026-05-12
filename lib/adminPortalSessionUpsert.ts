import { type SupabaseClient } from "@supabase/supabase-js";
import {
  CLIENT_SESSION_TABLE,
  findMatchingClientSession,
  normalizeClientSessionEmail,
  type ClientSessionRow,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

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
