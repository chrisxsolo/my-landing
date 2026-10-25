// Per-type generation targets (spec §8.2): each gathers its inputs, calls the
// model (or resolves deterministically), and materializes Zod-validated draft
// item specs. Every destination/photo reference is identity-checked against
// this session's own analyzed photos.
import { z } from "zod";
import {
  buildJournalPrompt, buildPortfolioPickPrompt, buildSchoolPagePhotoPrompt,
  buildGradSpotPrompt, buildInternalLinkPrompt,
} from "@/lib/contentEngine/prompts";
import { guideTypeForService, isSchoolSlug, SPOT_SCHOOL_IDS } from "@/lib/contentEngine/taxonomy";
import { downloadOriginal, encodeImageForModel, toImageBlock } from "@/lib/contentEngine/modelImages";
import {
  GenerationError, assertKnownPhotos, callForJson, deterministicKeywords, excerptOf,
  loadPhotoSummaries, validated, type TargetContext, type TargetResult,
} from "@/lib/contentEngine/generationTargetCore";
import {
  allowedInternalLinks, loadSessionLocation, verifiedPlaceBlock,
} from "@/lib/contentEngine/sessionLocation";
import {
  ALWAYS_ALLOWED_PATHS, finalizeJournalBody, internalPath, prioritizeLinks,
} from "@/lib/contentEngine/guideLinks";
import { loadRelatedPosts } from "@/lib/contentEngine/relatedPosts";
import { locationGuideStep } from "@/lib/contentEngine/locationGuideTarget";
import { isLocationGuideType } from "@/lib/locations/guideCoverage";
import type { PendingGuideLink } from "@/lib/contentEngine/payloads";

export {
  GenerationError, deterministicKeywords, excerptOf,
  type ItemSpec, type TargetContext, type TargetResult, type TargetUsage,
} from "@/lib/contentEngine/generationTargetCore";

const linksResponseSchema = z.object({ links: z.array(z.unknown()) });
const picksResponseSchema = z.object({ picks: z.array(z.unknown()) });
const placementsResponseSchema = z.object({ placements: z.array(z.unknown()) });
const journalResponseSchema = z.object({
  title: z.string(), slug: z.string(), body: z.string(), meta_description: z.string(),
  photo_ids: z.array(z.string()), cover_photo_id: z.string(),
});

