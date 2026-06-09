// BLOG CATEGORY ARCHIVE  →  /blog/category/[category]
// Crawlable category page that lives inside the existing /blog system (does not
// touch /blog or /blog/[slug]). Only curated categories in BLOG_CATEGORIES get a
// page (generateStaticParams + dynamicParams=false), so no arbitrary thin URLs.
// While a category has no posts yet it renders a tasteful empty state and is
// noindex (excluded from the sitemap too); it becomes indexable once posts exist.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { getBlogPostSummariesForCategory } from "@/lib/professionalData";
import { getBlogCategory, getBlogCategorySlugs } from "@/lib/familyGuide/journal";
import { FAMILY_GUIDE_CSS } from "@/lib/familyGuide/styles";

export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return getBlogCategorySlugs().map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = getBlogCategory(category);
  if (!cat) return {};
  const path = `/blog/category/${cat.slug}`;
  const posts = await getBlogPostSummariesForCategory(cat.slug);
  return {
    title: cat.title,
    description: cat.description,
    alternates: { canonical: path },
    // Thin while empty: keep out of the index until there's at least one post.
    ...(posts.length === 0 ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title: `${cat.title} | SoloXSnaps`, description: cat.description, url: path, type: "website", siteName: "soloxsnaps" },
    twitter: { card: "summary_large_image", title: `${cat.title} | SoloXSnaps`, description: cat.description },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function BlogCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = getBlogCategory(category);
  if (!cat) notFound();

  const posts = await getBlogPostSummariesForCategory(cat.slug);
  const path = `/blog/category/${cat.slug}`;
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: cat.title, path },
  ]);

  return (
    <main className="fg-page">
      <style>{FAMILY_GUIDE_CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />

      <nav className="fg-crumbs fg-shell" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li><Link href="/blog">Blog</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li aria-current="page">{cat.title}</li>
        </ol>
      </nav>

      <section className="fg-hero" style={{ paddingTop: 28 }}>
        <div className="fg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="fg-kicker"><span className="fg-kicker-dot" /> Journal</p>
          <h1 className="fg-h1">{cat.title}</h1>
          <p className="fg-sub">{cat.intro}</p>
          {cat.family && (
            <div className="fg-actions">
              <Link href="/family-guide" className="fg-btn fg-btn--primary">Family photography guide →</Link>
              <Link href="/family-guide/locations" className="fg-btn fg-btn--ghost">Family photo locations</Link>
            </div>
          )}
        </div>
      </section>

      <section className="fg-section">
        <div className="fg-shell--wide">
          {posts.length > 0 ? (
            <div className="fg-locs">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`} className="fg-loc" data-reveal data-delay="1">
                  <div className="fg-loc-media">
                    {post.cover_image_url ? (
                      <OptimizedPhoto src={post.cover_image_url} alt={post.cover_image_alt || post.title} sizes="(max-width: 760px) 100vw, 33vw" />
                    ) : (
                      <div className="fg-loc-ph"><span aria-hidden="true">📓</span><p>SoloXSnaps</p></div>
                    )}
                  </div>
                  <div className="fg-loc-body">
                    <p className="fg-loc-area">{formatDate(post.published_at)}</p>
                    <h2 className="fg-loc-title">{post.title}</h2>
                    {post.meta_description && <p className="fg-loc-desc">{post.meta_description}</p>}
                    <span className="fg-loc-link">Read the story →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="fg-empty" data-reveal>
              <p style={{ fontSize: 34, margin: "0 0 10px" }} aria-hidden="true">📓</p>
              <p style={{ fontWeight: 760, color: "var(--ink)", marginBottom: 6 }}>Family journal posts are on the way.</p>
              <p style={{ color: "var(--ink-muted)" }}>
                In the meantime, explore the{" "}
                <Link href="/family-guide" className="fg-inline-link">family photography guide</Link>.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
