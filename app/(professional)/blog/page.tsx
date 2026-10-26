// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL BLOG PAGE  →  soloxsnaps.com/blog
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import { getBlogPostSummaries, type BlogPostSummary } from "@/lib/professionalData";
import { getJournalServicesByPostId } from "@/lib/blog/journalServices";
import { buildCategoryFilters, resolvePostCategories, type PostCategory } from "@/lib/blog/postCategories";
import BlogIndex from "./BlogIndex";
import type { BlogIndexPost } from "./BlogPostCards";
import { BLOG_INDEX_CSS } from "./blogIndexStyles";
import { BLOG_FILTER_CSS } from "./blogFilterStyles";

// Cached/ISR: rebuilt at most hourly, or immediately when the admin saves a
// post (POST /api/admin/revalidate). Category/sort filters run client-side and
// live in the query string, so every filtered view shares this one cached page
// and its canonical.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Journal",
  description: "Session notes and case studies from soloxsnaps in San Francisco and the Bay Area.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Journal | soloxsnaps",
    description: "Professional photography case studies and session notes from soloxsnaps.",
    type: "website",
  },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

function toIndexPost(post: BlogPostSummary, categories: PostCategory[]): BlogIndexPost {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    description: post.meta_description || "",
    publishedAt: post.published_at,
    dateLabel: formatDate(post.published_at),
    coverUrl: post.cover_image_url,
    coverAlt: post.cover_image_alt || post.title,
    photoCount: (post.extra_image_urls?.length ?? 0) + 1,
    categories: categories.map((c) => c.slug),
  };
}

export default async function ProfessionalBlogPage() {
  const [summaries, engineServices] = await Promise.all([
    getBlogPostSummaries("professional"),
    getJournalServicesByPostId(),
  ]);
  const postCategories = summaries.map((post) =>
    resolvePostCategories(post, engineServices[String(post.id)] ?? null),
  );
  const posts = summaries.map((post, i) => toIndexPost(post, postCategories[i]));
  const filters = buildCategoryFilters(postCategories);

  return (
    <main className="blog-page">
      <style>{BLOG_INDEX_CSS + BLOG_FILTER_CSS}</style>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="blog-hero">
        <div className="blog-shell">
          <div className="blog-hero-kicker">
            <span className="blog-hero-kicker-dot" />
            Journal
          </div>

          <h1 className="blog-hero-heading">
            <span className="blog-hero-title">Session notes</span>
            <span className="blog-hero-title-light">&amp; stories.</span>
          </h1>

          <p className="blog-hero-sub">
            Recent work, notes from sessions, and the quieter details behind the frame.
          </p>

          <span className="blog-hero-rule" />
        </div>
      </section>

      {/* ── POSTS ────────────────────────────────────────────────────────── */}
      <section className="blog-list">
        <div className="blog-shell">
          <BlogIndex posts={posts} filters={filters} />
        </div>
      </section>
    </main>
  );
}
