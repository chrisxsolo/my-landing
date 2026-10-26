// The guide step for family/couples/portrait sessions (spec §8.2, extended
// 2026-10-25 for location intelligence). The session's place is resolved
// deterministically FIRST; then:
//   • the place has a guide page   → place photos on that one page
//   • no page, proposal pending    → skip (no duplicate proposal)
//   • no page, no proposal         → propose a new location_guide draft
//   • place not verified           → skip and ask for confirmation
// The model never decides which location a session belongs to.
import { z } from "zod";
import {
  callForJson, loadPhotoSummaries, validated, assertKnownPhotos, keepKnownPhotoPlacements, GenerationError,
  type ItemSpec, type TargetContext, type TargetResult,
} from "@/lib/contentEngine/generationTargetCore";
import { buildGuidePhotoPrompt } from "@/lib/contentEngine/prompts";
import { auditGuideClaims, buildLocationGuidePrompt, deterministicGuideFields } from "@/lib/contentEngine/locationGuidePrompt";
import {
  confirmationMessage, findOpenProposal, guideForSession, loadSessionLocation,
  verifiedPlaceBlock, type SessionLocation,
} from "@/lib/contentEngine/sessionLocation";
import {
  GUIDE_LABEL, collidesWithStaticGuide, guideSlugForPlace,
  type GuideMatch, type LocationGuideType,
} from "@/lib/locations/guideCoverage";
import type { KnownPlace } from "@/lib/locations/places";

const placementsResponseSchema = z.object({ placements: z.array(z.unknown()) });
const proposalResponseSchema = z.object({
  data: z.record(z.string(), z.unknown()),
  photos: z.array(z.unknown()),
  hero_photo_id: z.string(),
  needs_verification: z.array(z.string()).default([]),
});

// A page with this many session photos counts as credible enough to index —
// the same rule the hand-written guides follow ("don't index thin pages").
const INDEXABLE_PHOTO_COUNT = 4;

const skipped = (note: string): TargetResult => ({ outcome: "skipped", itemSpecs: [], usage: null, note });

async function placeOnExistingGuide(
  ctx: TargetContext, location: SessionLocation, match: GuideMatch,
): Promise<TargetResult> {
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));

  const { json, usage } = await callForJson(
    ctx, buildGuidePhotoPrompt(ctx.facts, photos, match.guide, [match.slug], verifiedPlaceBlock(location)),
  );
  const parsed = placementsResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed placements response: ${parsed.error.message}`);

  const placements = keepKnownPhotoPlacements(parsed.data.placements, known, "guide_photo");
  const itemSpecs: ItemSpec[] = placements.map((raw) => {
    const payload = validated("guide_photo", raw);
    if (payload.guide !== match.guide || payload.location_key !== match.slug) {
      throw new GenerationError(
        `guide placement ${String(payload.guide)}/${String(payload.location_key)} is not this session's location (${match.slug})`,
      );
    }
    return {
      content_type: "guide_photo", payload,
      destination: `${match.guide}-${match.slug}`,
      photoId: payload.session_photo_id as string,
    };
  });
  return { outcome: "completed", itemSpecs, usage };
}

function otherPlaceNames(place: KnownPlace, places: readonly KnownPlace[]): string[] {
  const own = new Set([place.city, place.searchArea, place.county].map((v) => v.toLowerCase()));
  const names = places.filter((p) => p.key !== place.key).flatMap((p) => [p.name, p.city, p.searchArea]);
  return [...new Set(names)].filter((n) => !own.has(n.toLowerCase()) && n.length > 3);
}

async function proposeNewGuide(
  ctx: TargetContext, location: SessionLocation, place: KnownPlace, guide: LocationGuideType,
): Promise<TargetResult> {
  const slug = guideSlugForPlace(place);
  if (collidesWithStaticGuide(guide, slug, place.key)) {
    return skipped(`a hand-written ${guide} guide already uses ${slug}`);
  }
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));

  const { json, usage } = await callForJson(
    ctx, buildLocationGuidePrompt(ctx.facts, photos, place, guide, verifiedPlaceBlock(location)), [], 8000,
  );
  const parsed = proposalResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed location guide response: ${parsed.error.message}`);

  const data = { ...parsed.data.data, ...deterministicGuideFields(place, guide) };
  const draft = {
    guide, location_key: place.key, slug,
    place: {
      name: place.name, city: place.city, county: place.county, state: place.state,
      region: place.region, search_area: place.searchArea,
    },
    data,
    photos: parsed.data.photos,
    hero_photo_id: parsed.data.hero_photo_id,
    needs_verification: parsed.data.needs_verification,
    indexable: false,
    source_session_id: ctx.sessionId,
  };
  const payload = validated("location_guide", draft);
  const photoIds = (payload.photos as { session_photo_id: string }[]).map((p) => p.session_photo_id);
  assertKnownPhotos(photoIds, known);

  const audit = auditGuideClaims(
    payload.data as Parameters<typeof auditGuideClaims>[0], place, otherPlaceNames(place, location.places),
  );
  const finalPayload = {
    ...payload,
    needs_verification: [...new Set([...(payload.needs_verification as string[]), ...audit])],
    indexable: photoIds.length >= INDEXABLE_PHOTO_COUNT,
  };
  return {
    outcome: "completed",
    itemSpecs: [{
      content_type: "location_guide", payload: finalPayload,
      destination: `${guide}-guide-${place.key}`, photoId: null,
    }],
    usage,
    note: `New location detected: ${place.name}, ${place.searchArea} — ${GUIDE_LABEL[guide].toLowerCase()} guide proposed`,
  };
}

export async function locationGuideStep(ctx: TargetContext, guide: LocationGuideType): Promise<TargetResult> {
  const location = await loadSessionLocation(ctx.client, ctx.sessionId, ctx.facts.primary_location);
  if (location.resolution.status !== "verified") {
    return skipped(confirmationMessage(location.resolution));
  }
  const place = location.resolution.place;
  const match = guideForSession(location, guide);
  if (match) return placeOnExistingGuide(ctx, location, match);

  const { data: inPackage, error } = await ctx.client.from("session_content_items")
    .select("status")
    .eq("package_id", ctx.packageId)
    .eq("content_type", "location_guide")
    .eq("payload->>guide", guide)
    .eq("payload->>location_key", place.key)
    .limit(1);
  if (error) throw new GenerationError(`could not check this package's guide proposals: ${error.message}`);
  if (inPackage?.[0]) {
    return skipped(`the ${place.name} ${guide} guide was already proposed in this package (${inPackage[0].status as string})`);
  }

  const open = await findOpenProposal(ctx.client, guide, place.key);
  if (open) {
    return skipped(
      open.sessionId === ctx.sessionId
        ? `the ${place.name} ${guide} guide proposal is already in review`
        : `a ${place.name} ${guide} guide proposal from another session is already in review — approve or reject it there`,
    );
  }
  return proposeNewGuide(ctx, location, place, guide);
}
