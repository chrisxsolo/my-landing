// Per-type generation targets (spec §8.2): each gathers its inputs, calls the
// model (or resolves deterministically), and materializes Zod-validated draft
// item specs. Every destination/photo reference is identity-checked against
// this session's own analyzed photos.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ModelCaller, ModelUsage } from "@/lib/contentEngine/aiClient";
import { extractJsonObject } from "@/lib/contentEngine/analysisResponse";
import {
  buildJournalPrompt, buildPortfolioPickPrompt, buildSchoolPagePhotoPrompt,
  buildGuidePhotoPrompt, buildInternalLinkPrompt,
  type BuiltPrompt, type PhotoSummary,
} from "@/lib/contentEngine/prompts";
import { validatePayload, type SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { generateMetaKeywords } from "@/lib/contentEngine/serviceKeywords";
import { guideTypeForService, isSchoolSlug } from "@/lib/contentEngine/taxonomy";
import { downloadOriginal, encodeBatchUnderCap, toImageBlock } from "@/lib/contentEngine/modelImages";

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

export interface ItemSpec {
  content_type: string;
  payload: Record<string, unknown>;
  destination: string | null;
  photoId: string | null;
}

export interface TargetUsage extends ModelUsage {
  model: string;
}

export interface TargetResult {
  outcome: "completed" | "skipped";
  itemSpecs: ItemSpec[];
  usage: TargetUsage | null;
  note?: string;
}

export interface TargetContext {
  client: SupabaseClient;
  callModel: ModelCaller;
  model: string;
  sessionId: string;
  packageId: string;
  facts: SessionFactsSnapshot;
}

// Deterministic meta keywords from the approved taxonomy/facts — never
// AI-invented (spec §9.3). Service-aware routing lives in serviceKeywords;
// grads output is unchanged.
export function deterministicKeywords(facts: SessionFactsSnapshot): string {
  return generateMetaKeywords(facts);
}

// First ~200 chars of a testimonial, cut at a word boundary.
export function excerptOf(message: string, max = 200): string {
  const trimmed = message.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

async function loadPhotoSummaries(client: SupabaseClient, sessionId: string): Promise<PhotoSummary[]> {
  const { data, error } = await client
    .from("session_photos")
    .select("id,alt_text,title,description,tags,quality_score,suggested_category,storage_path")
    .eq("photography_session_id", sessionId)
    .eq("excluded", false)
    .eq("analysis_status", "completed")
    .order("quality_score", { ascending: false, nullsFirst: false });
  if (error) throw new GenerationError(`could not load analyzed photos: ${error.message}`);
  return (data ?? []).map((r) => ({
    session_photo_id: r.id as string,
    alt_text: r.alt_text, title: r.title, description: r.description,
    tags: (r.tags ?? []) as string[], quality_score: r.quality_score,
    suggested_category: r.suggested_category,
  }));
}

async function callForJson(
  ctx: TargetContext, prompt: BuiltPrompt,
  imageBlocks: ReturnType<typeof toImageBlock>[] = [],
): Promise<{ json: unknown; usage: TargetUsage }> {
  const response = await ctx.callModel({
    model: ctx.model,
    system: prompt.system,
    maxTokens: 4000,
    messages: [{
      role: "user",
      content: imageBlocks.length
        ? [...imageBlocks, { type: "text", text: prompt.userText }]
        : prompt.userText,
    }],
  });
  return {
    json: extractJsonObject(response.text),
    usage: { model: response.model, ...response.usage },
  };
}

function validated(contentType: string, payload: unknown): Record<string, unknown> {
  const result = validatePayload(contentType, payload);
  if (!result.success) {
    throw new GenerationError(
      `validation failed for ${contentType} (canonical lists are closed): ${result.error.message}`,
    );
  }
  return result.data as Record<string, unknown>;
}

function assertKnownPhotos(ids: string[], known: Set<string>) {
  for (const id of ids) {
    if (!known.has(id)) throw new GenerationError(`unknown photo id from model: ${id}`);
  }
}

const linksResponseSchema = z.object({ links: z.array(z.unknown()) });
const picksResponseSchema = z.object({ picks: z.array(z.unknown()) });
const placementsResponseSchema = z.object({ placements: z.array(z.unknown()) });
const journalResponseSchema = z.object({
  title: z.string(), slug: z.string(), body: z.string(), meta_description: z.string(),
  photo_ids: z.array(z.string()), cover_photo_id: z.string(),
});

async function internalLinkTarget(ctx: TargetContext): Promise<TargetResult> {
  const { json, usage } = await callForJson(ctx, buildInternalLinkPrompt(ctx.facts));
  const parsed = linksResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed links response: ${parsed.error.message}`);
  const payload = validated("internal_link_suggestion", { links: parsed.data.links });
  return { outcome: "completed", itemSpecs: [{
    content_type: "internal_link_suggestion", payload, destination: null, photoId: null,
  }], usage };
}

async function testimonialTarget(ctx: TargetContext): Promise<TargetResult> {
  const { data: session } = await ctx.client.from("photography_sessions")
    .select("client_session_id").eq("id", ctx.sessionId).single();
  if (!session?.client_session_id) {
    return { outcome: "skipped", itemSpecs: [], usage: null, note: "no linked client session" };
  }
  const { data: cs } = await ctx.client.from("client_sessions")
    .select("client_email").eq("id", session.client_session_id).single();
  if (!cs?.client_email) {
    return { outcome: "skipped", itemSpecs: [], usage: null, note: "no client email" };
  }
  const { data: t } = await ctx.client.from("testimonials")
    .select("id,message").eq("email", cs.client_email).eq("status", "approved")
    .is("photography_session_id", null)
    .order("submitted_at", { ascending: false }).limit(1).maybeSingle();
  if (!t) return { outcome: "skipped", itemSpecs: [], usage: null, note: "no matching testimonial" };

  const payload = validated("testimonial_feature", {
    testimonial_id: t.id, quote_excerpt: excerptOf(t.message as string),
  });
  return { outcome: "completed", itemSpecs: [{
    content_type: "testimonial_feature", payload, destination: null, photoId: null,
  }], usage: null };
}

async function journalTarget(ctx: TargetContext): Promise<TargetResult> {
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));

  // dependency inputs (spec §8.2 graph): links + testimonial from this package
  const { data: siblings } = await ctx.client.from("session_content_items")
    .select("content_type,payload")
    .eq("package_id", ctx.packageId)
    .in("content_type", ["internal_link_suggestion", "testimonial_feature"])
    .neq("status", "rejected");
  const linkItem = siblings?.find((s) => s.content_type === "internal_link_suggestion");
  const testimonialItem = siblings?.find((s) => s.content_type === "testimonial_feature");
  const links = ((linkItem?.payload?.links ?? []) as { url: string; label: string }[])
    .map((l) => ({ url: l.url, label: l.label }));
  const testimonialQuote = (testimonialItem?.payload?.quote_excerpt as string | undefined) || null;
  const testimonialId = (testimonialItem?.payload?.testimonial_id as string | undefined) ?? null;

  // journal-only: top photos inline as downscaled images (spec §8.3)
  const top = photos.slice(0, 4);
  const { data: paths } = await ctx.client.from("session_photos")
    .select("id,storage_path").in("id", top.map((p) => p.session_photo_id));
  const originals = await Promise.all(
    (paths ?? []).map((p) => downloadOriginal(ctx.client, p.storage_path as string)),
  );
  const imageBlocks = (await encodeBatchUnderCap(originals)).map(toImageBlock);

  const { json, usage } = await callForJson(
    ctx, buildJournalPrompt(ctx.facts, photos, { links, testimonialQuote }), imageBlocks,
  );
  const parsed = journalResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed journal response: ${parsed.error.message}`);
  assertKnownPhotos([...parsed.data.photo_ids, parsed.data.cover_photo_id], known);

  const payload = validated("journal_post", {
    ...parsed.data,
    meta_keywords: deterministicKeywords(ctx.facts),
    internal_links: links,
    testimonial_id: testimonialId,
  });
  return { outcome: "completed", itemSpecs: [{
    content_type: "journal_post", payload, destination: null, photoId: null,
  }], usage };
}

async function portfolioTarget(ctx: TargetContext): Promise<TargetResult> {
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));

  const { json, usage } = await callForJson(ctx, buildPortfolioPickPrompt(ctx.facts, photos));
  const parsed = picksResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed picks response: ${parsed.error.message}`);

  const itemSpecs = parsed.data.picks.map((raw) => {
    const payload = validated("portfolio_pick", raw);
    assertKnownPhotos([payload.session_photo_id as string], known);
    return {
      content_type: "portfolio_pick", payload,
      destination: payload.category as string, photoId: payload.session_photo_id as string,
    };
  });
  return { outcome: "completed", itemSpecs, usage };
}

async function schoolTarget(ctx: TargetContext): Promise<TargetResult> {
  if (!ctx.facts.school_slug || !isSchoolSlug(ctx.facts.school_slug)) {
    return { outcome: "skipped", itemSpecs: [], usage: null, note: "session has no school" };
  }
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));

  const { json, usage } = await callForJson(
    ctx, buildSchoolPagePhotoPrompt(ctx.facts, photos, ctx.facts.school_slug),
  );
  const parsed = placementsResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed placements response: ${parsed.error.message}`);

  const itemSpecs = parsed.data.placements.map((raw) => {
    const payload = validated("school_page_photo", raw);
    assertKnownPhotos([payload.session_photo_id as string], known);
    return {
      content_type: "school_page_photo", payload,
      destination: payload.school_slug as string, photoId: payload.session_photo_id as string,
    };
  });
  return { outcome: "completed", itemSpecs, usage };
}

