import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/get-user";
import { isAdminUser } from "@/lib/auth/is-admin";
import { ensureAdminPortalSession } from "@/lib/adminPortalSessionUpsert";
import {
  CLIENT_SESSION_TABLE,
  isClientSessionStatus,
  type ClientSessionRow,
  toAdminClientSessionDTO,
} from "@/lib/clientSessions";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const FIELD_MAP = {
  clientName: "client_name",
  sessionType: "session_type",
  location: "location",
  meetingPoint: "meeting_point",
  invoiceStatus: "invoice_status",
  contractStatus: "contract_status",
  backupStatus: "backup_status",
  internalNotes: "internal_notes",
  clientNotes: "client_notes",
} as const;

type AdminCheck =
  | { userId: string; response: null }
  | { userId: null; response: NextResponse };

async function requireSupabaseAdmin(req: NextRequest): Promise<AdminCheck> {
  const cookieAuth = requireAdmin(req);
  if (!cookieAuth) {
    return { userId: "cookie-admin", response: null };
  }

  const user = await getUserFromRequest(req);
  if (!user) {
    return { userId: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!(await isAdminUser(user.id))) {
    return { userId: null, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { userId: user.id, response: null };
}

function readText(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function readDateTime(value: unknown) {
  const text = readText(value);
  if (!text) return text;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function readDate(value: unknown) {
  const text = readText(value);
  if (!text) return text;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function readUrl(value: unknown) {
  const text = readText(value);
  if (!text) return text;

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function buildWriteData(body: Record<string, unknown>, requireEmail: boolean) {
  const data: Record<string, unknown> = {};
  const email = readText(body.clientEmail);

  if (requireEmail && !email) return { error: "Client email is required." };
  if (email === undefined && requireEmail) return { error: "Client email is required." };
  if (email) {
    data.client_email = email.toLowerCase();
    data.client_user_id = null;
  }

  if ("currentStatus" in body) {
    if (!isClientSessionStatus(body.currentStatus)) return { error: "Invalid session status." };
    data.current_status = body.currentStatus;
  }

  const sessionDate = readDateTime(body.sessionDate);
  const deliveryDate = readDate(body.estimatedDeliveryDate);
  const galleryUrl = readUrl(body.galleryUrl);

  if ("sessionDate" in body && sessionDate === undefined) return { error: "Invalid session date." };
  if ("estimatedDeliveryDate" in body && deliveryDate === undefined) return { error: "Invalid estimated delivery date." };
  if ("galleryUrl" in body && galleryUrl === undefined) return { error: "Gallery URL must start with http:// or https://." };

  if ("sessionDate" in body) data.session_date = sessionDate;
  if ("estimatedDeliveryDate" in body) data.estimated_delivery_date = deliveryDate;
  if ("galleryUrl" in body) data.gallery_url = galleryUrl;

  for (const [inputKey, column] of Object.entries(FIELD_MAP)) {
    if (inputKey in body) data[column] = readText(body[inputKey]);
  }

  return { data };
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireSupabaseAdmin(req);
    if (admin.response) return admin.response;

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(CLIENT_SESSION_TABLE)
      .select("*")
      .order("created_at", { ascending: false })
      .returns<ClientSessionRow[]>();

    if (error) throw error;
    return NextResponse.json({ sessions: (data ?? []).map(toAdminClientSessionDTO) });
  } catch (err) {
    console.error("[admin/sessions] GET", err);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireSupabaseAdmin(req);
    if (admin.response) return admin.response;

    const body = await req.json() as Record<string, unknown>;
    const result = buildWriteData(body, true);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    // Auto-set delivery to 14 days after shoot for new sessions
    if (result.data.session_date && !result.data.estimated_delivery_date) {
      const shoot = new Date(result.data.session_date as string);
      if (!isNaN(shoot.getTime())) {
        const delivery = new Date(shoot.getTime() + 14 * 24 * 60 * 60 * 1000);
        result.data.estimated_delivery_date = delivery.toISOString().slice(0, 10);
      }
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from(CLIENT_SESSION_TABLE)
      .insert(result.data)
      .select("*")
      .single<ClientSessionRow>();

    if (error) throw error;
    return NextResponse.json({ session: toAdminClientSessionDTO(data) }, { status: 201 });
  } catch (err) {
    console.error("[admin/sessions] POST", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireSupabaseAdmin(req);
    if (admin.response) return admin.response;

    const body = await req.json() as Record<string, unknown>;
    const supabase = createSupabaseAdminClient();
    const quickStatusUpdate = body.quickStatusUpdate === true;

    if (quickStatusUpdate) {
      if (!isClientSessionStatus(body.currentStatus)) {
        return NextResponse.json({ error: "Invalid session status." }, { status: 400 });
      }

      const sessionId = await ensureAdminPortalSession(supabase, {
        id: typeof body.id === "string" && body.id ? body.id : undefined,
        clientEmail: readText(body.clientEmail) ?? "",
        clientName: readText(body.clientName),
        sessionType: readText(body.sessionType),
        sessionDate: readDateTime(body.sessionDate) ?? readDate(body.sessionDate) ?? null,
        location: readText(body.location),
        invoiceStatus: readText(body.invoiceStatus),
        contractStatus: readText(body.contractStatus),
        currentStatus: body.currentStatus,
      });

      const { data, error } = await supabase
        .from(CLIENT_SESSION_TABLE)
        .update({ current_status: body.currentStatus })
        .eq("id", sessionId)
        .select("*")
        .single<ClientSessionRow>();

      if (error) throw error;
      return NextResponse.json({ session: toAdminClientSessionDTO(data) });
    }

    if (typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "Session id is required." }, { status: 400 });
    }

    const { data: existingSession, error: existingError } = await supabase
      .from(CLIENT_SESSION_TABLE)
      .select("client_email,client_user_id,estimated_delivery_date")
      .eq("id", body.id)
      .single<Pick<ClientSessionRow, "client_email" | "client_user_id" | "estimated_delivery_date">>();

    if (existingError) throw existingError;

    const result = buildWriteData(body, false);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });

    // Auto-set delivery to 14 days after shoot only if no delivery date exists yet
    if (result.data.session_date && !result.data.estimated_delivery_date && !existingSession.estimated_delivery_date) {
      const shoot = new Date(result.data.session_date as string);
      if (!isNaN(shoot.getTime())) {
        const delivery = new Date(shoot.getTime() + 14 * 24 * 60 * 60 * 1000);
        result.data.estimated_delivery_date = delivery.toISOString().slice(0, 10);
      }
    }

    const nextEmail = readText(body.clientEmail)?.toLowerCase();
    const currentEmail = existingSession.client_email.toLowerCase();
    if (nextEmail && nextEmail !== currentEmail) {
      result.data.client_user_id = null;
    }
    if (body.unlinkAccount === true) {
      result.data.client_user_id = null;
    }

    const { data, error } = await supabase
      .from(CLIENT_SESSION_TABLE)
      .update(result.data)
      .eq("id", body.id)
      .select("*")
      .single<ClientSessionRow>();

    if (error) throw error;
    return NextResponse.json({ session: toAdminClientSessionDTO(data) });
  } catch (err) {
    console.error("[admin/sessions] PATCH", err);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireSupabaseAdmin(req);
    if (admin.response) return admin.response;

    const body = await req.json() as Record<string, unknown>;
    if (typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "Session id is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from(CLIENT_SESSION_TABLE)
      .delete()
      .eq("id", body.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/sessions] DELETE", err);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
