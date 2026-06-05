// ─────────────────────────────────────────────────────────────────────────────
// PROFESSIONAL BLOG PAGE  →  soloxsnaps.com/blog
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPostsByCategory } from "@/lib/professionalData";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";

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

function excerpt(body: string, max = 140) {
  return body.length > max ? `${body.slice(0, max).trim()}…` : body;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

const CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { transform: scaleX(0); opacity: 0; }
    to   { transform: scaleX(1); opacity: 1; }
  }
  @keyframes pillFade {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── PAGE ─────────────────────────────────────────────────────────────────── */
  .blog-page {
    background: #f7faf8;
    color: var(--ink);
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    padding-top: 90px;
  }
  .blog-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }

  /* ── HERO ─────────────────────────────────────────────────────────────────── */
  .blog-hero {
    padding: 88px 0 80px;
    background:
      radial-gradient(ellipse 65% 60% at 5% 10%, rgba(162, 210, 196, 0.17) 0%, transparent 60%),
      radial-gradient(ellipse 55% 50% at 95% 90%, rgba(130, 185, 175, 0.13) 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 60% 0%,  rgba(200, 230, 220, 0.10) 0%, transparent 50%),
      linear-gradient(to bottom, #e8efec 0%, #f7faf8 100%);
    border-bottom: 1px solid rgba(18, 24, 22, 0.07);
    position: relative;
    overflow: hidden;
  }

  /* Decorative corner marks */
  .blog-hero::before,
  .blog-hero::after {
    content: "";
    position: absolute;
    width: 18px; height: 18px;
    opacity: 0.35;
  }
  .blog-hero::before {
    top: 28px; left: 28px;
    border-top: 1.5px solid #3d6b5e;
    border-left: 1.5px solid #3d6b5e;
  }
  .blog-hero::after {
    bottom: 28px; right: 28px;
    border-bottom: 1.5px solid #3d6b5e;
    border-right: 1.5px solid #3d6b5e;
  }

  .blog-hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 22px;
    padding: 7px 16px;
    border: 1px solid rgba(61, 107, 94, 0.18);
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    box-shadow: 0 2px 12px rgba(61, 107, 94, 0.08);
    color: var(--ink-dim);
    font-size: 12px;
    font-weight: 820;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    animation: pillFade 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }
  .blog-hero-kicker-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #3d6b5e;
    flex-shrink: 0;
    box-shadow: 0 0 0 3px rgba(61,107,94,0.15);
  }
  .blog-hero-heading {
    margin: 0;
    animation: fadeUp 0.6s 0.08s cubic-bezier(0.22,1,0.36,1) both;
  }
  .blog-hero-title {
    display: block;
    font-size: clamp(3.8rem, 9.5vw, 8.5rem);
    font-weight: 900;
    letter-spacing: -0.045em;
    line-height: 0.87;
    color: var(--ink);
  }
  .blog-hero-title-light {
    display: block;
    font-size: clamp(3.8rem, 9.5vw, 8.5rem);
    font-weight: 280;
    font-style: italic;
    letter-spacing: -0.03em;
    line-height: 0.96;
    color: var(--ink-muted);
    padding-bottom: 4px;
  }
  .blog-hero-sub {
    margin: 24px 0 0;
    max-width: 420px;
    color: var(--ink-muted);
    font-size: 16px;
    line-height: 1.8;
    animation: fadeUp 0.6s 0.16s cubic-bezier(0.22,1,0.36,1) both;
  }
  .blog-hero-rule {
    display: block;
    width: 32px;
    height: 2px;
    background: #3d6b5e;
    margin: 28px 0 0;
    transform-origin: left center;
    animation: scaleIn 0.7s 0.3s cubic-bezier(0.22,1,0.36,1) both;
  }

  /* ── POST LIST SECTION ────────────────────────────────────────────────────── */
  .blog-list {
    padding: 72px 0 120px;
  }

  /* ── FEATURED CARD (first post, 2-col) ───────────────────────────────────── */
  .blog-featured {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    background: var(--bg-white);
    overflow: hidden;
    box-shadow: var(--glass-shadow);
    text-decoration: none;
    color: inherit;
    margin-bottom: 16px;
    transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
  }
  .blog-featured:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 48px rgba(18, 24, 22, 0.1);
    border-color: rgba(18, 24, 22, 0.13);
  }

  .blog-featured-media {
    position: relative;
    overflow: hidden;
    background: #dfe8e4;
    min-height: 440px;
    max-height: 540px;
  }
  .blog-featured-media img {
    width: 100%; height: 100%;
    display: block; object-fit: cover;
    transition: transform 0.8s cubic-bezier(0.22,1,0.36,1);
  }
  .blog-featured:hover .blog-featured-media img { transform: scale(1.04); }

  .blog-featured-media-empty {
    width: 100%; height: 100%; min-height: 440px;
    background:
      radial-gradient(ellipse 70% 70% at 50% 50%, rgba(162,210,196,0.2) 0%, transparent 70%),
      #e8efec;
    display: flex; align-items: center; justify-content: center;
  }

  .blog-featured-body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 52px 52px 52px 48px;
    gap: 0;
  }

  .blog-featured-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 13px;
    border: 1px solid rgba(61,107,94,0.2);
    border-radius: 100px;
    background: rgba(61,107,94,0.07);
    color: #3d6b5e;
    font-size: 11px;
    font-weight: 820;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    width: fit-content;
    margin-bottom: 20px;
  }
  .blog-featured-label-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: #3d6b5e;
    flex-shrink: 0;
  }

  .blog-featured-title {
    margin: 0 0 16px;
    font-size: clamp(1.45rem, 2.2vw, 2.1rem);
    font-weight: 860;
    letter-spacing: -0.025em;
    line-height: 1.1;
    color: var(--ink);
    text-wrap: balance;
  }
  .blog-featured-excerpt {
    margin: 0 0 28px;
    color: var(--ink-muted);
    font-size: 15px;
    line-height: 1.78;
  }
  .blog-featured-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ink-dim);
    font-size: 12.5px;
    font-weight: 700;
    margin-bottom: 28px;
  }
  .blog-featured-meta-dot {
    width: 3px; height: 3px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.4;
    flex-shrink: 0;
  }
  .blog-featured-cta {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 42px;
    padding: 0 20px;
    border: 1px solid rgba(18,24,22,0.1);
    border-radius: var(--radius-sm);
    background: rgba(255,255,255,0.85);
    color: var(--ink);
    font-size: 13px;
    font-weight: 820;
    width: fit-content;
    transition: background var(--transition), transform var(--transition), box-shadow var(--transition);
  }
  .blog-featured:hover .blog-featured-cta {
    background: #ffffff;
    transform: translateX(4px);
    box-shadow: 0 6px 20px rgba(18,24,22,0.07);
  }

  /* ── SECONDARY GRID ───────────────────────────────────────────────────────── */
  .blog-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
  }

  /* ── POST CARD ────────────────────────────────────────────────────────────── */
  .blog-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--bg-white);
    overflow: hidden;
    box-shadow: var(--glass-shadow);
    text-decoration: none;
    color: inherit;
    transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
  }
  .blog-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px rgba(18, 24, 22, 0.09);
    border-color: rgba(18, 24, 22, 0.12);
  }

  .blog-card-media {
    position: relative;
    overflow: hidden;
    background: #dfe8e4;
    aspect-ratio: 4 / 3;
  }
  .blog-card-media img {
    width: 100%; height: 100%;
    display: block; object-fit: cover;
    transition: transform 0.7s cubic-bezier(0.22,1,0.36,1);
  }
  .blog-card:hover .blog-card-media img { transform: scale(1.05); }

  .blog-card-media-empty {
    width: 100%; height: 100%;
    background:
      radial-gradient(ellipse 80% 80% at 50% 50%, rgba(162,210,196,0.15) 0%, transparent 70%),
      #e8efec;
    display: flex; align-items: center; justify-content: center;
  }

  .blog-card-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 22px 24px 26px;
  }
  .blog-card-date {
    margin: 0 0 10px;
    color: var(--ink-dim);
    font-size: 11.5px;
    font-weight: 820;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .blog-card-title {
    margin: 0 0 12px;
    font-size: clamp(1rem, 1.4vw, 1.13rem);
    font-weight: 860;
    letter-spacing: -0.015em;
    line-height: 1.2;
    color: var(--ink);
    text-wrap: balance;
    flex: 1;
  }
  .blog-card-excerpt {
    margin: 0 0 18px;
    color: var(--ink-muted);
    font-size: 13.5px;
    line-height: 1.7;
  }
  .blog-card-cta {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #3d6b5e;
    font-size: 12.5px;
    font-weight: 820;
    margin-top: auto;
    transition: gap var(--transition);
  }
  .blog-card:hover .blog-card-cta { gap: 9px; }

  /* ── PHOTO COUNT CHIP ─────────────────────────────────────────────────────── */
  .blog-photo-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 100px;
    background: rgba(18,24,22,0.05);
    color: var(--ink-dim);
    font-size: 11px;
    font-weight: 760;
    margin-left: 4px;
  }

  /* ── EMPTY STATE ──────────────────────────────────────────────────────────── */
  .blog-empty {
    padding: 100px 32px;
    text-align: center;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
  }
  .blog-empty-title {
    margin: 16px 0 8px;
    font-size: 1.2rem;
    font-weight: 860;
    color: var(--ink);
  }
  .blog-empty-copy {
    margin: 0;
    color: var(--ink-muted);
    font-size: 15px;
  }

  /* ── RESPONSIVE ───────────────────────────────────────────────────────────── */
  @media (max-width: 960px) {
    .blog-featured { grid-template-columns: 1fr; }
    .blog-featured-media { min-height: 300px; max-height: 360px; }
    .blog-featured-body { padding: 30px 32px 36px; justify-content: flex-start; }
    .blog-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .blog-page { padding-top: 80px; }
    .blog-hero { padding: 60px 0 52px; }
    .blog-hero-title, .blog-hero-title-light { font-size: clamp(3rem, 14vw, 4.5rem); }
    .blog-list { padding: 48px 0 80px; }
    .blog-grid { grid-template-columns: 1fr; }
    .blog-featured-body { padding: 24px 22px 28px; }
  }
