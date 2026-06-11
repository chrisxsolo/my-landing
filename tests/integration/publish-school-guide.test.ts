import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem, publish } from "./helpers";

beforeAll(() => resetDb());

describe("school, guide, and testimonial publishers", () => {
  it("school_page_photo inserts and reconciles on the unique constraint", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const payload = { session_photo_id: photo.id, school_slug: "sjsu", alt_override: "", caption: "", sort_order: 1 };
    const a = await createItem(pkg, "school_page_photo", payload);
    expect((await publish(a)).error).toBeNull();

    const { data: row } = await service.from("school_page_photos")
      .select("id,school_slug,session_photo_id,active").eq("session_photo_id", photo.id).single();
    expect(row!.school_slug).toBe("sjsu");
    expect(row!.active).toBe(true);
  });

  it("guide_photo concurrency: advisory lock yields exactly one row", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId);
    const payload = { session_photo_id: photo.id, guide: "family", location_key: "baker-beach", alt_text: "Family at Baker Beach" };
    const a = await createItem(pkg, "guide_photo", payload);
    const b = await createItem(pkg, "guide_photo", payload);
    await Promise.allSettled([publish(a), publish(b)]);

    const { count } = await service.from("family_location_photos")
      .select("id", { count: "exact", head: true })
      .eq("location_slug", "baker-beach").eq("image_url", photo.public_derivative_url!);
    expect(count).toBe(1);
  });

  it("testimonial_feature links the testimonial to the session", async () => {
    const sessionId = await createTestSession();
    const { data: t } = await service.from("testimonials").insert({
      first_name: "Mia", last_name: "R", message: "Chris made the whole session feel easy and fun!",
      consent_to_marketing: true, status: "approved",
    }).select("id").single();
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "testimonial_feature", { testimonial_id: t!.id, quote_excerpt: "easy and fun" });
    expect((await publish(item)).error).toBeNull();

    const { data: after } = await service.from("testimonials")
      .select("photography_session_id").eq("id", t!.id).single();
    expect(after!.photography_session_id).toBe(sessionId);
  });
});
