// GET    one location with its sessions, photo thumbnails, hero and related links.
// PATCH  edit fields (each edit locks the field), publish/unpublish, featured
//        session/photo, place assignment, { unlock: [field] } back to automatic.
// DELETE only when no session was ever linked.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { loadAdminDetail } from "@/lib/locationLibrary/adminView";
import { deleteLocation, updateLocation } from "@/lib/locationLibrary/adminEdit";
import { errorResponse, parseLocationId, readJson } from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // publishing a not-yet-public hero builds its web copy

type Params = { params: Promise<{ id: string }> };

async function guard(req: NextRequest, params: Params["params"]) {
  const deny = requireAdmin(req);
  if (deny) return { deny };
  const id = parseLocationId((await params).id);
  if (!id) return { deny: NextResponse.json({ error: "invalid location id" }, { status: 400 }) };
  return { id };
}

export async function GET(req: NextRequest, { params }: Params) {
  const g = await guard(req, params);
  if (g.deny) return g.deny;
  try {
    const detail = await loadAdminDetail(createSupabaseAdminClient(), g.id);
    if (!detail) return NextResponse.json({ error: "location not found" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) {
    return errorResponse(err, "could not load the location");
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const g = await guard(req, params);
  if (g.deny) return g.deny;
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  try {
    const client = createSupabaseAdminClient();
    await updateLocation(client, g.id, body);
    revalidatePublicContent();
    return NextResponse.json(await loadAdminDetail(client, g.id));
  } catch (err) {
    return errorResponse(err, "could not save the location");
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const g = await guard(req, params);
  if (g.deny) return g.deny;
  try {
    await deleteLocation(createSupabaseAdminClient(), g.id);
    revalidatePublicContent();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err, "could not delete the location");
  }
}
