// Per-content-type Zod payload schemas (spec §3.4) and the session-facts
// snapshot builder (spec §8.3). All destination references are validated
// against the canonical taxonomy so invalid slugs are unrepresentable.
import { z } from "zod";
import {
  isSchoolSlug, isPortfolioCategory, isCanonicalInternalLink,
  isGuideLocationKey, GUIDE_TYPES, SERVICE_TYPES, LIGHTING_CONDITIONS,
  type ContentType,
} from "@/lib/contentEngine/taxonomy";

// z.uuid() is the zod-v4 canonical form; z.string().uuid() is deprecated but
// still functional. We use z.uuid() throughout per the v4 API.
const uuid = z.uuid();
const nonEmpty = z.string().min(1);

const internalLink = z.object({
  url: z.string().refine(isCanonicalInternalLink, "url is not in the canonical internal-link list"),
  label: nonEmpty,
});

export const journalPostPayloadSchema = z.object({
  title: nonEmpty,
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  body: nonEmpty,
  meta_description: z.string().default(""),
  meta_keywords: z.string().default(""),
  photo_ids: z.array(uuid).min(1),
  cover_photo_id: uuid,
  internal_links: z.array(internalLink).default([]),
  testimonial_id: uuid.nullable().default(null),
}).refine((p) => p.photo_ids.includes(p.cover_photo_id), {
  message: "cover_photo_id must be one of photo_ids",
  path: ["cover_photo_id"],
});

export const portfolioPickPayloadSchema = z.object({
  session_photo_id: uuid,
  category: z.string().refine(isPortfolioCategory, "unknown portfolio category"),
  title: z.string().default(""),
  alt_text: z.string().default(""),
  description: z.string().default(""),
  featured: z.boolean().default(false),
});

export const schoolPagePhotoPayloadSchema = z.object({
  session_photo_id: uuid,
  school_slug: z.string().refine(isSchoolSlug, "unknown school slug"),
  alt_override: z.string().default(""),
  caption: z.string().default(""),
  sort_order: z.number().int().min(0).default(0),
});

export const guidePhotoPayloadSchema = z.object({
  session_photo_id: uuid,
  guide: z.enum(GUIDE_TYPES),
  location_key: z.string(),
  alt_text: z.string().default(""),
}).refine((p) => isGuideLocationKey(p.guide, p.location_key), {
  message: "location_key is not valid for this guide",
  path: ["location_key"],
});

// Phase 2 (spec §3.4, §8.2) — schema retained, deliberately NOT generatable.
export const socialCaptionPayloadSchema = z.object({
  platform: z.enum(["instagram", "tiktok"]),
  caption: nonEmpty,
  photo_ids: z.array(uuid).min(1),
});

export const testimonialFeaturePayloadSchema = z.object({
  testimonial_id: uuid,
  quote_excerpt: z.string().default(""),
});

export const internalLinkSuggestionPayloadSchema = z.object({
  links: z.array(z.object({
    url: z.string().refine(isCanonicalInternalLink, "url is not in the canonical internal-link list"),
    label: nonEmpty,
    reason: z.string().default(""),
  })).default([]),
});

// Dispatcher: social_caption is intentionally absent (Phase 2, spec §8.2).
// Typed as Record<Exclude<ContentType, "social_caption">, ...> so adding a new
// ContentType to taxonomy without a schema entry here becomes a build failure.
const PAYLOAD_SCHEMAS: Record<Exclude<ContentType, "social_caption">, z.ZodType> = {
  journal_post: journalPostPayloadSchema,
  portfolio_pick: portfolioPickPayloadSchema,
  school_page_photo: schoolPagePhotoPayloadSchema,
  guide_photo: guidePhotoPayloadSchema,
  testimonial_feature: testimonialFeaturePayloadSchema,
  internal_link_suggestion: internalLinkSuggestionPayloadSchema,
};

export type GeneratableContentType = keyof typeof PAYLOAD_SCHEMAS;

export function validatePayload(contentType: string, payload: unknown) {
  const schema = PAYLOAD_SCHEMAS[contentType as GeneratableContentType];
  if (!schema) {
    return {
      success: false as const,
      error: new z.ZodError([{
        code: "custom",
        path: ["contentType"],
        message: `no validatable payload schema for content type "${contentType}"`,
        input: contentType,
      }]),
    };
  }
  return schema.safeParse(payload);
}

// Session-facts snapshot (spec §8.3): the ONLY facts allowed to reach the AI.
// Note the absence of internal_client_name / internal_notes / email.
export const sessionFactsSnapshotSchema = z.object({
  public_display_name: z.string().nullable().optional(),
  service_type: z.enum(SERVICE_TYPES),
  school_slug: z.string().nullable().optional(),
  primary_location: z.string().nullable().optional(),
  secondary_locations: z.array(z.string()).default([]),
  session_date: z.string().nullable().optional(),
  lighting_condition: z.enum(LIGHTING_CONDITIONS).nullable().optional(),
  graduation_year: z.number().int().nullable().optional(),
  degree: z.string().nullable().optional(),
  outfit_count: z.number().int().nullable().optional(),
  group_size: z.number().int().nullable().optional(),
  public_session_summary: z.string().nullable().optional(),
});
export type SessionFactsSnapshot = z.infer<typeof sessionFactsSnapshotSchema>;

// Pick only public fields off a session row; internal-only fields are dropped
// by construction (they are never read here), then validated by the schema.
//
// Throws a ZodError on malformed session rows (e.g. missing/invalid
// service_type) by design — a session without a valid service_type must never
// silently reach AI input; callers should guard or let the error surface.
export function buildSessionFactsSnapshot(session: Record<string, unknown>): SessionFactsSnapshot {
  return sessionFactsSnapshotSchema.parse({
    public_display_name: session.public_display_name ?? null,
    service_type: session.service_type,
    school_slug: session.school_slug ?? null,
    primary_location: session.primary_location ?? null,
    secondary_locations: session.secondary_locations ?? [],
    session_date: session.session_date ?? null,
    lighting_condition: session.lighting_condition ?? null,
    graduation_year: session.graduation_year ?? null,
    degree: session.degree ?? null,
    outfit_count: session.outfit_count ?? null,
    group_size: session.group_size ?? null,
    public_session_summary: session.public_session_summary ?? null,
  });
}
