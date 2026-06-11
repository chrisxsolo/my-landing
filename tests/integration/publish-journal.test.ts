import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto, createPackage, createItem, publish } from "./helpers";

beforeAll(() => resetDb());

describe("journal publisher mapping (spec §9.3)", () => {
  it("maps every staged field, appends Keep exploring, and writes image_library rows atomically", async () => {
    const sessionId = await createTestSession();
    const cover = await createTestPhoto(sessionId, { alt: "Mia under Tower Lawn light" });
    const extra = await createTestPhoto(sessionId, { alt: "Cap toss at SJSU" });
    const pkg = await createPackage(sessionId);
    const slug = `sjsu-mapping-${Date.now()}`;
    const item = await createItem(pkg, "journal_post", {
      title: "Golden Hour at SJSU",
      slug,
      body: "Para one.\n\nPara two.",
      meta_description: "desc",
      meta_keywords: "sjsu, grad",
      photo_ids: [cover.id, extra.id],
      cover_photo_id: cover.id,
      internal_links: [{ url: "/grads/sjsu", label: "SJSU grad sessions" }],
      testimonial_id: null,
    });

    const { data: result, error } = await publish(item);
    expect(error).toBeNull();

    const { data: post } = await service.from("blog_posts").select("*").eq("slug", slug).single();
    expect(post.title).toBe("Golden Hour at SJSU");
    expect(post.category).toBe("professional");
    expect(post.sites).toEqual(["professional"]);
    expect(post.cover_image_url).toBe(cover.public_derivative_url);
    expect(post.cover_image_alt).toBe("Mia under Tower Lawn light");
    expect(post.extra_image_urls).toEqual([extra.public_derivative_url]);
    expect(post.extra_image_alts).toEqual(["Cap toss at SJSU"]);
    expect(post.og_image_url).toBe(cover.public_derivative_url);
    expect(post.meta_description).toBe("desc");
    expect(post.meta_keywords).toBe("sjsu, grad");
    expect(post.body).toContain("Para two.");
    expect(post.body).toContain("Keep exploring");
    expect(post.body).toContain("[SJSU grad sessions](/grads/sjsu)");
    expect(post.published_at).not.toBeNull();

    const { data: lib } = await service
      .from("image_library")
      .select("source_role,image_url,source_type,source_post_slug,in_portfolio")
      .eq("source_post_id", post.id)
      .order("source_role");
    expect(lib).toHaveLength(2);
    expect(lib![0].source_role).toBe("cover");
    expect(lib![0].image_url).toBe(cover.public_derivative_url);
    expect(lib![1].source_role).toBe("gallery");
    expect(lib![0].source_type).toBe("journal");
    expect(lib![0].source_post_slug).toBe(slug);
    expect(lib![0].in_portfolio).toBe(false);

    const { data: published } = await service
      .from("session_content_items")
      .select("status,published_target_type,published_target_id,published_at")
      .eq("id", item).single();
    expect(published!.status).toBe("published");
    expect(published!.published_target_type).toBe("blog_post");
    expect(published!.published_target_id).toBe(String(post.id));
    void result;
  });
});
