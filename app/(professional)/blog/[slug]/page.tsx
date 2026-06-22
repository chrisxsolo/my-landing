import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/lib/professionalData";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { renderPostBody } from "./postBody";
import { detectSchoolLink } from "@/lib/portfolioCategoryContent";
import ContentEventBeacon from "@/app/components/ContentEventBeacon";

// Cached/ISR: rebuilt at most hourly, or immediately on admin post saves
// (POST /api/admin/revalidate).
export const revalidate = 3600;

type Props = { params: Promise<{ slug: string }> };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug("professional", slug);
  if (!post) return { title: "Not Found" };
  const description = post.meta_description || (post.body.length > 155 ? `${post.body.slice(0, 155).trim()}…` : post.body);
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    keywords: post.meta_keywords ?? undefined,
    openGraph: {
      title: post.title, description, type: "article",
      publishedTime: post.published_at,
      images: post.og_image_url || post.cover_image_url
        ? [post.og_image_url || post.cover_image_url || ""] : undefined,
    },
  };
}

const CSS = `
  .slug-extra { overflow: hidden; }
  .slug-extra-img { transition: transform 0.7s ease; display: block; }
  .slug-extra:hover .slug-extra-img { transform: scale(1.03); }
  @media (max-width: 720px) {
    .slug-body-grid { grid-template-columns: 1fr !important; }
    .slug-aside { display: none !important; }
    .slug-extra-grid { columns: 1 !important; }
  }
  @media (min-width: 640px) { .slug-extra-grid { columns: 2; } }
  @media (min-width: 1024px) { .slug-extra-grid { columns: 3; } }
`;

export default async function ProfessionalBlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPostBySlug("professional", slug);
  if (!post) notFound();

  const extraImages = post.extra_image_urls ?? [];
  const schoolLink = detectSchoolLink(`${post.title} ${post.slug}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.published_at,
    image: [post.cover_image_url, ...extraImages].filter(Boolean),
    author: { "@type": "Person", name: "Chris Solorzano" },
    publisher: { "@type": "Organization", name: "soloxsnaps" },
  };

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: post.title, path: `/blog/${post.slug}` },
  ]);

  return (
    <main style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <ContentEventBeacon contentType="blog_post" contentId={post.slug} target={{ type: "blog_post", id: String(post.id) }} />
      <style>{CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
      />

      {/* ── HEADER ── */}
      <header style={{ padding: "60px 60px 48px", textAlign: "center", maxWidth: 900, margin: "0 auto" }}>
        <Link href="/blog" style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.7rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "#555",
          textDecoration: "none",
          borderBottom: "1px solid rgba(0,0,0,0.12)",
          paddingBottom: 1,
        }}>
          ← Back to blog
        </Link>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.68rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#555",
          margin: "32px 0 16px",
        }}>
          {formatDate(post.published_at)}
        </p>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(1.8rem, 5vw, 4.5rem)",
          fontWeight: 300,
          letterSpacing: "0.05em",
          color: "#111",
          lineHeight: 1.12,
          margin: "0 auto 32px",
        }}>
          {post.title}
        </h1>
        <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.12)", margin: "0 auto" }} />
      </header>

      {/* ── COVER IMAGE ── */}
      {post.cover_image_url && (
        <div style={{ padding: "0 20px 80px", maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ position: "relative", overflow: "hidden", maxHeight: 780, aspectRatio: "4/3" }}>
            <Image
              src={post.cover_image_url}
              alt={post.cover_image_alt || post.title}
              fill
              sizes="(max-width: 1400px) 100vw, 1400px"
              style={{ objectFit: "cover" }}
              priority
              quality={90}
            />
          </div>
        </div>
      )}

      {/* ── BODY ── */}
      <div className="slug-body-grid" style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: "60px",
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 60px 100px",
      }}>
        <aside className="slug-aside">
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "0.68rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#555",
            marginBottom: 16,
          }}>
            Details
          </p>
          <p style={{
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontStyle: "italic",
            fontSize: "0.88rem",
            lineHeight: 1.7,
            color: "#555",
          }}>
            Bay Area photography by Chris Solorzano.
          </p>
        </aside>
        <div>
          {renderPostBody(post.body)}
        </div>
      </div>

      {/* ── EXTRA IMAGES ── */}
      {extraImages.length > 0 && (
        <section style={{
          borderTop: "1px solid rgba(0,0,0,0.07)",
          padding: "80px 20px 100px",
        }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              marginBottom: 48,
              padding: "0 40px",
            }}>
              <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.7rem",
                letterSpacing: "0.26em",
                textTransform: "uppercase",
                color: "#555",
                margin: 0,
                flexShrink: 0,
              }}>
                More from this story
              </p>
              <div style={{ flex: 1, height: 1, background: "rgba(0,0,0,0.07)" }} />
            </div>
            <div className="slug-extra-grid" style={{ columnGap: 8 }}>
              {extraImages.map((url, i) => (
                <div key={url} className="slug-extra" style={{
                  marginBottom: 8,
                  breakInside: "avoid",
                  aspectRatio: i % 2 === 0 ? "4/5" : "5/4",
                  position: "relative",
                }}>
                  <Image
                    src={url}
                    alt={post.extra_image_alts?.[i] || `${post.title} — image ${i + 1}`}
                    className="slug-extra-img"
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    style={{ objectFit: "cover" }}
                    quality={85}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── INTERNAL LINKS — keep exploring ── */}
      <section style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "64px 60px 0",
        maxWidth: 900,
        margin: "0 auto",
      }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.7rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#555",
          marginBottom: 18,
        }}>
          Keep exploring
        </p>
        <ul style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px 14px",
          listStyle: "none",
          padding: 0,
          margin: 0,
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}>
          {[
            ...(schoolLink ? [schoolLink] : []),
            { label: "Graduation pricing", href: "/pricing/grads" },
            { label: "Check availability", href: "/availability" },
            { label: "Graduation photo guide", href: "/grad-guide" },
            { label: "Bay Area campus spots", href: "/grad-guide/campus-spots" },
            { label: "Contact", href: "/contact" },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} style={{
                display: "inline-block",
                fontSize: "0.85rem",
                color: "#4f6d67",
                background: "rgba(246, 250, 248, 0.94)",
                border: "1px solid rgba(112, 139, 133, 0.22)",
                borderRadius: 999,
                padding: "8px 18px",
                textDecoration: "none",
              }}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ── CTA ── */}
      <section style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "80px 60px",
        textAlign: "center",
        marginTop: 64,
      }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: "clamp(1rem, 2vw, 1.3rem)",
          color: "#555",
          marginBottom: 32,
        }}>
          Want to create something like this?
        </p>
        <Link href="/contact" style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.75rem",
          letterSpacing: 0,
          color: "#4f6d67",
          background: "rgba(246, 250, 248, 0.94)",
          border: "1px solid rgba(112, 139, 133, 0.22)",
          borderRadius: 8,
          boxShadow: "0 10px 24px rgba(112, 139, 133, 0.05)",
          padding: "14px 36px",
          textDecoration: "none",
          display: "inline-block",
          fontWeight: 820,
        }}>
          Inquire now
        </Link>
      </section>
    </main>
  );
}
