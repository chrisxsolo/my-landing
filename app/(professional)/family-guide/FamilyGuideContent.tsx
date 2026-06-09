// Server-rendered body for the family-guide hub. All headings, prose, and
// internal links live here so they exist in the initial HTML for search engines
// and AI crawlers — no JS execution required to read the page. Family
// photographs are passed in from the page (server-fetched from Supabase) and
// rendered with OptimizedPhoto; the gallery shows a neutral placeholder until
// Chris adds work.

import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { FAMILY_GUIDE_CSS, FG_MARQUEE } from "@/lib/familyGuide/styles";
import { locationDisplayName } from "@/lib/familyGuide/types";
import type { FamilyLocationSummary } from "@/lib/familyGuide/types";
import { SUPPORTING_TOPICS } from "@/lib/familyGuide/supporting";
import FamilyJournalStrip from "./FamilyJournalStrip";

// Concise hub previews — each links to the full dedicated page (no duplicated copy).
const topicPreviews = [
  { title: "What to Wear", href: "/family-guide/what-to-wear", preview: SUPPORTING_TOPICS["what-to-wear"].hubPreview },
  { title: "How to Prepare", href: "/family-guide/how-to-prepare", preview: SUPPORTING_TOPICS["how-to-prepare"].hubPreview },
  { title: "What to Expect", href: "/family-guide/what-to-expect", preview: SUPPORTING_TOPICS["what-to-expect"].hubPreview },
  { title: "Best Time for Family Photos", href: "/family-guide/best-time-for-family-photos", preview: SUPPORTING_TOPICS["best-time-for-family-photos"].hubPreview },
];

const FAMILY_CONTACT = "/contact?sessionType=Family+Session";

type HubImage = { image_url: string; alt: string };

// Guide cards — each routes to a dedicated, indexable page (no anchor-only nav).
const cards = [
  { href: "/family-guide/locations", title: "Family Photo Locations", desc: "Beautiful San Francisco and Bay Area spots, with the best fit, light, and access for each.", emoji: "📍" },
  { href: "/family-guide/what-to-wear", title: "What to Wear", desc: "Coordinate without matching — colors, layers, and comfort that photograph well outdoors.", emoji: "👕" },
  { href: "/family-guide/how-to-prepare", title: "How to Prepare", desc: "Simple steps with kids, snacks, and timing so the session feels easy from the start.", emoji: "✅" },
  { href: "/family-guide/what-to-expect", title: "What to Expect", desc: "From inquiry to gallery delivery — the guided, relaxed way a session actually flows.", emoji: "🧭" },
  { href: "/family-guide/best-time-for-family-photos", title: "Best Time for Family Photos", desc: "Golden hour, fog, fall light, and working around young kids' schedules.", emoji: "🌅" },
  { href: "/family-guide/faq", title: "Family Session FAQ", desc: "Booking, kids, grandparents, delivery, and fall timing — answered.", emoji: "❓" },
  { href: "/blog/category/family-photography", title: "Family Photography Journal", desc: "Notes, location guides, and seasonal tips for Bay Area families.", emoji: "📓" },
  { href: FAMILY_CONTACT, title: "Book a Family Session", desc: "Send your date, location, and who's joining — I reply with availability and next steps.", emoji: "📅" },
];

const marquee = [...FG_MARQUEE, ...FG_MARQUEE];

