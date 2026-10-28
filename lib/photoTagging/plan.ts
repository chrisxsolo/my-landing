// Plans the writes for a bulk (or single-photo) tag edit. Pure.
//
// Preserve by default: a field is written only when the photo has NO
// effective value for it (photo tag, its own confirmed location, caption…).
// With replace=true the requested value overwrites. Fields the request leaves
// out are never touched.
//
// Where each field lives:
//   portfolio photo   → portfolio_images.category_slug / school / location
//                       (school: any registered school — built-in or custom;
//                       the executor refuses a slug the registry does not know)
//   engine-only photo → location: THAT photo's session_photos.photo_location
//                       (a session can cover several places, so one photo's
//                       location never moves another photo)
//                       school: its session's school_slug — a graduate attends
//                       one school, so it is a session fact (scope "session")
//                       category: the session's service type, changed in
//                       Session facts, not here
//   campus spot       → school_spot_photos, keyed by the PUBLIC url, so only
//                       public photos of a school with a spot guide carry one
//
// Every "updated" outcome names the write that carries it (writeId), so the
// executor can report exactly which photo fields failed. Photos of one
// session asking for different session-level values are a conflict: nothing
// is written for them.
//
// A stored location a person stands behind — set by the photographer, matched
// from the photo's own GPS, or accepted from any evidence but the session's
// facts — is never overwritten by an automated plan (apply-high, a sync),
// Replace or not. Only a person, through an explicit edit with Replace on, can
// change it. A location inherited from the session's facts (evidence
// "session") is the one value an automated step may update or clear, so the
// session-location sync can follow the facts (lib/photoTagging/inheritLocation).
import { isSchoolSlug } from "@/lib/contentEngine/taxonomy";
import { isSchoolSpotKey } from "@/lib/schoolSpots";
import type { LocationEvidence, PhotoSource, TagChanges, TagField } from "@/lib/photoTagging/types";

export type LocationSource = "manual" | "gps";

export interface PlanTarget {
  key: string;
  source: PhotoSource;
  portfolioId: number | null;
  /** The Content Engine photo an engine-only target writes its location to. */
  enginePhotoId: string | null;
  sessionId: string | null;
  url: string | null;
  /** Current effective values (any source). */
  category: string | null;
  school: string | null;
  location: string | null;
  spot: string | null;
  /** What the column a write would change holds now, when it differs from the effective value. */
  stored?: Partial<Record<TagField, string | null>>;
  /** Who set the stored location (session_photos.photo_location_source). */
  storedLocationSource?: LocationSource | null;
  /** What the stored location rests on; only "session" may be changed by an automated step. */
  storedLocationEvidence?: LocationEvidence | null;
}

export interface PortfolioPatch { category?: string; school?: string | null; location?: string | null }
export interface SessionPatch { school_slug?: string | null }
export interface PhotoPatch { location: string | null; source: LocationSource; evidence: LocationEvidence | null }

export type TagWrite =
  | { kind: "portfolio"; portfolioId: number; patch: PortfolioPatch }
  | { kind: "session"; sessionId: string; patch: SessionPatch }
  | { kind: "photo"; enginePhotoId: string; sessionId: string | null; patch: PhotoPatch }
  /** dependsOn: the write that gives the photo the school this spot belongs to. */
  | { kind: "spot"; school: string; url: string; spotKey: string | null; dependsOn?: string };

export type OutcomeResult = "updated" | "kept" | "skipped" | "conflict" | "failed";

export interface TagOutcome {
  key: string;
  field: TagField;
  result: OutcomeResult;
  reason: string | null;
  /** "session" = the value lives on the Content Engine session (all its photos). */
  scope: "photo" | "session";
  /** The write that carries an "updated" outcome. */
  writeId: string | null;
  /** The value written (or to be written). */
  value: string | null;
  /** What that column held before — writing it back with Replace undoes the change. */
  previous: string | null;
}

export interface TagPlan { writes: TagWrite[]; outcomes: TagOutcome[] }

export const writeIdOf = (w: TagWrite): string => {
  if (w.kind === "portfolio") return `portfolio:${w.portfolioId}`;
  if (w.kind === "session") return `session:${w.sessionId}`;
  if (w.kind === "photo") return `photo:${w.enginePhotoId}`;
  return `spot:${w.school}:${w.url}`;
};

interface TargetPlan {
  portfolio: PortfolioPatch;
  session: SessionPatch;
  photo: PhotoPatch | null;
  spot: { school: string; spotKey: string | null; dependsOn?: string } | null;
  outcomes: TagOutcome[];
}

interface Ctx {
  t: PlanTarget;
  replace: boolean;
  locationSource: LocationSource;
  evidence: LocationEvidence;
  /** No person chose these values (apply-high, a sync): a photographer-set location is off limits. */
  automated: boolean;
  plan: TargetPlan;
}

