import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogPostBySlug } from "@/lib/professionalData";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug("professional", slug);
  if (!post) return { title: "Not Found | soloxsnaps" };
  const description = post.meta_description || (post.body.length > 155 ? `${post.body.slice(0, 155).trim()}…` : post.body);
  return {
    title: `${post.title} | soloxsnaps`,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.published_at,
    image: [post.cover_image_url, ...extraImages].filter(Boolean),
    author: { "@type": "Person", name: "Chris Solorzano" },
    publisher: { "@type": "Organization", name: "soloxsnaps" },
  };

  return (
    <main style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <style>{CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
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
          <div style={{ overflow: "hidden", maxHeight: 780 }}>
            <img
              src={post.cover_image_url}
              alt={post.title}
              style={{ width: "100%", maxHeight: 780, objectFit: "cover", display: "block" }}
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
          {post.body
            .split(/\n\n+/)
            .filter((p) => p.trim())
            .map((paragraph, i) => (
              <p key={i} style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "1.05rem",
                lineHeight: 1.9,
                color: "#555",
                marginBottom: 24,
              }}>
                {paragraph.trim()}
              </p>
            ))}
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
                }}>
                  <img
                    src={url}
                    alt={`${post.title} — image ${i + 1}`}
                    className="slug-extra-img"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section style={{
        borderTop: "1px solid rgba(0,0,0,0.07)",
        padding: "80px 60px",
        textAlign: "center",
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
          color: "#005f5f",
          background: "rgba(230, 251, 248, 0.95)",
          border: "1px solid rgba(0, 166, 166, 0.3)",
          borderRadius: 8,
          boxShadow: "0 10px 24px rgba(0, 166, 166, 0.08)",
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
