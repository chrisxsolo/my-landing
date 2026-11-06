// One schedule: PATCH reschedules, DELETE cancels, POST runs an action
// ("publish-now" | "retry"). Every mutation carries the scheduleVersion the
// client saw; a different one answers 409 with the current row.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { publishApprovedItem } from "@/lib/contentEngine/publishItem";
import { publishBlogDraft } from "@/lib/contentPublishing/publishBlogDraft";
import { claimScheduleNow, cancelSchedule, reschedule, retrySchedule, toScheduleDto } from "@/lib/contentPublishing/scheduleService";
import { settleSchedule, type SettleOutcome } from "@/lib/contentPublishing/worker";
import { readJson, scheduleInputFrom, scheduleResultResponse, versionFrom } from "@/lib/contentPublishing/routeHelpers";
import { revalidateOnePath } from "@/lib/contentPublishing/refresh";
import { syncItemSessionInBackground } from "@/lib/locationLibrary/autoSync";
import { syncCampusSpotPhotosInBackground } from "@/lib/campusSpotFill/autoSync";
import type { PublicationScheduleRow } from "@/lib/contentPublishing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

async function parse(req: NextRequest, params: Params["params"]) {
  const { id } = await params;
  if (!isUuid(id)) return { error: NextResponse.json({ error: "schedule id must be a uuid" }, { status: 400 }) };
  const body = await readJson(req);
  if (!body) return { error: NextResponse.json({ error: "invalid JSON body" }, { status: 400 }) };
  const version = versionFrom(body);
  if (version === null) return { error: NextResponse.json({ error: "scheduleVersion is required" }, { status: 400 }) };
  return { id: id.toLowerCase(), body, version };
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const p = await parse(req, params);
  if ("error" in p) return p.error;
  const result = await reschedule({ client: createSupabaseAdminClient(), id: p.id, version: p.version, when: scheduleInputFrom(p.body) });
  return scheduleResultResponse(result);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const p = await parse(req, params);
  if ("error" in p) return p.error;
  return scheduleResultResponse(await cancelSchedule(createSupabaseAdminClient(), p.id, p.version));
}

const revalidate = (path: string) => revalidateOnePath(path);

// Publish now = take the claim (version-guarded, ignores due_at) and run the
// very same publisher the worker runs, then settle the same way.
async function publishNow(row: PublicationScheduleRow) {
  const client = createSupabaseAdminClient();
  const claim = { id: row.id, claimToken: row.claim_token as string, allowEarly: true };
  let outcome: SettleOutcome;
  try {
    if (row.target_kind === "content_item") {
      const r = await publishApprovedItem({ client, itemId: row.content_item_id as string, revalidate, schedule: claim });
      outcome = r.status === "published" ? { kind: "published", refreshFailures: r.revalidationFailures }
        : r.status === "blocked" ? { kind: "blocked", reason: r.reason } : { kind: "failed", error: r.error };
    } else {
      const r = await publishBlogDraft({ client, draftId: row.blog_draft_id as string, revalidate, schedule: claim });
      outcome = r.status === "published" ? { kind: "published", refreshFailures: r.revalidationFailures }
        : r.status === "blocked" ? { kind: "blocked", reason: r.reason } : { kind: "failed", error: r.error };
    }
  } catch (err) {
    outcome = { kind: "failed", error: err instanceof Error ? err.message : "publish failed" };
  }
  // The admin asked for it now: a transient failure must not sit in a retry
  // back-off, so it is shown as blocked for an explicit retry.
  const settled = await settleSchedule(client, row, outcome.kind === "failed" ? { kind: "blocked", reason: outcome.error } : outcome, new Date());
  if (settled === "published" && row.content_item_id) {
    syncItemSessionInBackground(row.content_item_id);
    syncCampusSpotPhotosInBackground();
  }
  const { data } = await client.from("publication_schedules").select("*").eq("id", row.id).maybeSingle();
  const schedule = data ? toScheduleDto(data as PublicationScheduleRow) : null;
  if (outcome.kind === "published") return NextResponse.json({ schedule, revalidationFailures: outcome.refreshFailures });
  const reason = outcome.kind === "blocked" ? outcome.reason : outcome.error;
  return NextResponse.json({ error: reason, schedule }, { status: outcome.kind === "blocked" ? 409 : 422 });
}

export async function POST(req: NextRequest, { params }: Params) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const p = await parse(req, params);
  if ("error" in p) return p.error;
  const client = createSupabaseAdminClient();
  if (p.body.action === "retry") return scheduleResultResponse(await retrySchedule(client, p.id, p.version));
  if (p.body.action !== "publish-now") return NextResponse.json({ error: "action must be publish-now or retry" }, { status: 400 });
  const claimed = await claimScheduleNow(client, p.id, p.version);
  if (claimed.outcome !== "claimed") return scheduleResultResponse(claimed);
  return publishNow(claimed.row);
}
