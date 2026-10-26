// /api/admin/school-spot-notes — "Where to find it" lines for school location
// guide spots, edited from Admin → Page Photos.
//   GET ?school=<slug>                  → { notes: { <spotKey>: note } }
//   PUT { school, spotKey, note }       → save one note (null or "" clears it)
// requireAdmin + service role. Writes refresh the public pages.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { loadSpotNotes, setSpotNote } from "@/lib/pagePhotos/spotNoteStore";
import { isSchoolSpotKey, normalizeSpotNote, spotsForSchool, SPOT_NOTE_MAX } from "@/lib/schoolSpots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const hasGuide = (school: unknown): school is string =>
  typeof school === "string" && spotsForSchool(school).length > 0;

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const school = req.nextUrl.searchParams.get("school");
  if (!hasGuide(school)) return NextResponse.json({ error: "school must be a school with a location guide" }, { status: 400 });
  try {
    return NextResponse.json({ notes: await loadSpotNotes(createSupabaseAdminClient(), school) });
  } catch (err) {
    console.error("[school-spot-notes] could not load notes", err);
    return NextResponse.json({ error: "Could not load spot notes." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const { school, spotKey } = body ?? {};
  if (!hasGuide(school)) return NextResponse.json({ error: "school must be a school with a location guide" }, { status: 400 });
  if (!isSchoolSpotKey(school, spotKey)) {
    return NextResponse.json({ error: "spotKey must be one of this school's guide spots" }, { status: 400 });
  }
  const note = normalizeSpotNote(body.note);
  if (note === undefined) {
    return NextResponse.json({ error: `note must be text up to ${SPOT_NOTE_MAX} characters, or empty to clear` }, { status: 422 });
  }

  const client = createSupabaseAdminClient();
  try {
    await setSpotNote(client, school, spotKey, note);
    revalidatePublicContent();
    return NextResponse.json({ notes: await loadSpotNotes(client, school) });
  } catch (err) {
    console.error("[school-spot-notes] could not save note", err);
    return NextResponse.json({ error: "Could not save the spot note." }, { status: 500 });
  }
}
