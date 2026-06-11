import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage } from "./helpers";

beforeAll(() => resetDb());

async function claimType(packageId: string, contentType: string, lease = 180) {
  return service.rpc("claim_generation_type", {
    p_package_id: packageId, p_content_type: contentType, p_lease_seconds: lease,
  });
}

async function recordResult(packageId: string, contentType: string, outcome: string,
  opts: { error?: string; usage?: Record<string, unknown> } = {}) {
  return service.rpc("record_generation_result", {
    p_package_id: packageId, p_content_type: contentType, p_outcome: outcome,
    p_error: opts.error ?? null, p_usage: opts.usage ?? null,
  });
}

async function progressOf(packageId: string) {
  const { data } = await service.from("session_content_packages")
    .select("status,generation_settings").eq("id", packageId).single();
  return { status: data!.status as string, progress: data!.generation_settings.progress };
}

describe("claim_generation_type (spec §8.2)", () => {
  it("claims a pending type: processing, attempt 1, future lease; other types untouched", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post", "portfolio_pick"]);

    const { data: claimed, error } = await claimType(pkg, "journal_post");
    expect(error).toBeNull();
    expect(claimed).toBe(true);

    const { progress } = await progressOf(pkg);
    expect(progress.journal_post.status).toBe("processing");
    expect(progress.journal_post.attempt).toBe(1);
    expect(new Date(progress.journal_post.lease_expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(progress.portfolio_pick.status).toBe("pending");
    expect(progress.portfolio_pick.attempt).toBe(0);
  });

  it("returns false for a live claim; reclaims after the lease expires", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    expect((await claimType(pkg, "journal_post")).data).toBe(true);
    expect((await claimType(pkg, "journal_post")).data).toBe(false); // live, no steal

    // claim with a 0-second lease, then reclaim succeeds
    const sessionId2 = await createTestSession();
    const pkg2 = await createPackage(sessionId2, ["journal_post"]);
    expect((await claimType(pkg2, "journal_post", 0)).data).toBe(true);
    expect((await claimType(pkg2, "journal_post")).data).toBe(true); // expired → reclaim
    const { progress } = await progressOf(pkg2);
    expect(progress.journal_post.attempt).toBe(2);
  });

  it("rejects an unselected type and an archived package", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const unselected = await claimType(pkg, "portfolio_pick");
    expect(unselected.error?.message).toMatch(/not selected/i);

    await service.from("session_content_packages")
      .update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", pkg);
    const archived = await claimType(pkg, "journal_post");
    expect(archived.error?.message).toMatch(/archived/i);
  });

  it("concurrent claims: exactly one winner", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const results = await Promise.all([claimType(pkg, "journal_post"), claimType(pkg, "journal_post")]);
    const wins = results.filter((r) => r.data === true);
    expect(wins).toHaveLength(1);
    const { progress } = await progressOf(pkg);
    expect(progress.journal_post.attempt).toBe(1);
  });
});

describe("record_generation_result + package transitions (spec §8.2)", () => {
  it("completed with usage; package → ready when every selected type is terminal-good", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post", "portfolio_pick"]);

    await claimType(pkg, "journal_post");
    const r1 = await recordResult(pkg, "journal_post", "completed",
      { usage: { model: "claude-sonnet-4-6", input_tokens: 900, output_tokens: 400 } });
    expect(r1.error).toBeNull();
    expect(r1.data).toBe("generating"); // portfolio_pick still pending

    await claimType(pkg, "portfolio_pick");
    const r2 = await recordResult(pkg, "portfolio_pick", "completed",
      { usage: { model: "claude-sonnet-4-6", input_tokens: 700, output_tokens: 300 } });
    expect(r2.data).toBe("ready");

    const { status, progress } = await progressOf(pkg);
    expect(status).toBe("ready");
    expect(progress.journal_post.status).toBe("completed");
    expect(progress.journal_post.usage.input_tokens).toBe(900);
    expect(progress.journal_post.completed_at).not.toBeNull();
    expect(progress.journal_post.lease_expires_at).toBeNull();
  });

  it("failed type → needs_attention once all types are terminal; skip-failed → ready", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post", "portfolio_pick"]);

    await claimType(pkg, "journal_post");
    expect((await recordResult(pkg, "journal_post", "failed", { error: "model error" })).data)
      .toBe("generating"); // portfolio still pending → not terminal yet

    await claimType(pkg, "portfolio_pick");
    expect((await recordResult(pkg, "portfolio_pick", "completed")).data).toBe("needs_attention");

    // Skip failed type (spec §7.4 "Skip failed content type") — failed → skipped → ready
    expect((await recordResult(pkg, "journal_post", "skipped")).data).toBe("ready");
    const { progress } = await progressOf(pkg);
    expect(progress.journal_post.status).toBe("skipped");
    expect(progress.journal_post.error).toBeNull();
  });

  it("completed/failed require a held claim; skipped requires processing or failed", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const noClaim = await recordResult(pkg, "journal_post", "completed");
    expect(noClaim.error?.message).toMatch(/not processing/i);
    const badSkip = await recordResult(pkg, "journal_post", "skipped");
    expect(badSkip.error?.message).toMatch(/cannot be skipped/i);
    const badOutcome = await recordResult(pkg, "journal_post", "exploded");
    expect(badOutcome.error?.message).toMatch(/invalid outcome/i);
  });
});
