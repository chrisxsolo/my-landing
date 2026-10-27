// Server findings become review-queue items: excluded photos still live (with
// each placement's existing removal endpoint, or only a link), sessions with
// an unresolved location or no school, and proposed places that are never
// published without a person approving them.
import { describe, expect, it } from "vitest";
import { journalPlacement, portfolioPlacement } from "@/lib/photoExclusion/kinds";
import {
  excludedLiveItems, findingItems, placementDismissId, proposedPlaceItems, sessionItems,
  type ExcludedLiveFinding, type ProposedPlaceFinding, type SessionFinding,
} from "@/lib/reviewQueue/findingItems";

const S1 = "11111111-1111-4111-8111-111111111111";
const P1 = "22222222-2222-4222-8222-000000000001";

const excluded = (over: Partial<ExcludedLiveFinding> = {}): ExcludedLiveFinding => ({
  photoId: P1, sessionId: S1, sessionName: "Kim", schoolSlug: "uc-berkeley", url: "https://x/thumb.jpg",
  placements: [journalPlacement(P1, { id: 21, title: "Spring" }), portfolioPlacement(P1, { id: 188, title: null })],
  dismissed: [], excludedAt: "2026-10-20T00:00:00Z", ...over,
});

const session = (over: Partial<SessionFinding> = {}): SessionFinding => ({
  id: S1, name: "Kim", serviceType: "grads", schoolSlug: null, location: "Stanford University", syncStatus: "needs_review",
  syncMessage: null, createdAt: "2026-10-01T00:00:00Z", schoolSuggestions: [], url: null, photoKey: `engine:${P1}`, ...over,
});

const place = (over: Partial<ProposedPlaceFinding> = {}): ProposedPlaceFinding => ({
  id: 7, title: "Legion of Honor", slug: "legion-of-honor", city: "San Francisco", region: "san-francisco", origin: "engine",
  hasDescription: true, sessionCount: 1, createdAt: "2026-10-05T00:00:00Z", heroUrl: null, ...over,
});

describe("excluded but still live", () => {
  it("lists every placement, with a removal only where an endpoint exists", () => {
    const [item] = excludedLiveItems([excluded()]);
    expect(item).toMatchObject({ kind: "excluded-live", key: `engine:${P1}`, sessionId: S1, school: "uc-berkeley", createdAt: "2026-10-20T00:00:00Z", safe: false });
    expect(item.actions.map((a) => [a.role, a.label])).toEqual([
      ["edit", "Open Journal post “Spring”"],
      ["approve", "Remove from Portfolio image #188"],
    ]);
    expect(item.actions[1].request).toEqual({ method: "DELETE", url: "/api/admin/portfolio-images?id=188" });
    expect(item.actions[1].confirm).toMatch(/Remove this photo/);
  });

  it("drops placements the photographer chose to keep live, and the item once none remain", () => {
    const kept = excluded({ dismissed: [placementDismissId({ kind: "journal", ref: "21" })] });
    expect(excludedLiveItems([kept])[0].actions.map((a) => a.id)).toEqual(["portfolio:188"]);
    const all = excluded({ dismissed: [placementDismissId({ kind: "journal", ref: "21" }), placementDismissId({ kind: "portfolio", ref: "188" })] });
    expect(excludedLiveItems([all])).toEqual([]);
  });
});

describe("sessions needing review", () => {
  it("makes a grads-without-school item and a session-location item from one session", () => {
    const items = sessionItems([session()]);
    expect(items.map((i) => i.kind)).toEqual(["grad-no-school", "session-location"]);
    expect(items[0]).toMatchObject({ key: `engine:${P1}`, field: "school", href: `/admin/content-engine/${S1}`, options: [] });
    expect(items[0].recommended).toBe("Set the school in Session facts.");
    expect(items[1].explanation).toMatch(/"Stanford University" — the location could not be matched/);
    expect(items[1].actions.map((a) => a.label)).toEqual(["Resync", "Open session"]);
    expect(items[1].actions[0].request).toEqual({ method: "POST", url: "/api/admin/location-library/sync", body: { sessionId: S1 } });
  });

  it("offers the audit's session-wide school suggestion to approve", () => {
    const suggestion = { id: "school:stanford", field: "school" as const, value: "stanford", label: "Stanford", confidence: "high" as const,
      origin: "session" as const, reason: "the session's location names Stanford", appliesTo: "session" as const };
    const [item] = sessionItems([session({ syncStatus: "synced", schoolSuggestions: [suggestion] })]);
    expect(item).toMatchObject({ kind: "grad-no-school", options: [suggestion], evidence: "session facts · high" });
    expect(item.recommended).toMatch(/Accept Stanford for the whole session/);
    expect(sessionItems([session({ schoolSlug: "stanford", syncStatus: "synced" })])).toEqual([]);
  });
});

describe("proposed places", () => {
  it("can be published only with a description, kept unpublished, or opened", () => {
    const [ready] = proposedPlaceItems([place()]);
    expect(ready.actions.map((a) => [a.role, a.label])).toEqual([["approve", "Publish"], ["reject", "Keep unpublished"], ["edit", "Open in Locations"]]);
    expect(ready.actions[0].request).toEqual({ method: "PATCH", url: "/api/admin/location-library/7", body: { active: true } });
    expect(ready.actions[1].request).toEqual({ method: "PATCH", url: "/api/admin/location-library/7", body: { active: false, needs_review: false } });
    const [bare] = proposedPlaceItems([place({ hasDescription: false })]);
    expect(bare.actions.map((a) => a.role)).toEqual(["reject", "edit"]);
    expect(bare.recommended).toMatch(/add a description/);
    expect(bare.explanation).toMatch(/not published and appears in no navigation/);
  });
});

describe("findingItems", () => {
  it("merges every finding kind", () => {
    const items = findingItems({ excludedLive: [excluded()], sessions: [session()], proposedPlaces: [place()], errors: [] });
    expect(items.map((i) => i.kind)).toEqual(["excluded-live", "grad-no-school", "session-location", "proposed-place"]);
  });
});
