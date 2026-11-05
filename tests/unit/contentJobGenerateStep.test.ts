// The generate step of a content run under contention: a type another owner
// holds (a manual Generate click, or an earlier invocation whose claim is
// still live) must make the job wait, never let it finish, and the job lease
// must keep being renewed while a long wave is in flight. Clock and sleep are
// injected; nothing here waits for real.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GenerationProgressMap } from "@/lib/contentEngine/generationProgress";
import { HEARTBEAT_MS } from "@/lib/contentEngine/generationBudget";

const PACKAGE = "22222222-2222-4222-8222-222222222222";

type Outcome = "completed" | "skipped" | "failed";
type Script = Record<string, () => Promise<{ outcome: Outcome }>>;

const mocks = vi.hoisted(() => ({
  script: {} as Record<string, () => Promise<{ outcome: string }>>,
  calls: [] as string[],
}));

vi.mock("@/lib/contentEngine/generateContent", async () => {
  const actual = await vi.importActual<typeof import("@/lib/contentEngine/generateContent")>(
    "@/lib/contentEngine/generateContent",
  );
  return {
    GenerationConflictError: actual.GenerationConflictError,
    generateContentType: async ({ contentType }: { contentType: string }) => {
      mocks.calls.push(contentType);
      const run = mocks.script[contentType];
      if (!run) throw new Error(`no script for ${contentType}`);
      return { itemIds: [], packageStatus: "generating", ...(await run()) };
    },
  };
});

const { executeStep } = await import("@/lib/contentEngine/jobSteps");
const { createKeepAlive } = await import("@/lib/contentEngine/jobRunner");
const { GenerationConflictError } = await import("@/lib/contentEngine/generateContent");
type Job = Parameters<typeof executeStep>[1];
type Env = Parameters<typeof executeStep>[2];

/** A package whose progress map the test mutates between steps, read fresh by every lookup. */
function fakeClient(state: { selected: string[]; progress: GenerationProgressMap }) {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table !== "session_content_packages") return { data: null, error: { message: `unexpected ${table}` } };
            return { data: { generation_settings: { selected_types: state.selected, progress: state.progress } }, error: null };
          },
        }),
      }),
    }),
  } as unknown as Parameters<typeof executeStep>[0]["client"];
}

function job(): Job {
  return {
    id: "job-1", photography_session_id: "s", package_id: PACKAGE, status: "running", phase: "generate",
    attempts: 0, steps_run: 0, photos_total: 1, photos_done: 1, types_total: 2, types_done: 0,
    soft_errors: [], last_error: null, lease_expires_at: null, created_at: "", started_at: null, finished_at: null, updated_at: "",
  };
}

function env(clock: { now: number }) {
  const sleeps: number[] = [];
  const heartbeats: number[] = [];
  const kept: Promise<unknown>[] = [];
  const e: Env = {
    stopClaimingAt: clock.now + 200_000,
    hardDeadlineAt: clock.now + 270_000,
    shouldStop: async () => { heartbeats.push(clock.now); return false; },
    keepAlive: async (work) => { kept.push(work); return work; },
    sleep: async (ms) => { sleeps.push(ms); clock.now += ms; await new Promise((r) => setImmediate(r)); },
    now: () => clock.now,
  };
  return { env: e, sleeps, heartbeats, kept };
}

const held = () => { throw new GenerationConflictError("held elsewhere"); };
const done = async (): Promise<{ outcome: Outcome }> => ({ outcome: "completed" });

beforeEach(() => {
  mocks.script = {};
  mocks.calls = [];
});