async function guideTarget(ctx: TargetContext): Promise<TargetResult> {
  const guide = guideTypeForService(ctx.facts.service_type);
  if (!guide) {
    return {
      outcome: "skipped", itemSpecs: [], usage: null,
      note: "no guide page is configured for this service type",
    };
  }
  if (!ctx.facts.primary_location?.trim()) {
    return {
      outcome: "skipped", itemSpecs: [], usage: null,
      note: `add a location before generating a ${guide} guide entry`,
    };
  }
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));

  const { json, usage } = await callForJson(ctx, buildGuidePhotoPrompt(ctx.facts, photos, guide));
  const parsed = placementsResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed placements response: ${parsed.error.message}`);

  const itemSpecs = parsed.data.placements.map((raw) => {
    const payload = validated("guide_photo", raw);
    assertKnownPhotos([payload.session_photo_id as string], known);
    return {
      content_type: "guide_photo", payload,
      destination: `${guide}-${payload.location_key as string}`,
      photoId: payload.session_photo_id as string,
    };
  });
  return { outcome: "completed", itemSpecs, usage };
}

export const GENERATION_TARGETS: Record<string, (ctx: TargetContext) => Promise<TargetResult>> = {
  internal_link_suggestion: internalLinkTarget,
  testimonial_feature: testimonialTarget,
  journal_post: journalTarget,
  portfolio_pick: portfolioTarget,
  school_page_photo: schoolTarget,
  guide_photo: guideTarget,
};