const KEPT = "already set — turn on Replace to overwrite";
const MANUAL_WINS = "set by the photographer — an automated step never overwrites it";
const GPS_WINS = "matched from the photo's own GPS — an automated step never overwrites it";
const blank = (v: string | null | undefined) => v === null || v === undefined || v.trim() === "";
const clean = (v: string | null) => (v === null ? null : v.trim().slice(0, 200) || null);

/** Whether to write: an empty field always; a filled one only in replace mode; clearing only in replace mode. */
function decide(current: string | null, next: string | null, replace: boolean): "write" | "kept" | "same" {
  if (next === null) return replace && !blank(current) ? "write" : "same";
  if (!blank(current) && current?.toLowerCase() === next.toLowerCase()) return "same";
  return blank(current) || replace ? "write" : "kept";
}

export function outcome(key: string, field: TagField, result: OutcomeResult, extra: Partial<TagOutcome> = {}): TagOutcome {
  return { key, field, result, reason: null, scope: "photo", writeId: null, value: null, previous: null, ...extra };
}

function note(ctx: Ctx, field: TagField, result: OutcomeResult, extra: Partial<TagOutcome> = {}): void {
  ctx.plan.outcomes.push(outcome(ctx.t.key, field, result, extra));
}

const previousOf = (t: PlanTarget, field: TagField): string | null =>
  t.stored && field in t.stored ? t.stored[field] ?? null : t[field];

function updated(ctx: Ctx, field: TagField, value: string | null, writeId: string, scope: TagOutcome["scope"] = "photo") {
  note(ctx, field, "updated", { value, writeId, scope, previous: previousOf(ctx.t, field),
    reason: scope === "session" ? "set on the session — every photo of it" : null });
}

const notWritten = (ctx: Ctx, field: TagField, d: "kept" | "same") =>
  note(ctx, field, "kept", { reason: d === "kept" ? KEPT : "unchanged" });

function planCategory(ctx: Ctx, next: string): string | null {
  const { t } = ctx;
  if (t.source === "engine" || t.portfolioId === null) {
    note(ctx, "category", "skipped", { reason: "set the session's service type in Session facts" });
    return t.category;
  }
  const d = decide(t.category, next, ctx.replace);
  if (d !== "write") { notWritten(ctx, "category", d); return t.category; }
  ctx.plan.portfolio.category = next;
  updated(ctx, "category", next, `portfolio:${t.portfolioId}`);
  return next;
}

/** Returns the school the photo has after this edit, and the write that sets it (if any). */
function planSchool(ctx: Ctx, raw: string | null, category: string | null): { school: string | null; writeId?: string } {
  const { t } = ctx;
  const next = clean(raw);
  const d = decide(t.school, next, ctx.replace);
  const skip = (reason: string) => { note(ctx, "school", "skipped", { reason }); return { school: t.school }; };
  if (category !== "grads") return skip("only graduation photos take a university");
  if (d !== "write") { notWritten(ctx, "school", d); return { school: t.school }; }
  if (t.source === "portfolio" && t.portfolioId !== null) {
    ctx.plan.portfolio.school = next;
    updated(ctx, "school", next, `portfolio:${t.portfolioId}`);
    return { school: next, writeId: `portfolio:${t.portfolioId}` };
  }
  if (!t.sessionId) return skip("this photo has no Content Engine session");
  ctx.plan.session.school_slug = next;
  updated(ctx, "school", next, `session:${t.sessionId}`, "session");
  return { school: next, writeId: `session:${t.sessionId}` };
}

function planLocation(ctx: Ctx, raw: string | null): void {
  const { t } = ctx;
  const next = clean(raw);
  const d = decide(t.location, next, ctx.replace);
  if (d !== "write") return notWritten(ctx, "location", d);
  if (ctx.automated && !blank(t.location) && t.storedLocationEvidence !== "session") {
    return note(ctx, "location", "kept", { reason: t.storedLocationSource === "gps" ? GPS_WINS : MANUAL_WINS });
  }
  if (t.source === "portfolio" && t.portfolioId !== null) {
    ctx.plan.portfolio.location = next;
    return updated(ctx, "location", next, `portfolio:${t.portfolioId}`);
  }
  if (!t.enginePhotoId) return note(ctx, "location", "skipped", { reason: "this photo has no Content Engine record" });
  ctx.plan.photo = { location: next, source: ctx.locationSource, evidence: next === null ? null : ctx.evidence };
  updated(ctx, "location", next, `photo:${t.enginePhotoId}`);
}

function planSpot(ctx: Ctx, spotKey: string | null, school: { school: string | null; writeId?: string }): void {
  const { t } = ctx;
  const skip = (reason: string) => note(ctx, "spot", "skipped", { reason });
  if (!t.url) return skip("spot tags apply once the photo is public");
  const slug = school.school;
  if (!slug || !isSchoolSlug(slug)) return skip("needs a university with a campus-spot guide");
  if (spotKey !== null && !isSchoolSpotKey(slug, spotKey)) return skip(`not one of ${slug}'s campus spots`);
  const d = decide(t.spot, spotKey, ctx.replace);
  if (d !== "write") return notWritten(ctx, "spot", d);
  ctx.plan.spot = { school: slug, spotKey, ...(school.writeId ? { dependsOn: school.writeId } : {}) };
  updated(ctx, "spot", spotKey, `spot:${slug}:${t.url}`);
}

