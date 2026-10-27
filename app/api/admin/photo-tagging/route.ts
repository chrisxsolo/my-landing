// /api/admin/photo-tagging — photo tagging audit for Portfolio + Content Engine.
//   GET  ?session=<uuid>           → audited photos (+ counts, options); one session's photos when given
//   GET  ?thumbs=1                 → signed thumbnails for private Content Engine photos
//   POST { action: "preview", keys, changes, replace }  → dry run: per-field outcomes + how many OTHER
//        { action: "preview", keys?, high: true, photoOnly? }   photos a session-wide write changes
//   POST { action: "apply", keys, changes, replace }   → tag photos (fill empty fields unless replace)
//   POST { action: "apply-high", keys?, photoOnly? }   → apply every non-conflicting high-confidence suggestion
//   POST { action: "mark-na", keys, field, on }        → mark location/spot not applicable
//   POST { action: "dismiss", key, suggestionId }      → never offer a suggestion again
//   POST { action: "ai-suggest", keys, force? }        → AI vision for ≤4 photos that need it
//   GET  ?history=1&key=<photo key>&limit=              → photo_change_log, newest first (one photo's when key given)
//   POST { action: "restore", logId }                  → put a logged field back to its old value (a new "manual" entry)
// requireAdmin + service role. Tag writes refresh the public pages and run the
// existing campus-spot and location-library syncs, exactly like other edits.
// Every write is recorded in photo_change_log: "manual" for an admin edit
// (accepting a suggestion counts), "system" for apply-high.
// Writes are refused (409) when the audit read was incomplete: a plan built on
// a partial library could report fields as empty that are not.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { revalidatePublicContent } from "@/lib/publicRevalidation";
import { syncCampusSpotPhotosInBackground } from "@/lib/campusSpotFill/autoSync";
import { syncSessionInBackground } from "@/lib/locationLibrary/autoSync";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { isRestorable, type ChangeActor } from "@/lib/photoChangeLog/entries";
import { loadChangeLog, loadChangeLogRow } from "@/lib/photoChangeLog/log";
import { executePlan, planForEntries, type ApplyResult, type ExecuteOptions } from "@/lib/photoTagging/apply";
import { planHighConfidence } from "@/lib/photoTagging/highConfidence";
import type { LibraryEntry } from "@/lib/photoTagging/assemble";
import type { TagPlan } from "@/lib/photoTagging/plan";
import { previewPlan } from "@/lib/photoTagging/preview";
import { needsVision, runVision, VISION_BATCH_MAX } from "@/lib/photoTagging/aiSuggest";
import { loadAudit, signPrivateThumbs, toReport, type LoadedAudit } from "@/lib/photoTagging/library";
import { dismissSuggestion, loadReviews, setNotApplicable } from "@/lib/photoTagging/reviews";
import {
  isLocationEvidence, isPhotoKey, NOT_APPLICABLE_FIELDS, type NotApplicableField, type TagChanges,
} from "@/lib/photoTagging/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_KEYS = 500;
const REASON_MAX = 200;
const HISTORY_LIMIT_MAX = 200;
type Body = Record<string, unknown>;

/** The optional free-text reason an admin action carries into the history ("undo"). */
const reasonOf = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, REASON_MAX) : null);

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

function fail(err: unknown, what: string) {
  console.error(`[photo-tagging] ${what}`, err);
  return bad(err instanceof Error ? err.message : what, 500);
}

function keysOf(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_KEYS) return null;
  return value.every(isPhotoKey) ? [...new Set(value)] : null;
}

const optionalText = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.length <= 200);

function changesOf(value: unknown): TagChanges | null {
  if (!value || typeof value !== "object") return null;
  const c = value as Record<string, unknown>;
  if (c.category !== undefined && (typeof c.category !== "string" || !/^[a-z-]{2,40}$/.test(c.category))) return null;
  if (![c.school, c.location, c.spot].every(optionalText)) return null;
  if (c.evidence !== undefined && !isLocationEvidence(c.evidence)) return null;
  const changes: TagChanges = {};
  if (typeof c.category === "string") changes.category = c.category;
  for (const field of ["school", "location", "spot"] as const) {
    if (c[field] !== undefined) changes[field] = c[field] as string | null;
  }
  if (Object.keys(changes).length === 0) return null;
  return isLocationEvidence(c.evidence) ? { ...changes, evidence: c.evidence } : changes;
}

