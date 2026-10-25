// Location intelligence, generation side (scenarios A–E from the 2026-10-25
// brief). Runs the real guide / link / journal steps against the local test
// DB with a scripted model, so every assertion is about what the engine
// decides deterministically — not about what a model happened to write.
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createPackage, createItem } from "./helpers";
import {
  SHARK_FIN_SLUG, couplesFacts, couplesSession, guidePayload, promptText, proposalResponse, scriptedModel,
} from "./locationFixtures";
import { generateContentType } from "@/lib/contentEngine/generateContent";
import { buildLocationSummary } from "@/lib/contentEngine/locationSummary";
import { confirmNewPlace } from "@/lib/locations/confirmLocation";
import type { ModelCallRequest } from "@/lib/contentEngine/aiClient";

beforeAll(() => resetDb());

async function itemsOf(packageId: string, contentType: string) {
  const { data } = await service.from("session_content_items")
    .select("*").eq("package_id", packageId).eq("content_type", contentType);
  return data ?? [];
}

async function runGuideStep(
  location: string | null, respond: (photoIds: string[]) => string,
  opts: Parameters<typeof couplesSession>[1] = {},
) {
  const { sessionId, photoIds } = await couplesSession(location, opts);
  const pkg = await createPackage(sessionId, ["guide_photo"], couplesFacts(location));
  const calls: ModelCallRequest[] = [];
  const result = await generateContentType({
    client: service, packageId: pkg, contentType: "guide_photo",
    callModel: scriptedModel(() => respond(photoIds), calls),
  });
  return { sessionId, photoIds, pkg, calls, result };
}

describe("Test A — existing location", () => {
  it("a Palace of Fine Arts session places photos on the existing Palace of Fine Arts guide only", async () => {
    const run = await runGuideStep("Palace of Fine Arts", (ids) => JSON.stringify({ placements: [{
      session_photo_id: ids[0], guide: "couples", location_key: "palace-of-fine-arts",
      alt_text: "Couple under the rotunda", caption: "Soft evening light under the colonnade.",
    }] }));
    expect(run.result.outcome).toBe("completed");
    const placed = await itemsOf(run.pkg, "guide_photo");
    expect(placed).toHaveLength(1);
    expect(placed[0].payload.location_key).toBe("palace-of-fine-arts");
    expect(await itemsOf(run.pkg, "location_guide")).toHaveLength(0);
    // the model was offered exactly one key — it never chooses the location
    expect(promptText(run.calls[0])).toContain('["palace-of-fine-arts"]');
    expect(promptText(run.calls[0])).not.toContain("ocean-beach");
  });

  it("a placement on any other guide page fails the step", async () => {
    const run = await runGuideStep("Palace of Fine Arts", (ids) => JSON.stringify({ placements: [{
      session_photo_id: ids[0], guide: "couples", location_key: "ocean-beach", alt_text: "x", caption: "",
    }] }));
    expect(run.result.outcome).toBe("failed");
    expect(run.result.error).toMatch(/not this session's location/);
  });
});

describe("Test B — new location", () => {
  it("a Shark Fin Cove session proposes a new Santa Cruz guide draft", async () => {
    const run = await runGuideStep("Shark Fin Cove", (ids) => proposalResponse(ids));
    expect(run.result.outcome).toBe("completed");
    const [proposal] = await itemsOf(run.pkg, "location_guide");
    expect(proposal.status).toBe("draft");
    expect(proposal.payload.slug).toBe(SHARK_FIN_SLUG);
    expect(proposal.payload.location_key).toBe("shark-fin-cove");
    expect(proposal.payload.place).toMatchObject({ city: "Davenport", county: "Santa Cruz County", search_area: "Santa Cruz" });
    expect(proposal.payload.data.metaTitle).toBe("Shark Fin Cove Couples Photography Guide | Santa Cruz");
    expect(proposal.payload.data.area).toBe("Davenport, Santa Cruz County");
    expect(proposal.payload.needs_verification).toContain("Parking and access details");
    expect(proposal.payload.indexable).toBe(true); // 5 photos ≥ the credibility bar
    expect(await itemsOf(run.pkg, "guide_photo")).toHaveLength(0);
    const prompt = promptText(run.calls[0]);
    expect(prompt).toContain("Santa Cruz County");
    expect(prompt).toMatch(/Do NOT state parking/);
    // clean up so later scenarios start without an open proposal
    await service.from("session_content_items").update({ status: "rejected" }).eq("id", proposal.id);
  });

  it("unverified practical claims in the prose are flagged for manual verification", async () => {
    const run = await runGuideStep("Shark Fin Cove", (ids) => {
      const body = JSON.parse(proposalResponse(ids));
      body.data.accessNote = "Park in the free lot and take the steep trail down";
      body.needs_verification = [];
      return JSON.stringify(body);
    });
    const [proposal] = await itemsOf(run.pkg, "location_guide");
    expect(proposal.payload.needs_verification.join(" ")).toMatch(/accessNote/);
    await service.from("session_content_items").update({ status: "rejected" }).eq("id", proposal.id);
  });
});

describe("Test C — similar scenery, different geography", () => {
  it("a Shark Fin Cove beach session is never linked or keyworded as Ocean Beach / San Francisco", async () => {
    const tags = ["beach", "ocean", "cliffs", "sunset", "sand"];
    const { sessionId, photoIds } = await couplesSession("Shark Fin Cove", { tags, stored: true });
    const pkg = await createPackage(sessionId, ["internal_link_suggestion", "journal_post"], couplesFacts("Shark Fin Cove"));
    const linkCalls: ModelCallRequest[] = [];
    await generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: scriptedModel(() => JSON.stringify({ links: [
        { url: "/couples-guide/locations/ocean-beach", label: "Ocean Beach guide", reason: "also a beach" },
        { url: "/couples-guide", label: "Couples guide", reason: "hub" },
      ] }), linkCalls),
    });
    expect(promptText(linkCalls[0])).not.toContain("/couples-guide/locations/ocean-beach");
    const [links] = await itemsOf(pkg, "internal_link_suggestion");
    expect(links.payload.links.map((l: { url: string }) => l.url)).toEqual(["/couples-guide"]);
    expect(links.payload.pending_guide_links[0]).toMatchObject({ location_key: "shark-fin-cove", slug: SHARK_FIN_SLUG });

    // the exact failure from the Khuong session: an Ocean Beach link written into the body
    await generateContentType({
      client: service, packageId: pkg, contentType: "journal_post",
      callModel: scriptedModel(() => JSON.stringify({
        title: "Golden Hour Couples Session at Shark Fin Cove", slug: "shark-fin-cove-golden-hour",
        body: "Start with the [Bay Area Couples Guide](/couples-guide), and the [Ocean Beach Couples Photoshoot Guide](/couples-guide/locations/ocean-beach) has helpful details too.",
        meta_description: "d", photo_ids: photoIds.slice(0, 3), cover_photo_id: photoIds[0],
      })),
    });
    const [journal] = await itemsOf(pkg, "journal_post");
    expect(journal.payload.body).not.toContain("/couples-guide/locations/ocean-beach");
    expect(journal.payload.body).toContain("[Bay Area Couples Guide](/couples-guide)");
    expect(journal.payload.meta_keywords).toContain("Santa Cruz");
    expect(journal.payload.meta_keywords).not.toMatch(/San Francisco|Ocean Beach/);
    expect(journal.payload.pending_guide_links).toHaveLength(1);
  });
});

