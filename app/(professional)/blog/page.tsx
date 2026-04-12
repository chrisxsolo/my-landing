import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPostsByCategory } from "@/lib/professionalData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog | soloxsnaps",
  description: "Session notes and case studies from soloxsnaps in San Francisco and the Bay Area.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Blog | soloxsnaps",
    description: "Professional photography case studies and session notes from soloxsnaps.",
    type: "website",
  },
};

function excerpt(body: string, max = 160) {
  return body.length > max ? `${body.slice(0, max).trim()}…` : body;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

const CSS = `
  .blog-row { text-decoration: none; display: block; transition: opacity 0.2s ease; }
  .blog-row:hover { opacity: 0.72; }
  .blog-cover { overflow: hidden; }
  .blog-cover-img { transition: transform 0.7s ease; display: block; }
  .blog-row:hover .blog-cover-img { transform: scale(1.04); }
  .blog-row:not(:last-child) { border-bottom: 1px solid rgba(0,0,0,0.07); }
  @media (max-width: 720px) {
    .blog-row-inner { grid-template-columns: 1fr !important; }
    .blog-num { display: none !important; }
  }
`;

export default async function ProfessionalBlogPage() {
  const posts = await getBlogPostsByCategory("professional");

  return (
    <main style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <section style={{ padding: "80px 60px 80px", textAlign: "center" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.7rem",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: "#bbb",
          marginBottom: 20,
        }}>
          Blog
        </p>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(2rem, 5.5vw, 5rem)",
          fontWeight: 300,
          letterSpacing: "0.06em",
          color: "#111",
          lineHeight: 1.1,
          margin: "0 auto 28px",
          maxWidth: 700,
        }}>
          Session notes &amp; stories.
        </h1>
        <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.12)", margin: "0 auto 28px" }} />
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontStyle: "italic",
          fontSize: "1rem",
          color: "#aaa",
          maxWidth: 480,
          margin: "0 auto",
          lineHeight: 1.7,
        }}>
          Recent work, notes from professional sessions, and the quieter details behind the frame.
        </p>
      </section>

      {/* ── POST LIST ── */}
      <section style={{ padding: "0 60px 100px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)" }}>
          {posts.length > 0 ? (
            posts.map((post, index) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="blog-row">
                <div className="blog-row-inner" style={{
                  display: "grid",
                  gridTemplateColumns: "60px 1fr 1.1fr",
                  gap: "40px",
                  alignItems: "center",
                  padding: "48px 0",
                }}>
                  {/* Number */}
                  <p className="blog-num" style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "2rem",
                    fontWeight: 300,
                    color: "#e8e8e8",
                    margin: 0,
                    lineHeight: 1,
                  }}>
                    {String(index + 1).padStart(2, "0")}
                  </p>

                  {/* Cover */}
                  <div className="blog-cover" style={{ aspectRatio: "4/3" }}>
                    {post.cover_image_url ? (
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="blog-cover-img"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "#f5f5f5" }} />
                    )}
                  </div>

                  {/* Text */}
                  <div>
                    <p style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontSize: "0.68rem",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "#ccc",
                      marginBottom: 16,
                    }}>
                      {formatDate(post.published_at)}
                    </p>
                    <h2 style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontSize: "clamp(1.2rem, 2vw, 1.7rem)",
                      fontWeight: 400,
                      letterSpacing: "0.03em",
                      color: "#111",
                      margin: "0 0 16px",
                      lineHeight: 1.3,
                    }}>
                      {post.title}
                    </h2>
                    <p style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontSize: "0.9rem",
                      lineHeight: 1.75,
                      color: "#999",
                      marginBottom: 20,
                    }}>
                      {excerpt(post.meta_description || post.body)}
                    </p>
                    <span style={{
                      fontFamily: "Georgia, 'Times New Roman', serif",
                      fontStyle: "italic",
                      fontSize: "0.88rem",
                      color: "#bbb",
                      borderBottom: "1px solid rgba(0,0,0,0.15)",
                      paddingBottom: 1,
                    }}>
                      Read the story →
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div style={{
              padding: "80px 0",
              textAlign: "center",
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: "italic",
              color: "#ccc",
              fontSize: "1.05rem",
            }}>
              No case studies yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