// Link candidates: the service's hubs + pricing, plus ONLY the guide page that
// covers the session's verified place. When that place has no guide of the
// session's type yet, the would-be link is recorded as a pending dependency
// instead (resolved when the guide is published, dropped if rejected).
async function internalLinkTarget(ctx: TargetContext): Promise<TargetResult> {
  const location = await loadSessionLocation(ctx.client, ctx.sessionId, ctx.facts.primary_location);
  const allowed = allowedInternalLinks(ctx.facts.service_type, location);
  const { json, usage } = await callForJson(
    ctx, buildInternalLinkPrompt(ctx.facts, allowed.urls, verifiedPlaceBlock(location)),
  );
  const parsed = linksResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed links response: ${parsed.error.message}`);
  const allowedSet = new Set(allowed.urls);
  const links = parsed.data.links.filter((l) => {
    const url = (l as { url?: unknown } | null)?.url;
    return typeof url === "string" && allowedSet.has(url);
  });
  const payload = validated("internal_link_suggestion", {
    links,
    pending_guide_links: allowed.pending ? [allowed.pending] : [],
  });
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
  const links = prioritizeLinks(
    ((linkItem?.payload?.links ?? []) as { url: string; label: string }[]).map((l) => ({ url: l.url, label: l.label })),
    ctx.facts.school_slug,
  );
  const relatedPosts = await loadRelatedPosts(ctx.client, ctx.facts.service_type);
  const pendingGuideLinks = (linkItem?.payload?.pending_guide_links ?? []) as PendingGuideLink[];
  const location = await loadSessionLocation(ctx.client, ctx.sessionId, ctx.facts.primary_location);
  const testimonialQuote = (testimonialItem?.payload?.quote_excerpt as string | undefined) || null;
  const testimonialId = (testimonialItem?.payload?.testimonial_id as string | undefined) ?? null;

  // journal-only: top photos inline as downscaled images (spec §8.3)
  const top = photos.slice(0, 4);
  const { data: paths } = await ctx.client.from("session_photos")
    .select("id,storage_path").in("id", top.map((p) => p.session_photo_id));
  const originals = await Promise.all(
    (paths ?? []).map((p) => downloadOriginal(ctx.client, p.storage_path as string)),
  );
  const imageBlocks = (await Promise.all(originals.map(encodeImageForModel))).map(toImageBlock);

  const { json, usage } = await callForJson(
    ctx, buildJournalPrompt(ctx.facts, photos, {
      links, relatedPosts, testimonialQuote, locationBlock: verifiedPlaceBlock(location),
    }), imageBlocks,
  );
  const parsed = journalResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed journal response: ${parsed.error.message}`);
  assertKnownPhotos([...parsed.data.photo_ids, parsed.data.cover_photo_id], known);

  // Only the provided links (and the always-valid top-level pages) may stay
  // linked in the body; anything else the model wrote is unwrapped to text,
  // and any link-list section it appended is dropped (the page has its own).
  const allowedPaths = new Set([
    ...ALWAYS_ALLOWED_PATHS,
    ...links.map((l) => internalPath(l.url) ?? l.url),
    ...relatedPosts.map((p) => p.url),
  ]);
  const { body, removedLinks, removedSections } = finalizeJournalBody(parsed.data.body, allowedPaths);
  if (removedLinks.length) console.warn(`journal ${ctx.packageId}: removed unapproved links ${removedLinks.join(", ")}`);
  if (removedSections) console.warn(`journal ${ctx.packageId}: removed ${removedSections} link-list section(s)`);

  const payload = validated("journal_post", {
    ...parsed.data,
    body,
    meta_keywords: deterministicKeywords(ctx.facts, location.places),
    internal_links: links,
    pending_guide_links: pendingGuideLinks,
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

// Grad guide = the campus-spots guide: each location_spots row is a single
// image slot keyed by numeric id, scoped to the session's school. Publishing
// replaces the spot's current photo, so placements are conservative.
async function gradSpotTarget(ctx: TargetContext): Promise<TargetResult> {
  const schoolSlug = ctx.facts.school_slug;
  if (!schoolSlug || !isSchoolSlug(schoolSlug)) {
    return {
      outcome: "skipped", itemSpecs: [], usage: null,
      note: "set a school before generating campus spot placements",
    };
  }
  const spotSchoolId = SPOT_SCHOOL_IDS[schoolSlug];
  if (!spotSchoolId) {
    return {
      outcome: "skipped", itemSpecs: [], usage: null,
      note: `the campus spots guide does not cover ${schoolSlug}`,
    };
  }
  const { data: spotRows, error } = await ctx.client
    .from("location_spots")
    .select("id,name,description,tip")
    .eq("school_id", spotSchoolId)
    .order("order", { ascending: true });
  if (error) throw new GenerationError(`could not load campus spots: ${error.message}`);
  if (!spotRows || spotRows.length === 0) {
    return {
      outcome: "skipped", itemSpecs: [], usage: null,
      note: `no campus spots exist for ${schoolSlug} yet`,
    };
  }
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));
  const spotIds = new Set(spotRows.map((s) => String(s.id)));

  const { json, usage } = await callForJson(
    ctx, buildGradSpotPrompt(ctx.facts, photos, spotRows),
  );
  const parsed = placementsResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed placements response: ${parsed.error.message}`);

  const itemSpecs = parsed.data.placements.map((raw) => {
    const payload = validated("guide_photo", raw);
    assertKnownPhotos([payload.session_photo_id as string], known);
    if (payload.guide !== "grad" || !spotIds.has(payload.location_key as string)) {
      throw new GenerationError(
        `campus spot ${payload.location_key} is not a ${schoolSlug} spot`,
      );
    }
    return {
      content_type: "guide_photo", payload,
      destination: `grad-${payload.location_key as string}`,
      photoId: payload.session_photo_id as string,
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
  if (guide === "grad") return gradSpotTarget(ctx);
  if (!isLocationGuideType(guide)) throw new GenerationError(`unsupported guide ${guide}`);
  return locationGuideStep(ctx, guide);
}

export const GENERATION_TARGETS: Record<string, (ctx: TargetContext) => Promise<TargetResult>> = {
  internal_link_suggestion: internalLinkTarget,
  testimonial_feature: testimonialTarget,
  journal_post: journalTarget,
  portfolio_pick: portfolioTarget,
  school_page_photo: schoolTarget,
  guide_photo: guideTarget,
};
