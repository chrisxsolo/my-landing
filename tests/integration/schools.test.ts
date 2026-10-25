import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { service, resetDb, createTestSession } from "./helpers";
import {
  createCustomSchool, findSchool, listSchools, loadSessionFactsSnapshot,
} from "@/lib/contentEngine/schoolStore";
import { updateSessionFacts } from "@/lib/contentEngine/createSession";

// The route builds its own admin client from these; point it at the test DB.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_TEST_SERVICE_KEY ?? "";
process.env.ADMIN_SESSION_SECRET = "test-admin-secret";

beforeAll(() => resetDb());

const UC_LAW = {
  name: "University of California College of the Law, San Francisco",
  shortName: "UC Law SF",
  slug: "uc-law-san-francisco",
};

function schoolRequest(method: "GET" | "POST", body?: unknown, admin = true) {
  return new NextRequest("http://localhost/api/admin/session-content/schools", {
    method,
    headers: { "content-type": "application/json", ...(admin ? { cookie: "admin_session=test-admin-secret" } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("custom schools (content_engine_schools)", () => {
  it("adds a new school once, and it persists for later lookups", async () => {
    const result = await createCustomSchool(service, UC_LAW);
    expect(result.created).toBe(true);

    const schools = await listSchools(service);
    expect(schools.filter((s) => s.slug === UC_LAW.slug)).toHaveLength(1);
    expect(schools.slice(0, 7).every((s) => s.builtIn)).toBe(true); // built-ins still first
    expect(await findSchool(service, UC_LAW.slug)).toMatchObject({ shortName: "UC Law SF", builtIn: false });
  });

  it("refuses a duplicate under a different abbreviation and points at the original", async () => {
    const result = await createCustomSchool(service, { name: "UC Law San Francisco", shortName: null, slug: "uc-law-sf" });
    expect(result).toMatchObject({ created: false, existing: { slug: UC_LAW.slug } });
    const { count } = await service.from("content_engine_schools").select("*", { count: "exact", head: true });
    expect(count).toBe(1);
  });

  it("refuses a built-in school", async () => {
    const result = await createCustomSchool(service, { name: "San Francisco State University", shortName: null, slug: "sfsu-2" });
    expect(result).toMatchObject({ created: false, existing: { slug: "sf-state" } });
  });

  it("two simultaneous submits create one row", async () => {
    const candidate = { name: "Foothill College", shortName: null, slug: "foothill-college" };
    const results = await Promise.all([createCustomSchool(service, candidate), createCustomSchool(service, candidate)]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    const { count } = await service.from("content_engine_schools")
      .select("*", { count: "exact", head: true }).eq("slug", "foothill-college");
    expect(count).toBe(1);
  });

  it("anon cannot read or write the table", async () => {
    const { anon } = await import("./helpers");
    const { data } = await anon.from("content_engine_schools").select("slug");
    expect(data ?? []).toEqual([]);
    const { error } = await anon.from("content_engine_schools")
      .insert({ slug: "anon-school", name: "Anon School", name_key: "anon" });
    expect(error).not.toBeNull();
  });
});

describe("session facts with a custom school", () => {
  it("saves a custom school on a session and the AI snapshot names it", async () => {
    const sessionId = await createTestSession({ service_type: "grads" });
    await updateSessionFacts({ client: service, sessionId, facts: { school_slug: UC_LAW.slug } });

    const { data: session } = await service.from("photography_sessions").select("*").eq("id", sessionId).single();
    expect(session!.school_slug).toBe(UC_LAW.slug);
    const facts = await loadSessionFactsSnapshot(service, session!);
    expect(facts.school_name).toBe(UC_LAW.name);
    expect(facts.school_short_name).toBe("UC Law SF");
  });

  it("still accepts built-in schools and rejects unknown ones", async () => {
    const sessionId = await createTestSession({ service_type: "grads" });
    await updateSessionFacts({ client: service, sessionId, facts: { school_slug: "sjsu" } });
    await expect(updateSessionFacts({ client: service, sessionId, facts: { school_slug: "not-a-school" } }))
      .rejects.toThrow(/invalid school slug/);
    const { data } = await service.from("photography_sessions").select("school_slug").eq("id", sessionId).single();
    expect(data!.school_slug).toBe("sjsu");
  });
});

describe("/api/admin/session-content/schools", () => {
  it("rejects requests without an admin session", async () => {
    const { GET, POST } = await import("@/app/api/admin/session-content/schools/route");
    expect((await GET(schoolRequest("GET", undefined, false))).status).toBe(401);
    expect((await POST(schoolRequest("POST", { name: "Sneaky College" }, false))).status).toBe(401);
    const { count } = await service.from("content_engine_schools")
      .select("*", { count: "exact", head: true }).eq("slug", "sneaky-college");
    expect(count).toBe(0);
  });

  it("creates (201), reports duplicates (409) and validates input (422)", async () => {
    const { GET, POST } = await import("@/app/api/admin/session-content/schools/route");

    const created = await POST(schoolRequest("POST", { name: "Mills College at Northeastern", shortName: "Mills" }));
    expect(created.status).toBe(201);
    expect((await created.json()).school).toMatchObject({ slug: "mills", builtIn: false });

    const dup = await POST(schoolRequest("POST", { name: "UC Law SF" }));
    expect(dup.status).toBe(409);
    expect((await dup.json()).existing.slug).toBe(UC_LAW.slug);

    expect((await POST(schoolRequest("POST", { name: "" }))).status).toBe(422);

    const list = await (await GET(schoolRequest("GET"))).json();
    expect(list.schools.map((s: { slug: string }) => s.slug)).toEqual(expect.arrayContaining(["usf", UC_LAW.slug, "mills"]));
  });
});
