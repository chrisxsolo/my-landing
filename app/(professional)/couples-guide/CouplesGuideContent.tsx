// Server-rendered body for the couples-guide hub. All headings, prose, and
// internal links live here so they exist in the initial HTML for search engines
// and AI crawlers — no JS execution required to read the page. Couples photographs
// are passed in from the page (server-fetched from Supabase) and rendered with
// OptimizedPhoto; the gallery shows a neutral placeholder until Chris adds work.
// Reuses the family guide's fg-* design system for native visual consistency.

import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { COUPLES_GUIDE_CSS, COUPLES_MARQUEE } from "@/lib/couplesGuide/styles";
import { locationDisplayName } from "@/lib/couplesGuide/types";
import type { CouplesLocationSummary } from "@/lib/couplesGuide/types";
import { SUPPORTING_TOPICS } from "@/lib/couplesGuide/supporting";
import CouplesJournalStrip from "./CouplesJournalStrip";

// Concise hub previews — each links to the full dedicated page (no duplicated copy).
const topicPreviews = [
  { title: "What to Wear", href: "/couples-guide/what-to-wear", preview: SUPPORTING_TOPICS["what-to-wear"].hubPreview },
  { title: "How to Prepare", href: "/couples-guide/how-to-prepare", preview: SUPPORTING_TOPICS["how-to-prepare"].hubPreview },
  { title: "What to Expect", href: "/couples-guide/what-to-expect", preview: SUPPORTING_TOPICS["what-to-expect"].hubPreview },
  { title: "Best Time for Couples Photos", href: "/couples-guide/best-time-for-couples-photos", preview: SUPPORTING_TOPICS["best-time-for-couples-photos"].hubPreview },
];

const COUPLES_CONTACT = "/contact?sessionType=Couples+Session";

type HubImage = { image_url: string; alt: string };

// Guide cards — each routes to a dedicated, indexable page (no anchor-only nav).
const cards = [
  { href: "/couples-guide/locations", title: "Couples Photo Locations", desc: "Romantic and natural San Francisco spots, with the best fit, light, and access for each.", emoji: "📍" },
  { href: "/couples-guide/what-to-wear", title: "What to Wear", desc: "Coordinate without matching — colors, layers, and comfort that photograph well outdoors.", emoji: "👗" },
  { href: "/couples-guide/how-to-prepare", title: "How to Prepare", desc: "Choose a mood, plan for the weather, and show up relaxed — I guide the rest.", emoji: "✅" },
  { href: "/couples-guide/what-to-expect", title: "What to Expect", desc: "From inquiry to gallery delivery — the guided, relaxed way a session actually flows.", emoji: "🧭" },
  { href: "/couples-guide/best-time-for-couples-photos", title: "Best Time for Couples Photos", desc: "Golden hour, blue hour, fog, and balancing great light with privacy.", emoji: "🌅" },
  { href: "/couples-guide/faq", title: "Couples Session FAQ", desc: "Booking, posing, outfits, dogs, delivery, and engagements — answered.", emoji: "❓" },
  { href: "/blog/category/couples-photography", title: "Couples Photography Journal", desc: "Notes, location guides, and session tips for Bay Area couples.", emoji: "📓" },
  { href: COUPLES_CONTACT, title: "Book a Couples Session", desc: "Send your date, location idea, and session type — I reply with availability and next steps.", emoji: "📅" },
];

const marquee = [...COUPLES_MARQUEE, ...COUPLES_MARQUEE];