function afterWrite(result: ApplyResult): void {
  if (result.updated === 0) return;
  revalidatePublicContent();
  syncCampusSpotPhotosInBackground();
  for (const id of new Set(result.sessionIds)) syncSessionInBackground(id);
}

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  const session = req.nextUrl.searchParams.get("session");
  if (session && !isUuid(session)) return bad("session must be a uuid");
  const client = createSupabaseAdminClient();
  try {
    if (req.nextUrl.searchParams.get("history") === "1") return history(client, req.nextUrl.searchParams);
    const audit = await loadAudit(client, session?.toLowerCase());
    if (req.nextUrl.searchParams.get("thumbs") === "1") {
      return NextResponse.json({ thumbs: await signPrivateThumbs(client, audit.entries) });
    }
    return NextResponse.json(toReport(audit));
  } catch (err) {
    return fail(err, "could not load the tagging audit");
  }
}

async function history(client: ReturnType<typeof createSupabaseAdminClient>, params: URLSearchParams) {
  const key = params.get("key");
  if (key && !isPhotoKey(key) && !/^session:[0-9a-f-]{36}$/.test(key)) return bad("key must be a photo or session key");
  const limit = Math.min(Number(params.get("limit")) || 50, HISTORY_LIMIT_MAX);
  return NextResponse.json({ changes: await loadChangeLog(client, { key: key ?? undefined, limit }) });
}

/** The audit, or a 409 when any read failed — never plan writes on a partial library. */
async function completeAudit(client: ReturnType<typeof createSupabaseAdminClient>): Promise<LoadedAudit | NextResponse> {
  const audit = await loadAudit(client);
  if (audit.errors.length === 0) return audit;
  return bad(`Tagging is paused: the photo library could not be fully read (${audit.errors.join("; ")}). Nothing was changed — reload and try again.`, 409);
}

type Planned = { plan: TagPlan; keys: string[] } | NextResponse;

function planExplicit(body: Body, audit: LoadedAudit): Planned {
  const keys = keysOf(body.keys);
  const changes = changesOf(body.changes);
  if (!keys) return bad(`keys must be 1–${MAX_KEYS} photo keys`);
  if (!changes) return bad("changes must set at least one of category, school, location, spot");
  const chosen = audit.entries.filter((e) => keys.includes(e.photo.key));
  if (chosen.length === 0) return bad("none of those photos exist", 404);
  return { plan: planForEntries(chosen, changes, body.replace === true), keys };
}

function planHigh(body: Body, audit: LoadedAudit): Planned {
  const keys = body.keys === undefined ? null : keysOf(body.keys);
  if (body.keys !== undefined && !keys) return bad(`keys must be 1–${MAX_KEYS} photo keys`);
  const chosen = audit.entries.filter((e: LibraryEntry) => (!keys || keys.includes(e.photo.key))
    && e.photo.suggestions.some((s) => s.confidence === "high"));
  return { plan: planHighConfidence(chosen, { photoOnly: body.photoOnly === true }), keys: chosen.map((e) => e.photo.key) };
}

async function write(body: Body, planner: (body: Body, audit: LoadedAudit) => Planned, log: ExecuteOptions) {
  const client = createSupabaseAdminClient();
  const audit = await completeAudit(client);
  if (audit instanceof NextResponse) return audit;
  const planned = planner(body, audit);
  if (planned instanceof NextResponse) return planned;
  const result = await executePlan(client, planned.plan, log);
  afterWrite(result);
  return NextResponse.json(result);
}

const MANUAL: ChangeActor = "manual";
const apply = (body: Body) => write(body, planExplicit, { actor: MANUAL, reason: reasonOf(body.reason) });
const applyHigh = (body: Body) => write(body, planHigh, { actor: "system", reason: "apply-high: high-confidence records" });