`;

export default async function ProfessionalBlogPage() {
  const posts = await getBlogPostsByCategory("professional");
  const [featured, ...rest] = posts;

  return (
    <main className="blog-page">
      <style>{CSS}</style>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="blog-hero">
        <div className="blog-shell">
          <div className="blog-hero-kicker">
            <span className="blog-hero-kicker-dot" />
            Blog
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
          {posts.length === 0 ? (
            <div className="blog-empty" data-reveal>
              <svg width="44" height="44" viewBox="0 0 44 44" fill="none" style={{ margin: "0 auto" }}>
                <rect x="5" y="10" width="34" height="26" rx="4" stroke="#3d6b5e" strokeWidth="1.5" fill="none" />
                <path d="M14 21h16M14 27h10" stroke="#3d6b5e" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="blog-empty-title">No case studies yet.</p>
              <p className="blog-empty-copy">Check back after grad season.</p>
            </div>
          ) : (
            <>
              {/* ── FEATURED (first post) ─────────────────────────────── */}
              {featured && (
                <Link
                  href={`/blog/${featured.slug}`}
                  className="blog-featured glass-shimmer"
                  data-reveal
                >
                  <div className="blog-featured-media">
                    {featured.cover_image_url ? (
                      <OptimizedPhoto
                        src={featured.cover_image_url}
                        alt={featured.cover_image_alt || featured.title}
                        sizes="(max-width: 860px) 100vw, 50vw"
                        priority
                        quality={90}
                      />
                    ) : (
                      <div className="blog-featured-media-empty">
                        <svg width="52" height="52" viewBox="0 0 52 52" fill="none" opacity="0.25">
                          <rect x="4" y="10" width="44" height="32" rx="4" stroke="#3d6b5e" strokeWidth="1.5" fill="none" />
                          <circle cx="17" cy="22" r="5" stroke="#3d6b5e" strokeWidth="1.5" fill="none" />
                          <path d="M4 36l12-9 10 7 9-6 13 10" stroke="#3d6b5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="blog-featured-body">
                    <span className="blog-featured-label">
                      <span className="blog-featured-label-dot" />
                      Latest story
                    </span>

                    <h2 className="blog-featured-title">{featured.title}</h2>

                    <p className="blog-featured-excerpt">
                      {excerpt(featured.meta_description || featured.body, 170)}
                    </p>

                    <div className="blog-featured-meta">
                      <span>{formatDate(featured.published_at)}</span>
                      {(featured.extra_image_urls?.length ?? 0) > 0 && (
                        <>
                          <span className="blog-featured-meta-dot" />
                          <span>{(featured.extra_image_urls?.length ?? 0) + 1} photos</span>
                        </>
                      )}
                    </div>

                    <span className="blog-featured-cta">
                      Read the story
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                </Link>
              )}

              {/* ── SECONDARY GRID ───────────────────────────────────── */}
              {rest.length > 0 && (
                <div className="blog-grid">
                  {rest.map((post, index) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      className="blog-card glass-shimmer"
                      data-reveal
                      data-delay={String(Math.min((index % 3) + 1, 5))}
                    >
                      <div className="blog-card-media">
                        {post.cover_image_url ? (
                          <OptimizedPhoto
                            src={post.cover_image_url}
                            alt={post.cover_image_alt || post.title}
                            sizes="(max-width: 760px) 100vw, 33vw"
                          />
                        ) : (
                          <div className="blog-card-media-empty">
                            <svg width="34" height="34" viewBox="0 0 34 34" fill="none" opacity="0.25">
                              <rect x="2" y="6" width="30" height="22" rx="3" stroke="#3d6b5e" strokeWidth="1.5" fill="none" />
                              <circle cx="11" cy="14" r="3.5" stroke="#3d6b5e" strokeWidth="1.5" fill="none" />
                              <path d="M2 24l8-6 7 5 6-4 9 7" stroke="#3d6b5e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </div>

                      <div className="blog-card-body">
                        <p className="blog-card-date">{formatDate(post.published_at)}</p>
                        <h2 className="blog-card-title">{post.title}</h2>
                        <p className="blog-card-excerpt">
                          {excerpt(post.meta_description || post.body, 110)}
                        </p>
                        <span className="blog-card-cta">
                          Read the story
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M2 6.5h9M8 3l3.5 3.5L8 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
