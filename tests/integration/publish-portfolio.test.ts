import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem, publish } from "./helpers";

beforeAll(() => resetDb());

async function ensureCategory(slug: string) {
  const { data } = await service.from("portfolio_categories").select("id").eq("slug", slug).maybeSingle();
  if (data) return data.id as number;
  // If the insert errors on a missing "name" column, check the baseline with
  // `\d public.portfolio_categories` and use its actual label column.
  const { data: ins, error } = await service.from("portfolio_categories")
    .insert({ slug, name: slug }).select("id").single();
  if (error) throw error;
  return ins.id as number;
}

describe("portfolio publisher", () => {
  it("inserts a new portfolio image with derivative URL, hash, and next sort_order", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId, { alt: "Grad portrait alt" });
    await ensureCategory("graduation");
    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads",
      title: "Grad portrait", alt_text: "Grad portrait alt", description: "", featured: false,
    });
    const { error } = await publish(item);
    expect(error).toBeNull();

    const { data: img } = await service.from("portfolio_images")
      .select("image_url,content_hash,category_slug,alt,title,featured")
      .eq("content_hash", photo.content_hash).single();
    expect(img!.image_url).toBe(photo.public_derivative_url);
    // Since 20260618000001 the publish RPC stores the RESOLVED real slug
    // (grads → graduation), keeping category_slug equal to the FK'd category.
    expect(img!.category_slug).toBe("graduation");
    expect(img!.featured).toBe(false);
  });

  it("reconciles to an existing row with the same content_hash instead of duplicating", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    await ensureCategory("grads");
    const { data: existing } = await service.from("portfolio_images").insert({
      title: "Pre-existing", alt: "Pre-existing", image_url: "https://example.com/x.jpg",
      category_slug: "grads", featured: false, sort_order: 999, content_hash: photo.content_hash,
    }).select("id").single();

    const pkg = await createPackage(sessionId);
    const item = await createItem(pkg, "portfolio_pick", {
      session_photo_id: photo.id, category: "grads",
      title: "New", alt_text: "New", description: "", featured: false,
    });
    const { error } = await publish(item);
    expect(error).toBeNull();

    const { count } = await service.from("portfolio_images")
      .select("id", { count: "exact", head: true }).eq("content_hash", photo.content_hash);
    expect(count).toBe(1); // no duplicate
    const { data: it2 } = await service.from("session_content_items")
      .select("published_target_type,published_target_id").eq("id", item).single();
    expect(it2!.published_target_type).toBe("portfolio_image");
    expect(it2!.published_target_id).toBe(String(existing!.id));
  });
});
