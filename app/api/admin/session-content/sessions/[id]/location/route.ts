import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { buildLocationSummary } from "@/lib/contentEngine/locationSummary";
import {
  LocationConfirmError, confirmNewPlace, linkToExistingPlace, parseNewPlaceInput,
} from "@/lib/locations/confirmLocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function sessionId(req: NextRequest, params: Params["params"]) {
  const deny = requireAdmin(req);
  if (deny) return { deny };
  const { id } = await params;
  if (!isUuid(id)) return { deny: NextResponse.json({ error: "session id must be a uuid" }, { status: 400 }) };
  return { id: id.toLowerCase() };
}

export async function GET(req: NextRequest, { params }: Params) {
  const s = await sessionId(req, params);
  if (s.deny) return s.deny;
  try {
    const summary = await buildLocationSummary(createSupabaseAdminClient(), s.id);
    if (!summary) return NextResponse.json({ error: "session not found" }, { status: 404 });
    return NextResponse.json(summary);
  } catch (err) {
    console.error("location summary failed", err);
    return NextResponse.json({ error: "could not resolve the session location" }, { status: 500 });
  }
}

// { action: "confirm_new", name, city, county, searchArea?, region?, aliases?, latitude?, longitude? }
// { action: "link_existing", key }
// Both record the session's typed location as a name of that place.
export async function POST(req: NextRequest, { params }: Params) {
  const s = await sessionId(req, params);
  if (s.deny) return s.deny;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const client = createSupabaseAdminClient();
  try {
    const { data: session, error } = await client.from("photography_sessions")
      .select("primary_location").eq("id", s.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
    const text = (session.primary_location as string | null)?.trim() || null;

    if (body.action === "confirm_new") {
      const place = await confirmNewPlace(client, parseNewPlaceInput(body), text);
      return NextResponse.json({ place, summary: await buildLocationSummary(client, s.id) });
    }
    if (body.action === "link_existing") {
      if (!text) return NextResponse.json({ error: "add a session location first" }, { status: 400 });
      const key = typeof body.key === "string" ? body.key : "";
      const place = await linkToExistingPlace(client, key, text);
      return NextResponse.json({ place, summary: await buildLocationSummary(client, s.id) });
    }
    return NextResponse.json({ error: "action must be confirm_new or link_existing" }, { status: 400 });
  } catch (err) {
    if (err instanceof LocationConfirmError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("location confirmation failed", err);
    return NextResponse.json({ error: "could not save the location" }, { status: 500 });
  }
}
