// The publication worker route: fails closed without the secret, rejects a bad
// bearer with no side effects, refuses preview deployments, and the retry
// back-off is bounded.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { WORKER_ROUTE_MAX_DURATION_SECONDS } from "@/lib/contentPublishing/constants";
import { retryDelaySeconds } from "@/lib/contentPublishing/worker";

const mocks = vi.hoisted(() => ({ runs: 0, clientCalls: 0 }));
vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient: () => { mocks.clientCalls += 1; return {}; } }));
vi.mock("@/lib/contentPublishing/worker", async () => {
  const actual = await vi.importActual<typeof import("@/lib/contentPublishing/worker")>("@/lib/contentPublishing/worker");
  return {
    ...actual,
    runPublicationWorker: async () => {
      mocks.runs += 1;
      return { runId: 1, claimed: 0, published: 0, blocked: 0, failed: 0, retried: 0, refreshed: 0, publishedItemIds: [], results: [] };
    },
  };
});
vi.mock("@/lib/locationLibrary/autoSync", () => ({ syncItemSessionInBackground: () => {} }));
vi.mock("@/lib/campusSpotFill/autoSync", () => ({ syncCampusSpotPhotosInBackground: () => {} }));

process.env.CRON_SECRET = "test-secret-value";
const route = await import("@/app/api/content-publishing/worker/route");

const get = (auth?: string) => route.GET(new NextRequest("http://localhost/api/content-publishing/worker", {
  headers: auth ? { authorization: auth } : {},
}));

beforeEach(() => { mocks.runs = 0; mocks.clientCalls = 0; delete process.env.VERCEL_ENV; });

describe("worker route", () => {
  it("exports a duration the lease outlasts", () => {
    expect(route.maxDuration).toBe(WORKER_ROUTE_MAX_DURATION_SECONDS);
    expect(route.runtime).toBe("nodejs");
  });

  it("rejects a missing or wrong bearer with no side effects", async () => {
    expect((await get()).status).toBe(401);
    expect((await get("Bearer nope")).status).toBe(401);
    expect(mocks.runs).toBe(0);
    expect(mocks.clientCalls).toBe(0);
  });

  it("runs one tick for the right bearer", async () => {
    const res = await get("Bearer test-secret-value");
    expect(res.status).toBe(200);
    expect(mocks.runs).toBe(1);
  });

  it("refuses to work the production queue from a preview deployment", async () => {
    process.env.VERCEL_ENV = "preview";
    const res = await get("Bearer test-secret-value");
    expect(res.status).toBe(409);
    expect(mocks.runs).toBe(0);
  });

  it("POST without admin cookie or bearer is unauthorized", async () => {
    const res = await route.POST(new NextRequest("http://localhost/api/content-publishing/worker", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(mocks.runs).toBe(0);
  });
});

describe("retry back-off", () => {
  it("doubles from one minute and is capped", () => {
    expect(retryDelaySeconds(1)).toBe(60);
    expect(retryDelaySeconds(2)).toBe(120);
    expect(retryDelaySeconds(3)).toBe(240);
    expect(retryDelaySeconds(10)).toBe(15 * 60);
  });
});