describe("generateStep with a type another owner holds", () => {
  it("waits instead of finishing when every remaining type is held by a live claim elsewhere", async () => {
    const state = {
      selected: ["internal_link_suggestion", "portfolio_pick"],
      progress: {
        internal_link_suggestion: { status: "completed" },
        portfolio_pick: { status: "processing", lease_expires_at: new Date(Date.now() + 200_000).toISOString() },
      } as GenerationProgressMap,
    };
    mocks.script = { portfolio_pick: held } as Script;
    const clock = { now: 1_000_000 };
    const { env: e, sleeps } = env(clock);

    const step = await executeStep({ client: fakeClient(state), callModel: async () => { throw new Error("no model"); } }, job(), e);

    expect(step.phase).toBe("generate");
    expect(step.fatal).toBeUndefined();
    expect(step.waiting).toBe(true);
    expect(sleeps).toEqual([5_000]);
    expect(mocks.calls).toEqual(["portfolio_pick"]);
  });

  it("finishes once the other owner has recorded that type terminal", async () => {
    const state = {
      selected: ["internal_link_suggestion", "portfolio_pick"],
      progress: {
        internal_link_suggestion: { status: "completed" },
        portfolio_pick: { status: "completed" },
      } as GenerationProgressMap,
    };
    const clock = { now: 1_000_000 };
    const { env: e, sleeps } = env(clock);
    const step = await executeStep({ client: fakeClient(state), callModel: async () => { throw new Error("no model"); } }, job(), e);
    expect(step.phase).toBe("done");
    expect(step.patch).toMatchObject({ types_total: 2, types_done: 2 });
    expect(sleeps).toEqual([]);
    expect(mocks.calls).toEqual([]);
  });

  it("keeps generating the types it can claim and comes back for the held one", async () => {
    const state = {
      selected: ["internal_link_suggestion", "portfolio_pick"],
      progress: {
        internal_link_suggestion: { status: "pending" },
        portfolio_pick: { status: "processing", lease_expires_at: new Date(Date.now() + 200_000).toISOString() },
      } as GenerationProgressMap,
    };
    mocks.script = { internal_link_suggestion: done, portfolio_pick: held } as Script;
    const clock = { now: 1_000_000 };
    const { env: e, sleeps } = env(clock);
    const step = await executeStep({ client: fakeClient(state), callModel: async () => { throw new Error("no model"); } }, job(), e);
    expect(step.phase).toBe("generate");
    expect(step.waiting).toBeUndefined();
    expect(sleeps).toEqual([]);
    expect(mocks.calls.sort()).toEqual(["internal_link_suggestion", "portfolio_pick"]);
  });

  it("holds the journal post back while one of its inputs is held by another owner", async () => {
    const state = {
      selected: ["internal_link_suggestion", "testimonial_feature", "journal_post"],
      progress: {
        internal_link_suggestion: { status: "processing", lease_expires_at: new Date(Date.now() + 200_000).toISOString() },
        testimonial_feature: { status: "completed" },
        journal_post: { status: "pending" },
      } as GenerationProgressMap,
    };
    mocks.script = { internal_link_suggestion: held } as Script;
    const clock = { now: 1_000_000 };
    const { env: e } = env(clock);
    const step = await executeStep({ client: fakeClient(state), callModel: async () => { throw new Error("no model"); } }, job(), e);
    expect(step.phase).toBe("generate");
    expect(mocks.calls).toEqual(["internal_link_suggestion"]);
  });
});

describe("the job lease stays alive during a long wave", () => {
  it("generateStep runs the whole wave inside keepAlive", async () => {
    const state = {
      selected: ["internal_link_suggestion"],
      progress: { internal_link_suggestion: { status: "pending" } } as GenerationProgressMap,
    };
    mocks.script = { internal_link_suggestion: done } as Script;
    const clock = { now: 1_000_000 };
    const { env: e, kept } = env(clock);
    const step = await executeStep({ client: fakeClient(state), callModel: async () => { throw new Error("no model"); } }, job(), e);
    expect(step.phase).toBe("generate");
    expect(kept).toHaveLength(1);
  });

  it("createKeepAlive renews the lease every interval while the work outlives the old 120-second job lease", async () => {
    let now = 0;
    const beats: number[] = [];
    let release: (() => void) | null = null;
    const work = new Promise<string>((resolve) => { release = () => resolve("drafts"); });
    // The timer advances an injected clock; the work settles after 150 seconds.
    const timer = async (ms: number) => {
      now += ms;
      await new Promise((r) => setImmediate(r));
      if (now >= 150_000) release?.();
    };
    const keepAlive = createKeepAlive(async () => { beats.push(now); return false; }, timer);
    await expect(keepAlive(work)).resolves.toBe("drafts");
    expect(beats.length).toBeGreaterThanOrEqual(14);
    expect(Math.max(...beats)).toBeGreaterThan(120_000);
    expect(beats.every((t, i) => i === 0 || t - beats[i - 1] === HEARTBEAT_MS)).toBe(true);
  });

  it("createKeepAlive ends with the work: short work never waits out a heartbeat interval", async () => {
    const beats: number[] = [];
    let timerCalls = 0;
    const timer = () => { timerCalls += 1; return new Promise<void>(() => {}); }; // a real timer still pending
    const keepAlive = createKeepAlive(async () => { beats.push(1); return false; }, timer);
    await expect(keepAlive(Promise.resolve(7))).resolves.toBe(7);
    await expect(keepAlive(Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    expect(beats).toEqual([]);
    expect(timerCalls).toBeLessThanOrEqual(2);
  });
});
