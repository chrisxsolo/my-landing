// Publication queue: GET lists it (decorated), POST schedules a target.
// Clients send what they chose (local wall time + zone) and the revision they
// reviewed; the server resolves the instant and binds the schedule to that
// revision. Worker-only fields can never be set from here.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { SCHEDULE_STATES, SCHEDULE_TARGET_KINDS, type ScheduleState, type ScheduleTargetKind } from "@/lib/contentPublishing/constants";
import { listScheduleQueue } from "@/lib/contentPublishing/queue";
import { createSchedule } from "@/lib/contentPublishing/scheduleService";
import { readJson, scheduleInputFrom, scheduleResultResponse } from "@/lib/contentPublishing/routeHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const raw = req.nextUrl.searchParams.get("states");
  const states = raw ? raw.split(",").filter((s): s is ScheduleState => (SCHEDULE_STATES as readonly string[]).includes(s)) : undefined;
  try {
    const entries = await listScheduleQueue({ client: createSupabaseAdminClient(), states });
    return NextResponse.json({ entries, serverNow: new Date().toISOString() });
  } catch (err) {
    console.error("[publication-schedules] list failed", err);
    return NextResponse.json({ error: "could not load the publishing queue" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const body = await readJson(req);
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  const target = body.target as { kind?: unknown; id?: unknown } | undefined;
  const kind = target?.kind;
  const id = typeof target?.id === "string" ? target.id.toLowerCase() : "";
  if (!(SCHEDULE_TARGET_KINDS as readonly unknown[]).includes(kind) || !isUuid(id)) {
    return NextResponse.json({ error: "target must be { kind: content_item | blog_draft, id: uuid }" }, { status: 400 });
  }
  const expectedRevision = typeof body.expectedRevision === "number" ? body.expectedRevision : undefined;
  try {
    const result = await createSchedule({
      client: createSupabaseAdminClient(), target: { kind: kind as ScheduleTargetKind, id },
      when: scheduleInputFrom(body), expectedRevision,
    });
    return scheduleResultResponse(result);
  } catch (err) {
    console.error("[publication-schedules] create failed", err);
    return NextResponse.json({ error: "could not schedule" }, { status: 500 });
  }
}
