// The legacy blog-posts admin API: only editable columns reach the row, the
// social image follows the cover (unless set on purpose), every write
// refreshes the public cache, and a revision can be listed and restored.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  pickEditableFields, rejectedFields, withOgImageFollowingCover,
} from "@/lib/blog/postFields";
import { restoreUpdatesFrom, summarizeRevision } from "@/lib/blog/postRevisions";
import { fakeSupabase, type FakeSupabase } from "./support/fakeSupabase";

let fake: FakeSupabase;
const mocks = vi.hoisted(() => ({ revalidated: 0 }));
vi.mock("@/lib/requireAdmin", () => ({ requireAdmin: () => null }));
vi.mock("@/lib/supabaseAdmin", () => ({ createSupabaseAdminClient: () => fake.client }));
vi.mock("@/lib/publicRevalidation", () => ({ revalidatePublicContent: () => { mocks.revalidated += 1; } }));

const posts = await import("@/app/api/admin/blog-posts/route");
const revisions = await import("@/app/api/admin/blog-posts/revisions/route");

const json = (method: string, path: string, body?: unknown) => new NextRequest(`http://localhost${path}`, {
  method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "content-type": "application/json" },
});
const COVER = "https://cdn.example/blog/cover.jpg";
const NEW_COVER = "https://cdn.example/blog/new-cover.jpg";

beforeEach(() => {
  mocks.revalidated = 0;
  fake = fakeSupabase({
    blog_posts: [
      { id: 3, title: "Maya at SJSU", body: "Story.", slug: "sjsu-maya", cover_image_url: COVER, og_image_url: null,
        extra_image_urls: ["https://cdn.example/blog/1.jpg"], sites: ["professional"], created_at: "2026-01-01T00:00:00Z" },
      { id: 4, title: "Arisha", body: "Story.", slug: "sfsu-arisha", cover_image_url: COVER, og_image_url: "https://cdn.example/custom-og.jpg" },
    ],
    blog_post_revisions: [
      { id: 10, post_id: 3, operation: "update", changed_at: "2026-10-26T10:00:00Z",
        snapshot: { id: 3, title: "Maya at SJSU (old title)", body: "Old story.", slug: "sjsu-maya", cover_image_url: COVER,
          og_image_url: null, extra_image_urls: ["https://cdn.example/blog/1.jpg", "https://cdn.example/blog/2.jpg"],
          created_at: "2026-01-01T00:00:00Z", not_a_column: "x" } },
      { id: 11, post_id: 3, operation: "update", changed_at: "2026-10-27T10:00:00Z", snapshot: { id: 3, title: "Maya at SJSU", body: "Story." } },
    ],
  });
});

describe("editable fields", () => {
  it("keeps only blog_posts columns an admin may write", () => {
    expect(pickEditableFields({ title: "t", id: 9, created_at: "x", og_image_url: null, sites: ["professional"] }))
      .toEqual({ title: "t", sites: ["professional"], og_image_url: null });
    expect(rejectedFields({ title: "t", id: 9, created_at: "x" })).toEqual(["id", "created_at"]);
  });

  it("moves the social image with the cover only when it followed the cover before", () => {
    const change = { cover_image_url: NEW_COVER };
    expect(withOgImageFollowingCover({ cover_image_url: COVER, og_image_url: null }, change))
      .toEqual({ cover_image_url: NEW_COVER, og_image_url: NEW_COVER });
    expect(withOgImageFollowingCover({ cover_image_url: COVER, og_image_url: COVER }, change))
      .toEqual({ cover_image_url: NEW_COVER, og_image_url: NEW_COVER });
    expect(withOgImageFollowingCover({ cover_image_url: COVER, og_image_url: "https://cdn.example/custom.jpg" }, change))
      .toEqual(change);
    expect(withOgImageFollowingCover({ cover_image_url: COVER, og_image_url: null }, { ...change, og_image_url: "https://x/y.jpg" }))
      .toEqual({ ...change, og_image_url: "https://x/y.jpg" });
    expect(withOgImageFollowingCover({ cover_image_url: COVER, og_image_url: null }, { title: "t" })).toEqual({ title: "t" });
  });
});