describe("Test D — location aliases", () => {
  it("'Shark Fin Beach' reuses a published Shark Fin Cove guide instead of proposing a duplicate", async () => {
    const seed = await couplesSession("Shark Fin Cove", { photos: 1 });
    const { data: guideRow } = await service.from("location_guides").insert({
      guide_type: "couples", slug: SHARK_FIN_SLUG, location_key: "shark-fin-cove",
      place: {}, data: guidePayload(seed.sessionId, seed.photoIds).data, indexable: true, published: true,
    }).select("id").single();

    const { sessionId, photoIds } = await couplesSession("Shark Fin Beach");
    const pkg = await createPackage(sessionId, ["guide_photo"], couplesFacts("Shark Fin Beach"));
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "guide_photo",
      callModel: scriptedModel(() => JSON.stringify({ placements: [{
        session_photo_id: photoIds[0], guide: "couples", location_key: SHARK_FIN_SLUG, alt_text: "a", caption: "c",
      }] })),
    });
    expect(result.outcome).toBe("completed");
    expect((await itemsOf(pkg, "guide_photo"))[0].payload.location_key).toBe(SHARK_FIN_SLUG);
    expect(await itemsOf(pkg, "location_guide")).toHaveLength(0);
    await service.from("location_guides").delete().eq("id", guideRow!.id);
  });

  it("an open proposal from another session blocks a duplicate (no model call)", async () => {
    const first = await couplesSession("Shark Fin Cove");
    const firstPkg = await createPackage(first.sessionId, ["guide_photo"], couplesFacts("Shark Fin Cove"));
    const open = await createItem(firstPkg, "location_guide", guidePayload(first.sessionId, first.photoIds), "draft");

    const run = await runGuideStep("Shark Fin Cove Beach", () => "{}");
    expect(run.result.outcome).toBe("skipped");
    expect(run.calls).toHaveLength(0);
    expect(await itemsOf(run.pkg, "location_guide")).toHaveLength(0);
    await service.from("session_content_items").update({ status: "rejected" }).eq("id", open);
  });
});

describe("Test E — uncertain location", () => {
  it("an unidentified beach with no session location asks for confirmation instead of guessing", async () => {
    const run = await runGuideStep(null, () => "{}", { tags: ["beach", "sea stack", "cliffs"] });
    expect(run.result.outcome).toBe("skipped");
    expect(run.calls).toHaveLength(0);
    const summary = await buildLocationSummary(service, run.sessionId);
    expect(summary).toMatchObject({ status: "needs_confirmation", reason: "missing", place: null });
    expect(summary!.visualHints).toContain("beach");
  });

  it("an unknown name needs confirmation; once confirmed it becomes a verified place", async () => {
    const { sessionId } = await couplesSession("Hidden Cove Test Beach");
    expect((await buildLocationSummary(service, sessionId))!.reason).toBe("unrecognized");
    await confirmNewPlace(service, {
      name: "Hidden Cove Test Beach", city: "Pescadero", county: "San Mateo County", searchArea: "Pescadero",
    }, "Hidden Cove Test Beach");
    const after = await buildLocationSummary(service, sessionId);
    expect(after).toMatchObject({ status: "verified", place: { city: "Pescadero", county: "San Mateo County" } });
    expect(after!.proposedGuide!.url).toBe("/couples-guide/locations/hidden-cove-test-beach-pescadero");
  });
});
