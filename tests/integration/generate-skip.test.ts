import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage } from "./helpers";
import { skipFailedType } from "@/lib/contentEngine/skipType";

beforeAll(() => resetDb());

describe("skipFailedType (spec §8.2)", () => {
  it("marks a failed type skipped so the package can reach ready", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post", "portfolio_pick"]);
    // claim + fail journal; complete portfolio
    await service.rpc("claim_generation_type", { p_package_id: pkg, p_content_type: "journal_post", p_lease_seconds: 180 });
    await service.rpc("record_generation_result", { p_package_id: pkg, p_content_type: "journal_post", p_outcome: "failed", p_error: "model error", p_usage: null });
    await service.rpc("claim_generation_type", { p_package_id: pkg, p_content_type: "portfolio_pick", p_lease_seconds: 180 });
    await service.rpc("record_generation_result", { p_package_id: pkg, p_content_type: "portfolio_pick", p_outcome: "completed", p_error: null, p_usage: null });

    const result = await skipFailedType({ client: service, packageId: pkg, contentType: "journal_post" });
    expect(result.packageStatus).toBe("ready");

    const { data } = await service.from("session_content_packages")
      .select("status,generation_settings").eq("id", pkg).single();
    expect(data!.status).toBe("ready");
    expect(data!.generation_settings.progress.journal_post.status).toBe("skipped");
  });

  it("refuses to skip a type that is not failed", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    await expect(skipFailedType({ client: service, packageId: pkg, contentType: "journal_post" }))
      .rejects.toThrow(/cannot be skipped/i);
  });
});