describe("PATCH /api/admin/blog-posts", () => {
  it("rejects a body that names a column outside the allow-list", async () => {
    const res = await posts.PATCH(json("PATCH", "/api/admin/blog-posts", { id: 3, updates: { title: "x", created_at: "1999-01-01" } }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Unknown fields: created_at/);
    expect(fake.ops).toEqual([]);
  });

  it("updates the cover and the social image together, then refreshes the public cache", async () => {
    const res = await posts.PATCH(json("PATCH", "/api/admin/blog-posts", { id: 3, updates: { title: "Maya", cover_image_url: NEW_COVER } }));
    expect(res.status).toBe(200);
    expect(fake.tables.blog_posts[0]).toMatchObject({ title: "Maya", cover_image_url: NEW_COVER, og_image_url: NEW_COVER });
    expect(mocks.revalidated).toBe(1);
  });

  it("leaves a deliberately different social image alone", async () => {
    await posts.PATCH(json("PATCH", "/api/admin/blog-posts", { id: 4, updates: { cover_image_url: NEW_COVER } }));
    expect(fake.tables.blog_posts[1]).toMatchObject({ cover_image_url: NEW_COVER, og_image_url: "https://cdn.example/custom-og.jpg" });
  });

  it("404s for a missing post without touching anything", async () => {
    const res = await posts.PATCH(json("PATCH", "/api/admin/blog-posts", { id: 99, updates: { title: "x" } }));
    expect(res.status).toBe(404);
    expect(mocks.revalidated).toBe(0);
  });
});

describe("POST and DELETE /api/admin/blog-posts", () => {
  it("inserts the post, seeds the social image from the cover and revalidates", async () => {
    const res = await posts.POST(json("POST", "/api/admin/blog-posts", {
      title: "New", body: "Body", slug: "new", cover_image_url: COVER,
    }));
    expect(res.status).toBe(201);
    expect(fake.tables.blog_posts.at(-1)).toMatchObject({ title: "New", cover_image_url: COVER, og_image_url: COVER });
    expect(mocks.revalidated).toBe(1);
  });

  it("refuses to insert columns outside the allow-list", async () => {
    const res = await posts.POST(json("POST", "/api/admin/blog-posts", { title: "New", body: "Body", id: 1, created_at: "x" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Unknown fields: id, created_at/);
    expect(fake.tables.blog_posts).toHaveLength(2);
  });

  it("deletes and revalidates", async () => {
    const res = await posts.DELETE(json("DELETE", "/api/admin/blog-posts?id=4"));
    expect(res.status).toBe(200);
    expect(fake.tables.blog_posts.map((p) => p.id)).toEqual([3]);
    expect(mocks.revalidated).toBe(1);
  });
});

describe("revisions", () => {
  it("summarizes a snapshot for the list", () => {
    expect(summarizeRevision(fake.tables.blog_post_revisions[0] as never)).toEqual({
      id: 10, operation: "update", changedAt: "2026-10-26T10:00:00Z", title: "Maya at SJSU (old title)", slug: "sjsu-maya",
      coverImageUrl: COVER, ogImageUrl: null, galleryCount: 2, bodyLength: 10,
    });
  });

  it("restores only editable columns from a snapshot", () => {
    const updates = restoreUpdatesFrom(fake.tables.blog_post_revisions[0].snapshot as Record<string, unknown>);
    expect(Object.keys(updates)).toEqual(["title", "body", "slug", "cover_image_url", "extra_image_urls", "og_image_url"]);
  });

  it("GET lists a post's revisions newest first", async () => {
    const res = await revisions.GET(json("GET", "/api/admin/blog-posts/revisions?id=3"));
    expect(res.status).toBe(200);
    expect((await res.json()).revisions.map((r: { id: number }) => r.id)).toEqual([11, 10]);
  });

  it("POST restores a revision onto the post and revalidates", async () => {
    const res = await revisions.POST(json("POST", "/api/admin/blog-posts/revisions", { postId: 3, revisionId: 10 }));
    expect(res.status).toBe(200);
    expect(fake.tables.blog_posts[0]).toMatchObject({
      title: "Maya at SJSU (old title)", body: "Old story.", created_at: "2026-01-01T00:00:00Z", sites: ["professional"],
    });
    expect(fake.tables.blog_posts[0].not_a_column).toBeUndefined();
    expect(mocks.revalidated).toBe(1);
  });

  it("POST refuses a revision that belongs to another post", async () => {
    const res = await revisions.POST(json("POST", "/api/admin/blog-posts/revisions", { postId: 4, revisionId: 10 }));
    expect(res.status).toBe(404);
    expect(mocks.revalidated).toBe(0);
  });
});
