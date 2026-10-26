// End-to-end checks for the page photo pool against the real schema: a newly
// published session reaches its school page, school changes move it, hides and
// exclusions remove it, repeated runs never duplicate, and nothing unapproved
// is ever offered. Replaces the old school-gallery test (explicit placements
// are now one source of the pool).
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem, publish } from "./helpers";
import { loadPhotoPool } from "@/lib/pagePhotos/pool";
import { buildPageView } from "@/lib/pagePhotos/adminView";
import { applyCuration, setPortfolioSchool } from "@/lib/pagePhotos/curationStore";

beforeAll(() => resetDb());

async function publishPortfolioPick(sessionId: string, title = "Grad portrait") {
  const photo = await createTestPhoto(sessionId, { alt: `${title} alt` });
  const pkg = await createPackage(sessionId, ["portfolio_pick"], { service_type: "grads" }, true);
  const item = await createItem(pkg, "portfolio_pick", {
    session_photo_id: photo.id, category: "grads", title, alt_text: `${title} alt`, description: "", featured: false,
  });
  const { error } = await publish(item);
  if (error) throw error;
  return photo;
}

const pagesOf = async (url: string | null) =>
  (await loadPhotoPool(service)).photos.find((p) => p.url === url)?.pages ?? null;

describe("page photo pool", () => {
  it("reads every source without errors", async () => {
    expect((await loadPhotoPool(service)).errors).toEqual([]);
  });

  it("a newly published grads session reaches its school page automatically (Test D)", async () => {
    const sessionId = await createTestSession({ school_slug: "sjsu" });
    const photo = await publishPortfolioPick(sessionId);
    expect(await pagesOf(photo.public_derivative_url)).toEqual(["grads/sjsu"]);
    const view = await buildPageView(service, "grads/sjsu");
    expect(view!.shown.map((p) => p.url)).toContain(photo.public_derivative_url);
  });

  it("changing the session's school moves its photos with no stale association (Test F)", async () => {
    const sessionId = await createTestSession({ school_slug: "sjsu" });
    const photo = await publishPortfolioPick(sessionId);
    await service.from("photography_sessions").update({ school_slug: "uc-berkeley" }).eq("id", sessionId);
    expect(await pagesOf(photo.public_derivative_url)).toEqual(["grads/uc-berkeley"]);
    const sjsu = await buildPageView(service, "grads/sjsu");
    expect([...sjsu!.shown, ...sjsu!.overflow].map((p) => p.url)).not.toContain(photo.public_derivative_url);
  });

  it("hiding on one page persists and leaves other pages alone; excluding removes it (Test E)", async () => {
    const sessionId = await createTestSession({ school_slug: "stanford" });
    const photo = await publishPortfolioPick(sessionId);
    const url = photo.public_derivative_url as string;

    await applyCuration(service, "grads/stanford", url, "hide");
    const hidden = await buildPageView(service, "grads/stanford");
    expect(hidden!.hidden.map((p) => p.url)).toContain(url);
    expect(hidden!.shown.map((p) => p.url)).not.toContain(url);
    // still public in the portfolio
    expect(await pagesOf(url)).toEqual(["grads/stanford"]);

    await applyCuration(service, "grads/stanford", url, "unhide");
    await service.from("session_photos").update({ excluded: true }).eq("id", photo.id);
    expect(await pagesOf(url)).toEqual([]);
  });

  it("unpublishing the portfolio photo removes it from every page", async () => {
    const sessionId = await createTestSession({ school_slug: "usf" });
    const photo = await publishPortfolioPick(sessionId);
    await service.from("portfolio_images").update({ published: false }).eq("image_url", photo.public_derivative_url);
    expect(await pagesOf(photo.public_derivative_url)).toBeNull();
  });

  it("never offers photos from sessions without marketing permission (Test H)", async () => {
    const sessionId = await createTestSession({ school_slug: "csueb" });
    const photo = await publishPortfolioPick(sessionId);
    await service.from("photography_sessions").update({ marketing_permission: false }).eq("id", sessionId);
    const pool = await loadPhotoPool(service);
    const resolved = pool.photos.find((p) => p.url === photo.public_derivative_url);
    expect(resolved?.eligible).toBe(false);
    expect(resolved?.pages).toEqual([]);
  });

  it("running repeatedly never duplicates; pins and heroes stay single rows (Test G)", async () => {
    const sessionId = await createTestSession({ school_slug: "santa-clara" });
    const a = await publishPortfolioPick(sessionId, "A");
    const b = await publishPortfolioPick(sessionId, "B");
    const urlA = a.public_derivative_url as string;
    const urlB = b.public_derivative_url as string;

    const first = await buildPageView(service, "grads/santa-clara");
    const second = await buildPageView(service, "grads/santa-clara");
    expect(second!.shown.map((p) => p.url)).toEqual(first!.shown.map((p) => p.url));

    await applyCuration(service, "grads/santa-clara", urlB, "pin");
    await applyCuration(service, "grads/santa-clara", urlB, "pin");
    await applyCuration(service, "grads/santa-clara", urlA, "hero");
    await applyCuration(service, "grads/santa-clara", urlB, "hero");
    const { data: rows } = await service.from("page_photo_curation").select("image_url,is_hero").eq("page_key", "grads/santa-clara");
    expect(rows).toHaveLength(2);
    expect(rows!.filter((r) => r.is_hero).map((r) => r.image_url)).toEqual([urlB]);

    const view = await buildPageView(service, "grads/santa-clara");
    expect(view!.shown[0].url).toBe(urlB);
  });

  it("an explicit school tag on a legacy portfolio photo places it", async () => {
    const { data } = await service.from("portfolio_images").insert({
      title: "Graduation portrait", alt: "Graduation portrait", image_url: "https://example.com/legacy-tag.jpg",
      category_slug: "graduation", featured: false, sort_order: 1,
    }).select("id").single();
    expect(await pagesOf("https://example.com/legacy-tag.jpg")).toEqual([]);
    await setPortfolioSchool(service, data!.id as number, "sf-state");
    expect(await pagesOf("https://example.com/legacy-tag.jpg")).toEqual(["grads/sf-state"]);
  });

  it("includes active school placements in order, with alt overrides, and skips inactive ones", async () => {
    const sessionId = await createTestSession();
    const first = await createTestPhoto(sessionId);
    const second = await createTestPhoto(sessionId);
    const inactive = await createTestPhoto(sessionId);
    await service.from("school_page_photos").insert([
      { school_slug: "stanford", session_photo_id: second.id, sort_order: 2, active: true },
      { school_slug: "stanford", session_photo_id: first.id, sort_order: 1, active: true, alt_override: "Override alt" },
      { school_slug: "stanford", session_photo_id: inactive.id, sort_order: 0, active: false },
    ]);
    const pool = await loadPhotoPool(service);
    const placed = pool.explicitSchool.filter((s) => s.schoolSlug === "stanford").sort((x, y) => x.sortOrder - y.sortOrder);
    expect(placed.map((s) => s.url)).toEqual([first.public_derivative_url, second.public_derivative_url]);
    expect(placed[0].alt).toBe("Override alt");
  });
});
