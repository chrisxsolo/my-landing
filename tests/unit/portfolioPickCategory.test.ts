// Portfolio picks publish to the category of the session's SERVICE, never to
// the category the model guessed per photo. Portfolio #180 (Tara, an SF State
// grad session) went live under Families because the model's suggestion won.
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GENERATION_TARGETS, type TargetContext } from "@/lib/contentEngine/generationTargets";
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { portfolioCategoryForService } from "@/lib/contentEngine/taxonomy";

const PHOTO = "fac9eb31-1183-4a09-ac52-ba58f8549a4e";

/** Answers the analyzed-photo query with one photo the model may pick. */
function fakeClient(): SupabaseClient {
  const builder = (): unknown => new Proxy({}, {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve({
          data: [{ id: PHOTO, alt_text: "Tara", title: "Tara", description: "", tags: [], quality_score: 9, suggested_category: "families", storage_path: "x" }],
          error: null,
        });
      }
      return () => builder();
    },
  });
  return { from: () => builder() } as unknown as SupabaseClient;
}

function ctx(serviceType: SessionFactsSnapshot["service_type"], modelCategory: string): TargetContext {
  const facts = { service_type: serviceType, secondary_locations: [], school_slug: "sf-state" } as SessionFactsSnapshot;
  return {
    client: fakeClient(), model: "test", sessionId: "s", packageId: "p", facts,
    callModel: async () => ({
      model: "test", usage: { input_tokens: 1, output_tokens: 1 },
      text: JSON.stringify({ picks: [{ session_photo_id: PHOTO, category: modelCategory, title: "Tara", alt_text: "Tara", featured: false }] }),
    }),
  } as TargetContext;
}

describe("portfolioCategoryForService", () => {
  it("maps a session's service to its portfolio category", () => {
    expect(portfolioCategoryForService("grads")).toBe("grads");
    expect(portfolioCategoryForService("Graduation session")).toBe("grads");
    expect(portfolioCategoryForService("couples")).toBe("couples");
    expect(portfolioCategoryForService("families")).toBe("families");
  });

  it("has no answer for services without a portfolio category", () => {
    expect(portfolioCategoryForService("events")).toBeNull();
    expect(portfolioCategoryForService("prom")).toBeNull();
    expect(portfolioCategoryForService(null)).toBeNull();
  });
});

describe("portfolio_pick target", () => {
  it("publishes an SF State grad session's picks as grads even when the model says families", async () => {
    const result = await GENERATION_TARGETS.portfolio_pick(ctx("grads", "families"));
    expect(result.outcome).toBe("completed");
    expect(result.itemSpecs).toHaveLength(1);
    expect(result.itemSpecs[0].payload.category).toBe("grads");
    expect(result.itemSpecs[0].destination).toBe("grads");
  });

  it("keeps the model's category only when the service has none of its own", async () => {
    const result = await GENERATION_TARGETS.portfolio_pick(ctx("events", "portraits"));
    expect(result.itemSpecs[0].payload.category).toBe("portraits");
  });
});
