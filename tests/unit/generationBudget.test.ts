import { describe, it, expect } from "vitest";
import {
  GENERATE_ROUTE_MAX_DURATION_SECONDS, GENERATION_DEADLINE_MS, GENERATION_LEASE_SECONDS,
  GENERATION_MIN_WINDOW_MS, MIN_MODEL_CALL_MS, remainingModelCallMs,
} from "@/lib/contentEngine/generationBudget";
import { HARD_DEADLINE_MS } from "@/lib/contentEngine/jobRunner";

// One coherent duration budget: the model call ends before the route deadline,
// the route deadline leaves time to persist, and the claim lease outlives any
// invocation that could still write (2026-11-03 production timeout).
describe("generation duration budget", () => {
  it("the model deadline leaves headroom inside the route's max duration to persist a result", () => {
    expect(GENERATION_DEADLINE_MS).toBeLessThanOrEqual(GENERATE_ROUTE_MAX_DURATION_SECONDS * 1000 - 30_000);
  });

  it("the claim lease is at least as long as the longest-lived invocation (route and worker)", () => {
    expect(GENERATION_LEASE_SECONDS * 1000).toBeGreaterThanOrEqual(GENERATE_ROUTE_MAX_DURATION_SECONDS * 1000);
    expect(GENERATION_LEASE_SECONDS * 1000).toBeGreaterThan(HARD_DEADLINE_MS);
  });

  it("the worker needs a real window before it starts a generate wave", () => {
    expect(GENERATION_MIN_WINDOW_MS).toBeGreaterThan(MIN_MODEL_CALL_MS);
    expect(GENERATION_MIN_WINDOW_MS).toBeLessThan(HARD_DEADLINE_MS);
  });

  it("remainingModelCallMs never goes negative", () => {
    expect(remainingModelCallMs(1_000, 500)).toBe(500);
    expect(remainingModelCallMs(1_000, 1_500)).toBe(0);
  });
});
