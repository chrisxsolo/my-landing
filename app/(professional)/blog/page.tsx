// ─────────────────────────────────────────────────────────────────────────────
// JOURNAL / BLOG PAGE  →  soloxsnaps.com/blog
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Light hero  — "Journal." heading on a soft gray gradient
//   2. Post list   — glass card rows: cover photo + date, title, excerpt
//   3. Empty state — shown when there are no posts yet
//
// QUICK EDITS:
//   → Hero title:       find "Journal." in the hero JSX below
//   → Hero subtitle:    find the <p> below the h1
//   → Excerpt length:   change `max = 160` in the excerpt() function
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";
import { getBlogPostsByCategory } from "@/lib/professionalData";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Journal | soloxsnaps",
  description: "Session notes and case studies from soloxsnaps in San Francisco and the Bay Area.",
  alternates: { canonical: "/blog" },
  openGraph: {
    title: "Journal | soloxsnaps",
    description: "Professional photography case studies and session notes from soloxsnaps.",
    type: "website",
  },
};

// excerpt: trims post body to `max` characters.
function excerpt(body: string, max = 160) {
  return body.length > max ? `${body.slice(0, max).trim()}…` : body;
}

// formatDate: converts ISO date to "April 7, 2025" style.
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });
}

const CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── PAGE ─────────────────────────────────────────────────────────────────── */
  .journal-page {
    background: #f5f6f4;
    color: #101412;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .journal-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }

  /* ── HERO ─────────────────────────────────────────────────────────────────────
     Light gradient, clean and airy. padding-top clears the fixed nav. */
  .journal-hero {
    padding: 120px 0 68px;
    background:
      radial-gradient(ellipse 65% 60% at 5% 10%, rgba(162, 210, 196, 0.16) 0%, transparent 60%),
      radial-gradient(ellipse 50% 55% at 95% 90%, rgba(130, 185, 175, 0.12) 0%, transparent 55%),
      linear-gradient(to bottom, #eaf0ec 0%, #f5f6f4 100%);
    border-bottom: 1px solid rgba(18, 24, 22, 0.07);
  }
  .journal-hero-kicker {
    margin: 0 0 16px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
    animation: fadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .journal-hero-title {
    margin: 0;
    color: #101412;
    font-size: clamp(3.2rem, 8.5vw, 7.5rem);
    font-weight: 900;
    letter-spacing: -0.035em;
    line-height: 0.88;
    animation: fadeUp 0.65s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .journal-hero-sub {
    margin: 20px 0 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.7;
    max-width: 480px;
    animation: fadeUp 0.65s 0.16s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* ── POST LIST ───────────────────────────────────────────────────────────────
     Posts show as glass card rows.
     To change card spacing: update margin-bottom in .journal-row. */
  .journal-list {
    background: #f5f6f4;
    padding: 36px 0 100px;
  }

  /* Glass card row */
  .journal-row {
    display: grid;
    grid-template-columns: 52px minmax(0, 0.95fr) minmax(0, 1.05fr);
    gap: 36px;
    align-items: center;
    padding: 24px;
    margin-bottom: 12px;
    border: 1px solid rgba(18, 24, 22, 0.08);
    border-radius: 14px;
    background: #ffffff;
    box-shadow: 0 4px 18px rgba(18, 24, 22, 0.05);
    text-decoration: none;
    color: inherit;
    transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease, border-color 0.2s ease;
  }
  .journal-row:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 36px rgba(18, 24, 22, 0.09);
    border-color: rgba(18, 24, 22, 0.12);
  }
  .journal-row:last-child { margin-bottom: 0; }

  /* Post number */
  .journal-num {
    color: rgba(18, 24, 22, 0.15);
    font-size: 1.8rem;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.04em;
    text-align: right;
  }

  /* Cover photo */
  .journal-cover {
    overflow: hidden;
    border-radius: 10px;
    background: #dfe8e4;
    aspect-ratio: 4 / 3;
    box-shadow: 0 4px 16px rgba(18, 24, 22, 0.08);
  }
  .journal-cover img {
    width: 100%; height: 100%;
    display: block; object-fit: cover;
    transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .journal-row:hover .journal-cover img { transform: scale(1.04); }

  /* Text */
  .journal-date {
    margin: 0 0 8px;
    color: #667f79;
    font-size: 12px;
    font-weight: 820;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .journal-post-title {
    margin: 0 0 12px;
    color: #101412;
    font-size: clamp(1.15rem, 2vw, 1.55rem);
    font-weight: 860;
    letter-spacing: -0.015em;
    line-height: 1.15;
    text-wrap: balance;
  }
  .journal-excerpt {
    margin: 0 0 16px;
    color: #4b5a55;
    font-size: 15px;
    line-height: 1.68;
  }
  .journal-read-more {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 34px;
    padding: 0 12px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    font-size: 13px;
    font-weight: 820;
  }

  /* ── EMPTY STATE ─────────────────────────────────────────────────────────── */
  .journal-empty {
    padding: 72px 28px;
    text-align: center;
    border: 1px solid rgba(18, 24, 22, 0.08);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.78);
    color: #667f79;
    font-size: 17px;
    line-height: 1.7;
  }

  /* ── RESPONSIVE ──────────────────────────────────────────────────────────── */
  @media (max-width: 760px) {
    .journal-shell { width: min(1180px, calc(100% - 36px)); }
    .journal-hero { padding: 100px 0 52px; }
    .journal-hero-title { font-size: clamp(2.6rem, 12vw, 4rem); }
    .journal-hero-sub { font-size: 15px; }
    .journal-row { grid-template-columns: 1fr; gap: 16px; padding: 18px; }
    .journal-num { display: none; }
    .journal-post-title { font-size: 1.25rem; }
    .journal-list { padding-top: 24px; }
  }
`;

export default async function ProfessionalBlogPage() {
  const posts = await getBlogPostsByCategory("professional");

  return (
    <main className="journal-page">
      <style>{CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────────────
           Light gradient header. Edit h1 and p text directly below. */}
      <section className="journal-hero">
        <div className="journal-shell">
          <p className="journal-hero-kicker">Journal</p>
          <h1 className="journal-hero-title">Session notes &amp; stories.</h1>
          <p className="journal-hero-sub">
            Recent work, notes from sessions, and the quieter details behind the frame.
          </p>
        </div>
      </section>

      {/* ── POST LIST ──────────────────────────────────────────────────────────
           Posts fetched from Supabase (category: "professional").
           Each row: number, cover photo, date + title + excerpt + read more. */}
      <section className="journal-list">
        <div className="journal-shell">
          {posts.length > 0 ? (
            posts.map((post, index) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="journal-row glass-shimmer"
                data-reveal data-delay={String(Math.min(index + 1, 5))}>
                <span className="journal-num">{String(index + 1).padStart(2, "0")}</span>
                <div className="journal-cover">
                  {post.cover_image_url ? (
                    <img src={post.cover_image_url} alt={post.title} loading="lazy" decoding="async" />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "#dfe8e4" }} />
                  )}
                </div>
                <div>
                  <p className="journal-date">{formatDate(post.published_at)}</p>
                  <h2 className="journal-post-title">{post.title}</h2>
                  <p className="journal-excerpt">{excerpt(post.meta_description || post.body)}</p>
                  <span className="journal-read-more">Read the story →</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="journal-empty">
              <p>No case studies yet. Check back after grad season.</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
