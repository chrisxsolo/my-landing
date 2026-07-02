import { describe, it, expect } from "vitest";
import {
  PROMPT_VERSION, buildAnalysisPrompt, buildJournalPrompt, buildPortfolioPickPrompt,
  buildSchoolPagePhotoPrompt, buildGuidePhotoPrompt, buildInternalLinkPrompt,
} from "@/lib/contentEngine/prompts";
import { CANONICAL_INTERNAL_LINKS, guideLocationKeys } from "@/lib/contentEngine/taxonomy";
import { serviceConfigFor, SERVICE_PROMPTS } from "@/lib/contentEngine/serviceConfig";
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";

const facts: SessionFactsSnapshot = {
  public_display_name: "Mia", service_type: "grads", school_slug: "sjsu",
  primary_location: "Tower Lawn", secondary_locations: [], session_date: "2026-05-01",
  lighting_condition: "golden_hour", graduation_year: 2026, degree: "B.S. Biology",
  outfit_count: 2, group_size: 1, public_session_summary: "A sunset grad shoot.",
};

const photoSummaries = [
  { session_photo_id: "11111111-1111-4111-8111-111111111111", alt_text: "Cap toss", title: "Cap toss",
    description: "", tags: ["sjsu"], quality_score: 9, suggested_category: "grads" as const },
];

describe("prompt construction (spec §8.3)", () => {
  it("exports a non-empty PROMPT_VERSION", () => {
    expect(PROMPT_VERSION.length).toBeGreaterThan(0);
  });

  it("analysis prompt demands JSON keyed by session_photo_id and lists every id", () => {
    const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    const p = buildAnalysisPrompt(facts, ids);
    expect(p.system.toLowerCase()).toContain("json");
    for (const id of ids) expect(p.userText).toContain(id);
    expect(p.userText).toContain("session_photo_id");
    expect(p.userText).toContain("Mia"); // public display name allowed
  });

  it("journal prompt embeds links, the testimonial quote, and the public facts", () => {
    const p = buildJournalPrompt(facts, photoSummaries, {
      links: [{ url: "/grads/sjsu", label: "SJSU grad sessions" }],
      testimonialQuote: "Chris made it feel easy!",
    });
    expect(p.userText).toContain("/grads/sjsu");
    expect(p.userText).toContain("Chris made it feel easy!");
    expect(p.userText).toContain("golden_hour");
    expect(p.system).toContain("soloxsnaps");
  });

  it("internal-link prompt carries the full closed canonical list and forbids others", () => {
    const p = buildInternalLinkPrompt(facts);
    for (const url of CANONICAL_INTERNAL_LINKS) expect(p.userText).toContain(url);
    expect(p.system.toLowerCase()).toMatch(/only.*list|list.*only/);
  });

  it("guide prompt carries only the chosen guide's closed location keys", () => {
    const p = buildGuidePhotoPrompt({ ...facts, service_type: "families" }, photoSummaries, "family");
    for (const key of guideLocationKeys("family")) expect(p.userText).toContain(key);
    expect(p.userText).not.toContain("legion-of-honor"); // couples-only key
  });

  it("portfolio + school prompts include photo summaries with their ids", () => {
    const p1 = buildPortfolioPickPrompt(facts, photoSummaries);
    const p2 = buildSchoolPagePhotoPrompt(facts, photoSummaries, "sjsu");
    expect(p1.userText).toContain(photoSummaries[0].session_photo_id);
    expect(p2.userText).toContain("sjsu");
  });

  it("grad prompts carry NO service-guidance block — byte-identical to the pre-routing engine", () => {
    expect(SERVICE_PROMPTS.grads.contentGuidance).toBe("");
    expect(SERVICE_PROMPTS.grads.analysisGuidance).toBe("");
    const p = buildJournalPrompt(facts, photoSummaries, { links: [], testimonialQuote: null });
    expect(p.system).not.toContain("not a graduation session");
  });

  it("prompts are built ONLY from the snapshot type — no internal fields can appear", () => {
    // Type-level guarantee: builders accept SessionFactsSnapshot, which has no
    // internal_client_name/internal_notes/email. Runtime double-check:
    const all = [
      buildAnalysisPrompt(facts, ["11111111-1111-4111-8111-111111111111"]),
      buildJournalPrompt(facts, photoSummaries, { links: [], testimonialQuote: null }),
      buildInternalLinkPrompt(facts),
    ];
    for (const p of all) {
      expect(p.system + p.userText).not.toMatch(/internal_client_name|internal_notes/);
    }
  });
});

describe("service-aware prompt routing (couples)", () => {
  const couplesFacts: SessionFactsSnapshot = {
    public_display_name: "Ana & Leo", service_type: "couples", school_slug: null,
    primary_location: "Crissy Field", secondary_locations: [], session_date: "2026-06-20",
    lighting_condition: "golden_hour", graduation_year: null, degree: null,
    outfit_count: null, group_size: 2, public_session_summary: "Foggy golden hour walk.",
    vibe: "playful", relationship_type: "engagement",
  };

  it("couples journal prompt carries couples voice guidance and the anti-grad rule", () => {
    const p = buildJournalPrompt(couplesFacts, [], { links: [], testimonialQuote: null });
    expect(p.system).toContain("COUPLES photography session");
    expect(p.system).toMatch(/never mention graduation/i);
    expect(p.system).toContain("Bay Area couples");
  });

  it("couples analysis prompt asks for connection/interaction language, not grad language", () => {
    const p = buildAnalysisPrompt(couplesFacts, ["11111111-1111-4111-8111-111111111111"]);
    expect(p.system).toContain("connection");
    expect(p.system).toContain("outfit coordination");
    expect(p.system).toMatch(/candid or posed/i);
    expect(p.system).toMatch(/never mention graduation/i);
  });

  it("couples internal-link prompt offers only couples pages + pricing — no grad/campus links", () => {
    const p = buildInternalLinkPrompt(couplesFacts);
    expect(p.userText).toContain("/couples-guide");
    expect(p.userText).toContain("/couples-guide/locations/crissy-field");
    expect(p.userText).toContain("/pricing");
    expect(p.userText).not.toContain("/grads/");
    expect(p.userText).not.toContain("/family-guide");
  });

  it("couples facets (vibe, relationship_type) reach the facts block", () => {
    const p = buildJournalPrompt(couplesFacts, [], { links: [], testimonialQuote: null });
    expect(p.userText).toContain("playful");
    expect(p.userText).toContain("engagement");
  });

  it("unknown service types fall back to the grads config", () => {
    expect(serviceConfigFor("weddings")).toBe(SERVICE_PROMPTS.grads);
    expect(serviceConfigFor(null)).toBe(SERVICE_PROMPTS.grads);
  });
});