export default function CouplesGuideContent({
  locations,
  galleryImages,
}: {
  locations: CouplesLocationSummary[];
  galleryImages: HubImage[];
}) {
  return (
    <main className="fg-page">
      <style>{COUPLES_GUIDE_CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="fg-hero">
        <span className="fg-dot" style={{ position: "absolute", top: 28, right: 30, width: 8, height: 8, borderRadius: 999, background: "#5b8a7a" }} aria-hidden="true" />
        <div className="fg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="fg-kicker fg-afu1">
            <span className="fg-kicker-dot fg-dot" /> San Francisco &amp; Bay Area Couples Photography
          </p>
          <h1 className="fg-h1 fg-afu2">
            San Francisco <span className="fg-h1-accent">Couples Photography</span> Guide
          </h1>
          <p className="fg-sub fg-afu3">
            Everything you need to plan a natural, relaxed couples photo session in San Francisco
            and across the Bay Area — location ideas, what to wear, how to prepare, the best light,
            and how a guided session actually flows. I create bright, lifestyle-focused photos that
            mix candid interaction with clear posing and direction, so you never have to wonder what
            to do with your hands.
          </p>
          <div className="fg-actions fg-afu4">
            <Link href={COUPLES_CONTACT} className="fg-btn fg-btn--primary">Inquire about a session →</Link>
            <Link href="/couples-guide/locations" className="fg-btn fg-btn--ghost">Explore couples photo locations</Link>
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
          <h2 className="fg-sec-title" data-reveal>Plan your couples session</h2>
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
          <h2 className="fg-sec-title" data-reveal>Planning your San Francisco couples photos</h2>
          <p className="fg-prose-lead" data-reveal>
            Good couples photos come from a relaxed session and a little planning — not from
            performing on cue. This guide covers the parts that make Bay Area couples sessions feel
            natural: choosing a location that fits the two of you, dressing comfortably, planning for
            the weather and light, and knowing what to expect. You don&rsquo;t need to know how to
            pose; I guide movement and interaction throughout.
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

            <div className="fg-topic" id="anniversary-engagement" data-reveal>
              <h3>Anniversary and Engagement-Style Photos</h3>
              <p>
                A couples session is a natural fit for marking an anniversary, refreshing your
                photos together, or capturing engagement-style portraits for save-the-dates and
                announcements. Engagement sessions are offered as part of couples photography — tell
                me what you&rsquo;re celebrating and I&rsquo;ll plan the pacing and locations around
                it. See the{" "}
                <Link href="/pricing/couples" className="fg-inline-link">couples pricing page</Link>{" "}
                for session options, or{" "}
                <Link href={COUPLES_CONTACT} className="fg-inline-link">reach out about a Bay Area couples session</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CAMERA-SHY REASSURANCE ─────────────────────────────────────────── */}
      <section className="fg-section">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>Feeling camera-shy?</p>
          <h2 className="fg-sec-title" data-reveal>You don&rsquo;t need to be a model</h2>
          <p className="fg-prose-lead" data-reveal>
            Most of my clients aren&rsquo;t professional models, and that&rsquo;s completely fine.
            I guide you throughout — using movement, simple prompts, and real interaction rather than
            rigid poses — so you always know what to do. You&rsquo;re not expected to perform the
            whole time; small breaks and resets are normal, and looking at the camera is only one
            part of the session. The goal is to keep things feeling natural while I handle the
            technical direction. The first few minutes can feel a little awkward — that&rsquo;s
            normal, and it passes quickly once you settle in.
          </p>
        </div>
      </section>

      {/* ── BY LOCATION (hub-and-spoke) ────────────────────────────────────── */}
      <section className="fg-section fg-section--alt">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>By location</p>
          <h2 className="fg-sec-title" data-reveal>Couples photo locations in San Francisco</h2>
          <p className="fg-prose-lead" data-reveal>
            The best location depends on the two of you — the atmosphere you want, how much privacy
            you&rsquo;d like, and whether you&rsquo;re drawn to architecture, beach, or greenery. Here
            are a few favorites; the{" "}
            <Link href="/couples-guide/locations" className="fg-inline-link">full locations guide</Link>{" "}
            covers the fit, light, and access for each.
          </p>
          <div className="fg-locs">
            {locations.map((loc) => (
              <Link key={loc.slug} href={loc.canonicalPath} className="fg-loc" data-reveal data-delay="1">
                <div className="fg-loc-media">
                  <div className="fg-loc-ph"><span aria-hidden="true">💞</span><p>Photos coming soon</p></div>
                </div>
                <div className="fg-loc-body">
                  <span className="fg-loc-region">{loc.region}</span>
                  <h3 className="fg-loc-title">{locationDisplayName(loc)}</h3>
                  <p className="fg-loc-area">{loc.area}</p>
                  <p className="fg-loc-desc">{loc.cardSummary}</p>
                  <span className="fg-loc-link">View {locationDisplayName(loc)} couples photography →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ────────────────────────────────────────────────────────── */}
      <section className="fg-section">
        <div className="fg-shell" style={{ textAlign: "center" }}>
          <p className="fg-kicker" style={{ margin: "0 auto 14px" }} data-reveal>
            <span className="fg-kicker-dot fg-dot" /> Recent work
          </p>
          <h2 className="fg-sec-title" data-reveal>Bay Area couples sessions</h2>
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
              <p style={{ fontWeight: 760, color: "var(--ink)" }}>Couples session photos appear here soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── COUPLES JOURNAL (renders only when couples posts exist) ────────── */}
      <CouplesJournalStrip />

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="fg-cta">
        <div className="fg-shell">
          <div className="fg-cta-card glass-shimmer" data-reveal>
            <h2 className="fg-cta-title">Let&rsquo;s plan your couples photos.</h2>
            <p className="fg-cta-sub">
              Tell me your ideal date, the session type, and the kind of scenery you have in mind.
              I&rsquo;ll guide the rest.
            </p>
            <div className="fg-cta-actions">
              <Link href={COUPLES_CONTACT} className="fg-btn fg-btn--ongreen">Inquire about a session →</Link>
              <Link href="/pricing/couples" className="fg-btn fg-btn--onghost">See couples pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
