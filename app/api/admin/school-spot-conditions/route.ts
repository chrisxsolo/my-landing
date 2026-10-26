// /api/admin/school-spot-conditions — light tags and crowd notes for school
// location guide spots, edited from Admin → Page Photos.
//   GET ?school=<slug>                              → { conditions: { <spotKey>: { lightTags, crowdNote } } }
//   PUT { school, spotKey, lightTags, crowdNote }   → save one spot (no tags + empty note clears it)
// requireAdmin + service role. Writes refresh the public pages.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { loadSpotConditions, setSpotConditions } from "@/lib/pagePhotos/spotConditionStore";
import { CROWD_NOTE_MAX, normalizeCrowdNote, parseLightTags } from "@/lib/photoConditions";
import { isSchoolSpotKey, spotsForSchool } from "@/lib/schoolSpots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hasGuide = (school: unknown): school is string =>
  typeof school === "string" && spotsForSchool(school).length > 0;

const badRequest = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const school = req.nextUrl.searchParams.get("school");
  if (!hasGuide(school)) return badRequest("school must be a school with a location guide");
  try {
    return NextResponse.json({ conditions: await loadSpotConditions(createSupabaseAdminClient(), school) });
  } catch (err) {
    console.error("[school-spot-conditions] could not load conditions", err);
    return NextResponse.json({ error: "Could not load spot conditions." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return badRequest("invalid JSON body");
  }
  const { school, spotKey } = body ?? {};
  if (!hasGuide(school)) return badRequest("school must be a school with a location guide");
  if (!isSchoolSpotKey(school, spotKey)) return badRequest("spotKey must be one of this school's guide spots");
  const lightTags = parseLightTags(body.lightTags ?? []);
  if (!lightTags) return badRequest("lightTags must list known light conditions", 422);
  const crowdNote = normalizeCrowdNote(body.crowdNote ?? null);
  if (crowdNote === undefined) return badRequest(`crowdNote must be text up to ${CROWD_NOTE_MAX} characters, or empty`, 422);

  const client = createSupabaseAdminClient();
  try {
    await setSpotConditions(client, school, spotKey, { lightTags, crowdNote });
    revalidatePublicContent();
    return NextResponse.json({ conditions: await loadSpotConditions(client, school) });
  } catch (err) {
    console.error("[school-spot-conditions] could not save conditions", err);
    return NextResponse.json({ error: "Could not save the spot conditions." }, { status: 500 });
  }
}
