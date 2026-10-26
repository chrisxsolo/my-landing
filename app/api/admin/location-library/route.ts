// GET  the Locations overview: every library location, every session's sync
//      state, and the verified places (for manual create).
// POST create a location — { placeKey } from a verified place, or
//      { title, city, region } for a custom one. Starts as a review draft.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { loadAdminOverview } from "@/lib/locationLibrary/adminView";
import { createLocation } from "@/lib/locationLibrary/adminEdit";
import { errorResponse, readJson } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    return NextResponse.json(await loadAdminOverview(createSupabaseAdminClient()));
  } catch (err) {
    return errorResponse(err, "could not load the location library");
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  try {
    const id = await createLocation(createSupabaseAdminClient(), body);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    return errorResponse(err, "could not create the location");
  }
}