function planTarget(item: PlanItem, replace: boolean, automated: boolean): TargetPlan {
  const { target: t, changes } = item;
  const ctx: Ctx = {
    t, replace, automated, locationSource: item.locationSource ?? "manual",
    evidence: changes.evidence ?? item.locationEvidence ?? "manual",
    plan: { portfolio: {}, session: {}, photo: null, spot: null, outcomes: [] },
  };
  const category = changes.category !== undefined ? planCategory(ctx, changes.category) : t.category;
  const school = changes.school !== undefined ? planSchool(ctx, changes.school, category) : { school: t.school };
  if (changes.location !== undefined) planLocation(ctx, changes.location);
  if (changes.spot !== undefined) planSpot(ctx, changes.spot, school);
  return ctx.plan;
}

type Planned = { t: PlanTarget; plan: TargetPlan };

/** Session ids whose photos ask for more than one value for the session's university. */
function conflictingSessions(planned: readonly Planned[]): Map<string, string[]> {
  const values = new Map<string, Set<string>>();
  for (const { t, plan } of planned) {
    if (!t.sessionId || plan.session.school_slug === undefined) continue;
    const set = values.get(t.sessionId) ?? new Set<string>();
    set.add(plan.session.school_slug ?? "(none)");
    values.set(t.sessionId, set);
  }
  return new Map([...values].filter(([, v]) => v.size > 1).map(([id, v]) => [id, [...v]]));
}

/** "updated" outcomes whose write is held back become conflicts (a spot follows its blocked university). */
function holdBlocked(planned: readonly Planned[], blocked: ReadonlyMap<string, string>): TagOutcome[] {
  const spotDeps = new Map(planned.map(({ t, plan }) => [t.key, plan.spot?.dependsOn]));
  return planned.flatMap(({ plan }) => plan.outcomes).map((o): TagOutcome => {
    if (o.result !== "updated" || !o.writeId) return o;
    const dep = o.field === "spot" ? spotDeps.get(o.key) : undefined;
    const reason = blocked.get(o.writeId) ?? (dep && blocked.has(dep) ? "its university is in conflict — choose one first" : undefined);
    return reason ? { ...o, result: "conflict", writeId: null, reason } : o;
  });
}

/** Writes for every target, with session patches merged (one write per session) and conflicts held back. */
function assemble(planned: readonly Planned[]): TagPlan {
  const conflicts = conflictingSessions(planned);
  const blocked = new Map([...conflicts].map(([id, v]) => [`session:${id}`,
    `photos of this session ask for different universities (${v.join(", ")}) — choose one`]));
  const writes: TagWrite[] = [];
  const sessions = new Map<string, SessionPatch>();
  for (const { t, plan } of planned) {
    if (Object.keys(plan.portfolio).length > 0 && t.portfolioId !== null) {
      writes.push({ kind: "portfolio", portfolioId: t.portfolioId, patch: plan.portfolio });
    }
    if (plan.photo && t.enginePhotoId) writes.push({ kind: "photo", enginePhotoId: t.enginePhotoId, sessionId: t.sessionId, patch: plan.photo });
    if (Object.keys(plan.session).length > 0 && t.sessionId && !conflicts.has(t.sessionId)) {
      sessions.set(t.sessionId, { ...sessions.get(t.sessionId), ...plan.session });
    }
  }
  for (const [sessionId, patch] of sessions) writes.push({ kind: "session", sessionId, patch });
  for (const { t, plan } of planned) {
    const dependsOn = plan.spot?.dependsOn;
    if (!plan.spot || !t.url || (dependsOn && blocked.has(dependsOn))) continue;
    writes.push({ kind: "spot", school: plan.spot.school, url: t.url, spotKey: plan.spot.spotKey, ...(dependsOn ? { dependsOn } : {}) });
  }
  return { writes, outcomes: holdBlocked(planned, blocked) };
}

export interface PlanItem {
  target: PlanTarget;
  changes: TagChanges;
  locationSource?: LocationSource;
  /** What a location being set rests on; changes.evidence wins when given. */
  locationEvidence?: LocationEvidence;
}

export interface PlanOptions {
  /** True when no person chose the values (apply-high, a sync). */
  automated?: boolean;
}

/** One plan for several photos, each with its own requested changes. */
export function planItems(items: readonly PlanItem[], replace: boolean, opts: PlanOptions = {}): TagPlan {
  return assemble(items.map((i) => ({ t: i.target, plan: planTarget(i, replace, opts.automated === true) })));
}

/** One plan applying the same changes to many photos. */
export function planTagChanges(
  targets: readonly PlanTarget[], changes: TagChanges, replace: boolean,
  locationSource: LocationSource = "manual", opts: PlanOptions = {},
): TagPlan {
  return planItems(targets.map((target) => ({ target, changes, locationSource })), replace, opts);
}
