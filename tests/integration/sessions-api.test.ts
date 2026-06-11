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
    expect(row!.marketing_permission).toBe(false); // never defaulted on
    expect(row!.ai_processing_allowed).toBe(false); // blank sessions need explicit confirmation
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
    expect(row!.marketing_permission).toBe(false); // publication permission is NEVER auto-enabled
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
