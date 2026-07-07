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

  it("couples guide_photo publishes into couples_location_photos with its caption", async () => {
    const sessionId = await createTestSession({ service_type: "couples", school_slug: null });
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["guide_photo"], { service_type: "couples" });
    const item = await createItem(pkg, "guide_photo", {
      session_photo_id: photo.id, guide: "couples", location_key: "lovers-lane",
      alt_text: "Couple on Lovers Lane",
      caption: "Soft light under the eucalyptus — easy walking frames.",
    });
    const result = await publish(item);
    expect(result.error).toBeNull();
    expect((result.data as { target_type: string }).target_type).toBe("couples_location_photo");

    const { data: row } = await service.from("couples_location_photos")
      .select("location_slug,alt_text,caption,published")
      .eq("image_url", photo.public_derivative_url!).single();
    expect(row!.location_slug).toBe("lovers-lane");
    expect(row!.caption).toBe("Soft light under the eucalyptus — easy walking frames.");
    expect(row!.published).toBe(true);
  });

  it("guide_photo without a caption (pre-caption payload) publishes with caption null", async () => {
    const sessionId = await createTestSession({ service_type: "couples", school_slug: null });
    const photo = await createTestPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["guide_photo"], { service_type: "couples" });
    const item = await createItem(pkg, "guide_photo", {
      session_photo_id: photo.id, guide: "couples", location_key: "crissy-field",
      alt_text: "Couple at Crissy Field",
    });
    expect((await publish(item)).error).toBeNull();

    const { data: row } = await service.from("couples_location_photos")
      .select("caption").eq("image_url", photo.public_derivative_url!).single();
    expect(row!.caption).toBeNull();
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
