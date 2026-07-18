import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem } from "./helpers";
import { assembleSessionStates } from "@/lib/contentEngine/sessionState";
import { createPhotographySession, CreateSessionConflictError } from "@/lib/contentEngine/createSession";

beforeAll(() => resetDb());

describe("assembleSessionStates (spec §6 consumer)", () => {
  it("derives per-session state from real rows", async () => {
    const empty = await createTestSession();
    const analyzed = await createTestSession();
    await createTestPhoto(analyzed); // helper default: analysis_status completed
    const reviewed = await createTestSession();
    const pkg = await createPackage(reviewed, ["internal_link_suggestion"]);
    await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
    await createTestPhoto(reviewed);

    const states = await assembleSessionStates(service, [empty, analyzed, reviewed]);
    expect(states.get(empty)!.state).toBe("empty");
    expect(states.get(analyzed)!.state).toBe("analyzed");
    expect(states.get(reviewed)!.state).toBe("reviewed");
    expect(states.get(reviewed)!.itemCounts.approved).toBe(1);
    expect(states.get(reviewed)!.activePackageId).toBe(pkg);
  });
});

describe("createPhotographySession (spec §7.1, §7.2)", () => {
  it("creates a blank session with a valid service type", async () => {
    const created = await createPhotographySession({ client: service, input: { serviceType: "grads" } });
    expect(created.sessionId).toBeTruthy();
    const { data: row } = await service.from("photography_sessions")
      .select("service_type,marketing_permission,ai_processing_allowed").eq("id", created.sessionId).single();
    expect(row!.service_type).toBe("grads");
    expect(row!.marketing_permission).toBe(true); // always enabled on creation
    expect(row!.ai_processing_allowed).toBe(true); // always enabled on creation
  });

  it("rejects a blank session with an invalid service type", async () => {
    await expect(createPhotographySession({ client: service, input: { serviceType: "weddings" } }))
      .rejects.toThrow(/service type/i);
  });

  it("prefills from a client session and auto-enables AI processing with basis", async () => {
    const { data: cs } = await service.from("client_sessions").insert({
      client_email: `pre-${Date.now()}@example.com`, client_name: "Mia Rodriguez",
      session_type: "Graduation Session", session_date: "2026-05-01T18:00:00Z",
      location: "SJSU Tower Lawn", current_status: "delivered",
    }).select("id").single();

    const created = await createPhotographySession({
      client: service, input: { clientSessionId: cs!.id },
    });
    const { data: row } = await service.from("photography_sessions").select("*").eq("id", created.sessionId).single();
    expect(row!.client_session_id).toBe(cs!.id);
    expect(row!.internal_client_name).toBe("Mia Rodriguez");
    expect(row!.public_display_name).toBe("Mia"); // first name only (spec §7.2)
    expect(row!.service_type).toBe("grads");
    expect(row!.primary_location).toBe("SJSU Tower Lawn");
    expect(row!.session_date).toBe("2026-05-01");
    expect(row!.ai_processing_allowed).toBe(true); // covered by contract/privacy policy (spec §3.1)
    expect(row!.ai_processing_basis).toBe("contract");
    expect(row!.ai_processing_confirmed_at).not.toBeNull();
    expect(row!.marketing_permission).toBe(true); // always enabled on creation
    expect(row!.marketing_permission_source).toBe("contract");
  });

  it("a second create for the same client session conflicts with the existing id", async () => {
    const { data: cs } = await service.from("client_sessions").insert({
      client_email: `dup-${Date.now()}@example.com`, client_name: "Leo M",
      session_type: "Family mini", current_status: "delivered",
    }).select("id").single();
    const first = await createPhotographySession({ client: service, input: { clientSessionId: cs!.id } });

    await expect(createPhotographySession({ client: service, input: { clientSessionId: cs!.id } }))
      .rejects.toMatchObject({ existingSessionId: first.sessionId });
  });
});

describe("session facts PATCH semantics (taxonomy-validated)", () => {
  it("accepts valid facts and rejects invalid slugs at the API boundary helper", async () => {
    const sessionId = await createTestSession();
    const { updateSessionFacts } = await import("@/lib/contentEngine/createSession");

    const ok = await updateSessionFacts({
      client: service, sessionId,
      facts: { school_slug: "uc-berkeley", lighting_condition: "golden_hour", primary_location: "Sather Gate" },
    });
    expect(ok.updated).toBe(true);

    await expect(updateSessionFacts({
      client: service, sessionId, facts: { school_slug: "uc-berkley" },
    })).rejects.toThrow(/school/i);
    await expect(updateSessionFacts({
      client: service, sessionId, facts: { service_type: "weddings" },
    })).rejects.toThrow(/service type/i);
  });
});

describe("updatePermissions (spec §7.3, §3.1)", () => {
  it("enables marketing permission with source + stamp; enables AI with basis + stamp", async () => {
    const { updatePermissions } = await import("@/lib/contentEngine/permissions");
    const sessionId = await createTestSession({ marketing_permission: false, ai_processing_allowed: false });

    const result = await updatePermissions({
      client: service, sessionId,
      changes: { marketingPermission: true, marketingPermissionSource: "manual_confirmation",
                 aiProcessingAllowed: true, aiProcessingBasis: "manual_confirmation" },
    });
    expect(result.outcome).toBe("updated");

    const { data: row } = await service.from("photography_sessions").select("*").eq("id", sessionId).single();
    expect(row!.marketing_permission).toBe(true);
    expect(row!.marketing_permission_source).toBe("manual_confirmation");
    expect(row!.marketing_permission_confirmed_at).not.toBeNull();
    expect(row!.marketing_permission_revoked_at).toBeNull();
    expect(row!.ai_processing_allowed).toBe(true);
    expect(row!.ai_processing_basis).toBe("manual_confirmation");
    expect(row!.ai_processing_confirmed_at).not.toBeNull();
  });

  it("revoking marketing permission with published content requires acknowledgement", async () => {
    const { updatePermissions } = await import("@/lib/contentEngine/permissions");
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", { links: [] }, "approved");
    await service.from("session_content_items").update({
      status: "published", published_target_type: "none", published_at: new Date().toISOString(),
    }).eq("id", item);

    const blocked = await updatePermissions({
      client: service, sessionId, changes: { marketingPermission: false },
    });
    expect(blocked.outcome).toBe("requires_acknowledgement");
    if (blocked.outcome !== "requires_acknowledgement") throw new Error("unreachable");
    expect(blocked.publishedCounts.internal_link_suggestion).toBe(1);
    const { data: still } = await service.from("photography_sessions")
      .select("marketing_permission").eq("id", sessionId).single();
    expect(still!.marketing_permission).toBe(true); // untouched

    const revoked = await updatePermissions({
      client: service, sessionId, changes: { marketingPermission: false }, acknowledgePublished: true,
    });
    expect(revoked.outcome).toBe("updated");
    const { data: after } = await service.from("photography_sessions")
      .select("marketing_permission,marketing_permission_revoked_at").eq("id", sessionId).single();
    expect(after!.marketing_permission).toBe(false);
    expect(after!.marketing_permission_revoked_at).not.toBeNull();
  });

  it("rejects sources/bases outside the check-constraint sets", async () => {
    const { updatePermissions } = await import("@/lib/contentEngine/permissions");
    const sessionId = await createTestSession();
    await expect(updatePermissions({
      client: service, sessionId,
      changes: { marketingPermission: true, marketingPermissionSource: "vibes" },
    })).rejects.toThrow(/source/i);
  });
});