/** Puts one logged field back to its old value — through the same plan, as a new "manual" history entry. */
function planRestore(row: { key: string; field: string; oldValue: unknown }) {
  return (_body: Body, audit: LoadedAudit): Planned => {
    const entry = row.key.startsWith("session:")
      ? audit.entries.find((e) => e.photo.sessionId === row.key.slice("session:".length))
      : audit.entries.find((e) => e.photo.key === row.key);
    if (!entry) return bad("that photo is no longer in the library", 404);
    const changes = { [row.field]: row.oldValue } as TagChanges;
    return { plan: planForEntries([entry], changes, true), keys: [entry.photo.key] };
  };
}

async function restore(body: Body) {
  const logId = Number(body.logId);
  if (!Number.isInteger(logId) || logId <= 0) return bad("logId must be a positive integer");
  const row = await loadChangeLogRow(createSupabaseAdminClient(), logId);
  if (!row) return bad("no such change", 404);
  if (!isRestorable(row)) return bad(`a ${row.field} change cannot be restored from here`, 422);
  return write(body, planRestore(row), { actor: MANUAL, reason: `restore #${logId}` });
}

async function preview(body: Body) {
  const audit = await completeAudit(createSupabaseAdminClient());
  if (audit instanceof NextResponse) return audit;
  const planned = body.high === true ? planHigh(body, audit) : planExplicit(body, audit);
  if (planned instanceof NextResponse) return planned;
  return NextResponse.json(previewPlan(planned.plan, audit.entries, planned.keys));
}

async function markNotApplicable(body: Body) {
  const keys = keysOf(body.keys);
  if (!keys) return bad(`keys must be 1–${MAX_KEYS} photo keys`);
  if (!(NOT_APPLICABLE_FIELDS as readonly unknown[]).includes(body.field)) return bad("field must be location or spot");
  await setNotApplicable(createSupabaseAdminClient(), keys, body.field as NotApplicableField, body.on !== false);
  return NextResponse.json({ updated: keys.length });
}

async function dismiss(body: Body) {
  if (!isPhotoKey(body.key)) return bad("key must be a photo key");
  // placement:<kind>:<ref> = "keep this excluded photo live here" (the review queue's Reject).
  if (typeof body.suggestionId !== "string" || !/^(category|school|location|spot|placement):.{1,190}$/.test(body.suggestionId)) {
    return bad("suggestionId must be a suggestion id");
  }
  await dismissSuggestion(createSupabaseAdminClient(), body.key, body.suggestionId);
  return NextResponse.json({ dismissed: true });
}

async function aiSuggest(body: Body) {
  const keys = keysOf(body.keys);
  if (!keys) return bad(`keys must be 1–${MAX_KEYS} photo keys`);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return bad("AI is not configured (ANTHROPIC_API_KEY missing)", 503);
  const client = createSupabaseAdminClient();
  const [audit, reviews] = await Promise.all([loadAudit(client), loadReviews(client, keys)]);
  const eligible = audit.entries.filter((e) => keys.includes(e.photo.key)
    && needsVision(e, reviews.get(e.photo.key)?.aiInputHash ?? null, body.force === true));
  const batch = eligible.slice(0, VISION_BATCH_MAX);
  const caller = createAnthropicCaller(apiKey);
  const results = await Promise.all(batch.map((e) => runVision(client, caller, e, audit.places)));
  return NextResponse.json({
    analyzed: results.filter((r) => !r.error).map((r) => r.key),
    failed: results.filter((r) => r.error).map((r) => ({ key: r.key, error: r.error })),
    suggestions: results.reduce((n, r) => n + r.suggestions, 0),
    remaining: eligible.length - batch.length,
    skipped: keys.length - eligible.length,
  });
}

const ACTIONS: Record<string, (body: Body) => Promise<NextResponse>> = {
  preview, apply, "apply-high": applyHigh, "mark-na": markNotApplicable, dismiss, "ai-suggest": aiSuggest, restore,
};

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  let body: Body;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object") return bad("invalid JSON body");
    body = parsed as Body;
  } catch {
    return bad("invalid JSON body");
  }
  const handler = typeof body.action === "string" ? ACTIONS[body.action] : undefined;
  if (!handler) return bad("unknown action");
  try {
    return await handler(body);
  } catch (err) {
    return fail(err, `${String(body.action)} failed`);
  }
}
