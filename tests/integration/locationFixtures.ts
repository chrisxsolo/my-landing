// Shared fixtures for the location-intelligence integration tests.
import sharp from "sharp";
import { service, createTestSession, createTestPhoto } from "./helpers";
import { ORIGINALS_BUCKET } from "@/lib/contentEngine/uploadConfig";
import type { ModelCaller, ModelCallRequest } from "@/lib/contentEngine/aiClient";

export const SHARK_FIN_SLUG = "shark-fin-cove-santa-cruz";

export function scriptedModel(respond: (req: ModelCallRequest) => string, calls: ModelCallRequest[] = []): ModelCaller {
  return async (req) => {
    calls.push(req);
    return { text: respond(req), usage: { input_tokens: 900, output_tokens: 400 }, model: req.model };
  };
}

export const promptText = (req: ModelCallRequest) =>
  `${req.system ?? ""}\n${req.messages.map((m) => (typeof m.content === "string" ? m.content
    : m.content.map((c) => ("text" in c ? c.text : "")).join(" "))).join("\n")}`;

/** A couples session at `location` with analyzed photos (optionally stored originals). */
export async function couplesSession(
  location: string | null, opts: { photos?: number; tags?: string[]; stored?: boolean } = {},
) {
  const sessionId = await createTestSession({ service_type: "couples", school_slug: null });
  await service.from("photography_sessions").update({ primary_location: location }).eq("id", sessionId);
  const photoIds: string[] = [];
  for (let i = 0; i < (opts.photos ?? 5); i++) {
    const photo = await createTestPhoto(sessionId, { alt: "Couple on the sand at golden hour" });
    const { data: row } = await service.from("session_photos").select("storage_path").eq("id", photo.id).single();
    if (opts.stored) {
      const buf = await sharp({
        create: { width: 120 + i, height: 90, channels: 3, background: { r: 40 + i * 20, g: 90, b: 120 } },
      }).jpeg().toBuffer();
      await service.storage.from(ORIGINALS_BUCKET).upload(row!.storage_path as string, buf, { contentType: "image/jpeg" });
    }
    await service.from("session_photos").update({
      analysis_status: "completed", quality_score: 9 - (i % 2), title: "Golden hour on the sand",
      description: "A couple walks the waterline below dramatic rock formations.",
      tags: opts.tags ?? ["beach", "golden hour", "couple"], suggested_category: "couples",
    }).eq("id", photo.id);
    photoIds.push(photo.id);
  }
  return { sessionId, photoIds };
}

export const couplesFacts = (location: string | null) => ({
  service_type: "couples", school_slug: null, public_display_name: "Khuong", primary_location: location,
  lighting_condition: "golden_hour", relationship_type: "engagement",
});

const paragraphs = (topic: string) => [`${topic} paragraph one. It reads well.`, `${topic} paragraph two.`];

/** What a well-behaved model returns for a new location guide. */
export function proposalResponse(photoIds: string[]) {
  return JSON.stringify({
    data: {
      metaDescription: "Plan a Shark Fin Cove couples session near Davenport in Santa Cruz County.",
      cardSummary: "A dramatic sea stack and a small sandy cove on the Santa Cruz coast.",
      bestFor: "Couples who want dramatic coastal scenery",
      lightingChar: "Open and warm at golden hour",
      accessNote: "Sandy beach with uneven rocks underfoot",
      heroAlt: "Couple on the sand in front of the Shark Fin Cove sea stack",
      heroTagline: "Shark Fin Cove pairs a sculptural sea stack with a small, sheltered beach.",
      whyItWorks: paragraphs("Why"), photoVariety: paragraphs("Variety"),
      photoVarietyList: ["Wide frames with the sea stack", "Close, warm portraits"],
      bestTimeOfDay: paragraphs("Timing"), bestSeasons: paragraphs("Seasons"),
      whatToWear: paragraphs("Wear"), guideSection: paragraphs("Movement"),
      parkingArrival: ["I share the exact meeting spot and arrival details after booking."],
      ctaTitle: "Plan Your Shark Fin Cove Session", ctaBody: "Send me your date and the feel you want.",
    },
    photos: photoIds.map((id) => ({ session_photo_id: id, alt_text: "Couple at Shark Fin Cove", caption: "Warm light on the sand." })),
    hero_photo_id: photoIds[0],
    needs_verification: ["Parking and access details"],
  });
}

/** A valid location_guide payload for createItem. */
export function guidePayload(sessionId: string, photoIds: string[], overrides: Record<string, unknown> = {}) {
  const parsed = JSON.parse(proposalResponse(photoIds));
  return {
    guide: "couples", location_key: "shark-fin-cove", slug: SHARK_FIN_SLUG,
    place: {
      name: "Shark Fin Cove", city: "Davenport", county: "Santa Cruz County", state: "CA",
      region: "Santa Cruz County", search_area: "Santa Cruz",
    },
    data: {
      ...parsed.data, name: "Shark Fin Cove", h1: "Shark Fin Cove Couples Photography",
      area: "Davenport, Santa Cruz County", region: "Santa Cruz County",
      metaTitle: "Shark Fin Cove Couples Photography Guide | Santa Cruz", keywords: ["Shark Fin Cove couples photos"],
    },
    photos: parsed.photos, hero_photo_id: photoIds[0], needs_verification: [], indexable: true,
    source_session_id: sessionId,
    ...overrides,
  };
}
