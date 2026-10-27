// Schools for Session facts: GET lists built-in + custom schools; POST adds a
// custom school (admin only). A duplicate returns 409 with the existing school
// so the picker can offer to select it instead; a look-alike returns the same
// 409 with match "similar" until the body carries confirmSimilar: true.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createCustomSchool, listSchools } from "@/lib/contentEngine/schoolStore";
import { schoolLabel, validateNewSchool } from "@/lib/contentEngine/schools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  try {
    return NextResponse.json({ schools: await listSchools(createSupabaseAdminClient()) });
  } catch (err) {
    console.error("school list failed", err);
    return NextResponse.json({ error: "could not load schools" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }

  const input = validateNewSchool(body as Record<string, unknown>);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 422 });
  const allowSimilar = (body as Record<string, unknown>).confirmSimilar === true;

  try {
    const result = await createCustomSchool(createSupabaseAdminClient(), input.value, { allowSimilar });
    if (!result.created) {
      const label = schoolLabel(result.existing);
      return NextResponse.json({
        error: result.match === "duplicate" ? `${label} is already saved` : `this looks like ${label}, which is already saved`,
        existing: result.existing,
        match: result.match,
      }, { status: 409 });
    }
    return NextResponse.json({ school: result.school }, { status: 201 });
  } catch (err) {
    console.error("school create failed", err);
    return NextResponse.json({ error: "could not save school" }, { status: 500 });
  }
}