export default function FamilyGuideContent({
  locations,
  galleryImages,
}: {
  locations: FamilyLocationSummary[];
  galleryImages: HubImage[];
}) {
  return (
    <main className="fg-page">
      <style>{FAMILY_GUIDE_CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="fg-hero">
        <span className="fg-dot" style={{ position: "absolute", top: 28, right: 30, width: 8, height: 8, borderRadius: 999, background: "#5b8a7a" }} aria-hidden="true" />
        <div className="fg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="fg-kicker fg-afu1">
            <span className="fg-kicker-dot fg-dot" /> San Francisco &amp; Bay Area Family Photography
          </p>
          <h1 className="fg-h1 fg-afu2">
            San Francisco <span className="fg-h1-accent">Family Photography</span> Guide
          </h1>
          <p className="fg-sub fg-afu3">
            Everything you need to plan a relaxed, natural family photo session in San Francisco and
            across the Bay Area — location ideas, what to wear, how to prepare, the best light, and
            how a guided session actually flows. I direct posing and pacing throughout, so the day
            feels easy and the photos feel like you.
          </p>
          <div className="fg-actions fg-afu4">
            <Link href={FAMILY_CONTACT} className="fg-btn fg-btn--primary">Inquire about a session →</Link>
            <Link href="/family-guide/locations" className="fg-btn fg-btn--ghost">Explore family photo locations</Link>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ────────────────────────────────────────────────────────── */}
      <div className="fg-marquee" aria-hidden="true">
        <div className="fg-marquee-track">
          {marquee.map((item, i) => (
            <span key={i} className="fg-marquee-item">{item}<span className="fg-marquee-sep" /></span>
          ))}
        </div>
      </div>

      {/* ── GUIDE CARDS ────────────────────────────────────────────────────── */}
      <section className="fg-section">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>The guide</p>
          <h2 className="fg-sec-title" data-reveal>Plan your family session</h2>
          <div className="fg-cards">
            {cards.map((c, i) => (
              <Link key={c.title} href={c.href} className="fg-card glass-shimmer" data-reveal data-delay={String((i % 5) + 1)}>
                <span className="fg-card-bar" />
                <span className="fg-card-arrow" aria-hidden="true">↗</span>
                <span className="fg-card-emoji" aria-hidden="true">{c.emoji}</span>
                <h3 className="fg-card-title">{c.title}</h3>
                <p className="fg-card-desc">{c.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── WRITTEN GUIDE (topical sections) ───────────────────────────────── */}
      <section className="fg-section fg-section--alt">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>Read first</p>
          <h2 className="fg-sec-title" data-reveal>Planning your San Francisco family photos</h2>
          <p className="fg-prose-lead" data-reveal>
            Good family photos come from a relaxed session and a little planning — not from everyone
            performing on cue. This guide covers the parts that make Bay Area family sessions feel
            natural: choosing a location that fits your family, dressing comfortably, preparing kids
            without pressure, and picking light that flatters. You don&rsquo;t need to know how to
            pose; I guide that throughout.
          </p>

          <div className="fg-prose">
            {topicPreviews.map((t) => (
              <div key={t.href} className="fg-topic" data-reveal>
                <h3>{t.title}</h3>
                <p>
                  {t.preview}{" "}
                  <Link href={t.href} className="fg-inline-link">Read the full {t.title.toLowerCase()} guide →</Link>
                </p>
              </div>
            ))}

            <div className="fg-topic" id="fall-holiday" data-reveal>
              <h3>Planning Fall and Holiday Family Photos</h3>
              <p>
                Fall is the busiest stretch for family sessions, so it helps to plan ahead. Scheduling
                early in the season leaves room for the session, editing, and gallery delivery before
                holiday-card season — and fall&rsquo;s earlier sunsets mean golden-hour sessions start
                sooner in the afternoon. There&rsquo;s no artificial deadline; a little lead time just
                makes everything smoother. See{" "}
                <Link href="/family-guide/best-time-for-family-photos" className="fg-inline-link">best time for family photos</Link>{" "}
                or{" "}
                <Link href={FAMILY_CONTACT} className="fg-inline-link">reach out about a Bay Area family session</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BY LOCATION (hub-and-spoke) ────────────────────────────────────── */}
      <section className="fg-section">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>By location</p>
          <h2 className="fg-sec-title" data-reveal>Family photo locations in San Francisco and the Bay Area</h2>
          <p className="fg-prose-lead" data-reveal>
            The best location depends on your family — the ages of your kids, how much walking feels
            comfortable, and whether you want architecture, beach, greenery, or redwoods. Here are a
            few favorites; the{" "}
            <Link href="/family-guide/locations" className="fg-inline-link">full locations guide</Link>{" "}
            covers the fit, light, and access for each.
          </p>
          <div className="fg-locs">
            {locations.map((loc) => (
              <Link key={loc.slug} href={loc.canonicalPath} className="fg-loc" data-reveal data-delay="1">
                <div className="fg-loc-media">
                  <div className="fg-loc-ph"><span aria-hidden="true">🌿</span><p>Photos coming soon</p></div>
                </div>
                <div className="fg-loc-body">
                  <span className="fg-loc-region">{loc.region}</span>
                  <h3 className="fg-loc-title">{locationDisplayName(loc)}</h3>
                  <p className="fg-loc-area">{loc.area}</p>
                  <p className="fg-loc-desc">{loc.cardSummary}</p>
                  <span className="fg-loc-link">View {locationDisplayName(loc)} family photography →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ────────────────────────────────────────────────────────── */}
      <section className="fg-section fg-section--alt">
        <div className="fg-shell" style={{ textAlign: "center" }}>
          <p className="fg-kicker" style={{ margin: "0 auto 14px" }} data-reveal>
            <span className="fg-kicker-dot fg-dot" /> Recent work
          </p>
          <h2 className="fg-sec-title" data-reveal>Bay Area family sessions</h2>
          <p className="fg-sec-sub" data-reveal>A look at the natural, relaxed style I aim for.</p>
          {galleryImages.length > 0 ? (
            <div className="fg-gallery">
              {galleryImages.map((img, i) => (
                <div key={`${img.image_url}-${i}`} className="fg-photo" data-reveal data-delay="1">
                  <OptimizedPhoto src={img.image_url} alt={img.alt} sizes="(max-width: 620px) 50vw, 30vw" quality={75} />
                </div>
              ))}
            </div>
          ) : (
            <div className="fg-empty" data-reveal>
              <p style={{ fontSize: 34, margin: "0 0 10px" }} aria-hidden="true">📷</p>
              <p style={{ fontWeight: 760, color: "var(--ink)" }}>Family session photos appear here soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── FAMILY JOURNAL (renders only when family posts exist) ──────────── */}
      <FamilyJournalStrip />

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="fg-cta">
        <div className="fg-shell">
          <div className="fg-cta-card glass-shimmer" data-reveal>
            <h2 className="fg-cta-title">Let&rsquo;s plan your family photos.</h2>
            <p className="fg-cta-sub">
              Tell me your ideal date, who&rsquo;s joining, and the kind of scenery you have in mind.
              I&rsquo;ll guide the rest.
            </p>
            <div className="fg-cta-actions">
              <Link href={FAMILY_CONTACT} className="fg-btn fg-btn--ongreen">Inquire about a session →</Link>
              <Link href="/pricing/families" className="fg-btn fg-btn--onghost">See family pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
