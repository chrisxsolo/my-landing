// The distribution preview lines up existing facts per destination; these
// cases follow the examples the feature was asked for.
import { describe, expect, it } from "vitest";
import { classifyDistribution, type DistributionInput } from "@/lib/photoSync/distribution";
import type { AuditedPhoto, TagCheck, TagSuggestion } from "@/lib/photoTagging/types";

const check = (field: TagCheck["field"], state: TagCheck["state"], value: string | null = null): TagCheck =>
  ({ field, state, critical: field === "school", value, source: null, note: state === "missing" ? "missing" : null });

function photo(over: Partial<AuditedPhoto> = {}): AuditedPhoto {
  return {
    key: "portfolio:1", source: "portfolio", portfolioId: 1, enginePhotoId: null, sessionId: null, sessionName: null,
    url: "https://cdn.example/p.jpg", published: true, title: "Photo", category: "couples", school: null,
    status: "full", checks: [check("category", "ok", "Couples"), check("location", "ok", "Palace of Fine Arts")],
    suggestions: [], pages: [], spotTaggable: true, aiAnalyzedAt: null, ...over,
  };
}

function input(over: Partial<DistributionInput>): DistributionInput {
  return { photo: photo(), permission: { ok: true, reason: null }, placements: {}, pageLabels: {}, campusSpot: null, schoolHasSpots: false, ...over };
}

const byId = (rows: ReturnType<typeof classifyDistribution>) => Object.fromEntries(rows.map((r) => [r.id, r]));

describe("photo distribution", () => {
  it("places a confirmed Palace of Fine Arts couples photo on the couples portfolio and its location page", () => {
    const rows = byId(classifyDistribution(input({
      placements: { "couples/palace-of-fine-arts": "shown" },
      pageLabels: { "couples/palace-of-fine-arts": "Couples guide · Palace of Fine Arts" },
    })));
    expect(rows.portfolio).toMatchObject({ label: "Couples portfolio", status: "displayed", editorHref: "/admin?tab=couplesPortfolio" });
    expect(rows["page:couples/palace-of-fine-arts"]).toMatchObject({
      status: "displayed", path: "/couples-guide/locations/palace-of-fine-arts", editorHref: "/admin?tab=pagePhotos",
    });
  });

  it("shows an SJSU Tower Hall photo on the school page and its campus spot", () => {
    const grad = photo({ category: "grads", school: "sjsu", checks: [check("school", "ok", "SJSU"), check("spot", "ok", "Tower Hall")] });
    const rows = byId(classifyDistribution(input({
      photo: grad, schoolHasSpots: true, placements: { "grads/sjsu": "overflow" },
      campusSpot: { schoolSlug: "sjsu", spotKey: "tower-hall", spotName: "Tower Hall", origin: "auto" },
    })));
    expect(rows["page:grads/sjsu"]).toMatchObject({ status: "eligible", path: "/grads/sjsu" });
    expect(rows["campus-spot"]).toMatchObject({ status: "displayed", reason: "Tower Hall (filled automatically)." });
  });

  it("keeps private and permission-blocked photos off every page", () => {
    expect(classifyDistribution(input({ photo: photo({ published: false, url: null }) }))).toEqual([
      expect.objectContaining({ id: "private", status: "not-eligible" }),
    ]);
    const blocked = classifyDistribution(input({ permission: { ok: false, reason: "session is not cleared for marketing" }, placements: { "grads/sjsu": "shown" } }));
    expect(blocked).toEqual([expect.objectContaining({ status: "not-eligible", reason: "Blocked: session is not cleared for marketing." })]);
  });

  it("asks for review when the location is ambiguous, and respects a page the admin hid it on", () => {
    const options: TagSuggestion[] = ["Palace of Fine Arts", "Legion of Honor"].map((label) => ({
      id: `location:${label}`, field: "location", value: label, label, confidence: "medium", origin: "session", reason: "session", appliesTo: "photo",
    }));
    const rows = byId(classifyDistribution(input({
      photo: photo({ checks: [check("category", "ok"), check("location", "missing")], suggestions: options }),
      placements: { "couples/crissy-field": "hidden" },
    })));
    expect(rows["review:location"]).toMatchObject({ status: "review", reason: "Confirm the location: Palace of Fine Arts or Legion of Honor." });
    expect(rows["page:couples/crissy-field"]).toMatchObject({ status: "not-eligible", reason: "Hidden on this page by you." });
  });

  it("does not list a Content Engine-only photo as in the portfolio", () => {
    const engine = photo({ key: "engine:00000000-0000-0000-0000-000000000001", source: "engine", portfolioId: null });
    expect(byId(classifyDistribution(input({ photo: engine }))).portfolio.status).toBe("not-eligible");
  });
});
