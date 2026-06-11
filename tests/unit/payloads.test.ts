import { describe, it, expect } from "vitest";
import {
  validatePayload, buildSessionFactsSnapshot, sessionFactsSnapshotSchema,
} from "@/lib/contentEngine/payloads";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

describe("journal_post payload", () => {
  const valid = {
    title: "Golden Hour at SJSU", slug: "golden-hour-sjsu",
    body: "Para one.\n\nPara two.", meta_description: "Grad session at SJSU.",
    meta_keywords: "sjsu, graduation photos",
    photo_ids: [UUID, UUID2], cover_photo_id: UUID,
    internal_links: [{ url: "/grads/sjsu", label: "SJSU grad sessions" }],
    testimonial_id: null,
  };

  it("accepts a complete valid payload", () => {
    const r = validatePayload("journal_post", valid);
    expect(r.success).toBe(true);
  });

  it("rejects an internal link outside the canonical list", () => {
    const r = validatePayload("journal_post", {
      ...valid, internal_links: [{ url: "/grads/made-up", label: "x" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a cover_photo_id not present in photo_ids", () => {
    const r = validatePayload("journal_post", { ...valid, cover_photo_id: "33333333-3333-4333-8333-333333333333" });
    expect(r.success).toBe(false);
  });

  it("rejects an empty slug and a non-uuid photo id", () => {
    expect(validatePayload("journal_post", { ...valid, slug: "" }).success).toBe(false);
    expect(validatePayload("journal_post", { ...valid, photo_ids: ["not-a-uuid"], cover_photo_id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("destination-validated payloads", () => {
  it("portfolio_pick requires a known category", () => {
    expect(validatePayload("portfolio_pick", {
      session_photo_id: UUID, category: "grads", title: "t", alt_text: "a", description: "", featured: false,
    }).success).toBe(true);
    expect(validatePayload("portfolio_pick", {
      session_photo_id: UUID, category: "weddings", title: "t", alt_text: "a", description: "", featured: false,
    }).success).toBe(false);
  });

  it("school_page_photo requires a known school slug", () => {
    expect(validatePayload("school_page_photo", {
      session_photo_id: UUID, school_slug: "uc-berkeley", alt_override: "", caption: "", sort_order: 1,
    }).success).toBe(true);
    expect(validatePayload("school_page_photo", {
      session_photo_id: UUID, school_slug: "UC-Berkeley", alt_override: "", caption: "", sort_order: 1,
    }).success).toBe(false);
  });

  it("guide_photo requires a location_key valid for its guide", () => {
    expect(validatePayload("guide_photo", {
      session_photo_id: UUID, guide: "couples", location_key: "legion-of-honor", alt_text: "a",
    }).success).toBe(true);
    // legion-of-honor is couples-only, so it must fail under family
    expect(validatePayload("guide_photo", {
      session_photo_id: UUID, guide: "family", location_key: "legion-of-honor", alt_text: "a",
    }).success).toBe(false);
  });

  it("testimonial_feature and internal_link_suggestion validate", () => {
    expect(validatePayload("testimonial_feature", { testimonial_id: UUID, quote_excerpt: "easy and fun" }).success).toBe(true);
    expect(validatePayload("internal_link_suggestion", {
      links: [{ url: "/pricing", label: "Pricing", reason: "ready to book" }],
    }).success).toBe(true);
    expect(validatePayload("internal_link_suggestion", {
      links: [{ url: "/nope", label: "x", reason: "y" }],
    }).success).toBe(false);
  });
});

describe("social_caption is Phase 2 — not validatable through the dispatcher", () => {
  it("rejects social_caption as a generatable type", () => {
    const r = validatePayload("social_caption", { platform: "instagram", caption: "hi", photo_ids: [UUID] });
    expect(r.success).toBe(false);
  });
});

describe("buildSessionFactsSnapshot", () => {
  it("keeps public facts and strips internal-only fields", () => {
    const snap = buildSessionFactsSnapshot({
      public_display_name: "Mia", service_type: "grads", school_slug: "sjsu",
      primary_location: "Tower Lawn", secondary_locations: [], session_date: "2026-05-01",
      lighting_condition: "golden_hour", graduation_year: 2026, degree: "B.S. Biology",
      outfit_count: 2, group_size: 1, public_session_summary: "A sunset grad shoot.",
      internal_client_name: "Mia Hidden", internal_notes: "paid cash", email: "mia@example.com",
    });
    expect(snap.public_display_name).toBe("Mia");
    expect(snap.service_type).toBe("grads");
    expect(snap).not.toHaveProperty("internal_client_name");
    expect(snap).not.toHaveProperty("internal_notes");
    expect(snap).not.toHaveProperty("email");
    // the result must itself be schema-valid
    expect(sessionFactsSnapshotSchema.safeParse(snap).success).toBe(true);
  });
});
