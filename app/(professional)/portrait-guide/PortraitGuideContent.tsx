// Server-rendered body for the portrait-guide hub. All headings, prose, and
// internal links live here so they exist in the initial HTML for search engines
// and AI crawlers — no JS execution required to read the page. Portrait
// photographs are passed in from the page (server-fetched) and rendered with
// OptimizedPhoto; the gallery shows a neutral placeholder until Chris adds work.
// Reuses the family guide's fg-* design system for native visual consistency.

import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { PORTRAIT_GUIDE_CSS, PORTRAIT_MARQUEE } from "@/lib/portraitGuide/styles";
import { locationDisplayName } from "@/lib/portraitGuide/types";
import type { PortraitLocationSummary } from "@/lib/portraitGuide/types";
import { SUPPORTING_TOPICS } from "@/lib/portraitGuide/supporting";
import PortraitJournalStrip from "./PortraitJournalStrip";

// Concise hub previews — each links to the full dedicated page (no duplicated copy).
const topicPreviews = [
  { title: "What to Wear", href: "/portrait-guide/what-to-wear", preview: SUPPORTING_TOPICS["what-to-wear"].hubPreview },
  { title: "How to Prepare", href: "/portrait-guide/how-to-prepare", preview: SUPPORTING_TOPICS["how-to-prepare"].hubPreview },
  { title: "What to Expect", href: "/portrait-guide/what-to-expect", preview: SUPPORTING_TOPICS["what-to-expect"].hubPreview },
  { title: "Best Time for Portraits", href: "/portrait-guide/best-time-for-portraits", preview: SUPPORTING_TOPICS["best-time-for-portraits"].hubPreview },
];

const PORTRAIT_CONTACT = "/contact?sessionType=Individual+Portrait";

type HubImage = { image_url: string; alt: string };

// Guide cards — each routes to a dedicated, indexable page (no anchor-only nav).
const cards = [
  { href: "/portrait-guide/locations", title: "Portrait Photo Locations", desc: "Natural, urban, and iconic San Francisco spots, with the best fit, light, and access for each.", emoji: "📍" },
  { href: "/portrait-guide/what-to-wear", title: "What to Wear", desc: "Solid colors, texture, and layers that photograph well — plus branding-session outfits.", emoji: "👔" },
  { href: "/portrait-guide/how-to-prepare", title: "How to Prepare", desc: "Choose a mood, plan for the weather, and show up relaxed — I guide the rest.", emoji: "✅" },
  { href: "/portrait-guide/what-to-expect", title: "What to Expect", desc: "From inquiry to gallery delivery — the guided, relaxed way a session actually flows.", emoji: "🧭" },
  { href: "/portrait-guide/best-time-for-portraits", title: "Best Time for Portraits", desc: "Golden hour, open shade at midday, fog, and balancing light with privacy.", emoji: "🌅" },
  { href: "/portrait-guide/faq", title: "Portrait Session FAQ", desc: "Booking, posing nerves, outfits, branding photos, and delivery — answered.", emoji: "❓" },
  { href: "/blog/category/portrait-photography", title: "Portrait Photography Journal", desc: "Notes, location guides, and session tips for Bay Area portraits.", emoji: "📓" },
  { href: PORTRAIT_CONTACT, title: "Book a Portrait Session", desc: "Send your date, what the photos are for, and a location idea — I reply with next steps.", emoji: "📅" },
];

// Why a solo portrait session is different — the specialist skills behind the
// photos. Each is a concrete reason to hire over a generalist.
const differentiators = [
  { emoji: "🎬", title: "Direction for one", text: "With no one to interact with, every frame depends on direction — I give you constant, specific guidance so you're never left wondering what to do." },
  { emoji: "💼", title: "Branding that looks like you", text: "For work-facing portraits, I plan frames around how you'll actually use them — profiles, websites, press — so the gallery works as hard as you do." },
  { emoji: "🌿", title: "Low-pressure pacing", text: "Most people find solo sessions more nerve-racking than group ones. I build in movement, resets, and breaks so it stays easy." },
  { emoji: "🎨", title: "Location & outfit pairing", text: "I help match your outfit to the scenery you choose, so colors, light, and mood work together instead of competing." },
];

const marquee = [...PORTRAIT_MARQUEE, ...PORTRAIT_MARQUEE];

export default function PortraitGuideContent({
  locations,
  galleryImages,
}: {
  locations: PortraitLocationSummary[];
  galleryImages: HubImage[];
}) {
  return (
    <main className="fg-page">
      <style>{PORTRAIT_GUIDE_CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="fg-hero">
        <span className="fg-dot" style={{ position: "absolute", top: 28, right: 30, width: 8, height: 8, borderRadius: 999, background: "#5b8a7a" }} aria-hidden="true" />
        <div className="fg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="fg-kicker fg-afu1">
            <span className="fg-kicker-dot fg-dot" /> San Francisco &amp; Bay Area Portrait Photography
          </p>
          <h1 className="fg-h1 fg-afu2">
            San Francisco <span className="fg-h1-accent">Lifestyle Portrait</span> Guide
          </h1>
          <p className="fg-sub fg-afu3">
            Everything you need to plan a natural, relaxed portrait session in San Francisco and
            across the Bay Area — location ideas, what to wear, how to prepare, the best light, and
            how a guided session actually flows. Whether it&rsquo;s a personal milestone, photos for
            your work and profiles, or simply a great set of photos of you, I mix candid moments
            with clear posing and direction so you never have to wonder what to do with your hands.
          </p>
          <div className="fg-actions fg-afu4">
            <Link href={PORTRAIT_CONTACT} className="fg-btn fg-btn--primary">Inquire about a session →</Link>
            <Link href="/portrait-guide/locations" className="fg-btn fg-btn--ghost">Explore portrait photo locations</Link>
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
          <h2 className="fg-sec-title" data-reveal>Plan your portrait session</h2>
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
          <h2 className="fg-sec-title" data-reveal>Planning your San Francisco portraits</h2>
          <p className="fg-prose-lead" data-reveal>
            Good portraits come from a relaxed session and a little planning — not from performing
            on cue. This guide covers the parts that make Bay Area portrait sessions feel natural:
            choosing a setting that fits you, dressing comfortably, planning for the weather and
            light, and knowing what to expect. You don&rsquo;t need to know how to pose; I direct
            everything throughout.
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

            <div className="fg-topic" id="branding-milestones" data-reveal>
              <h3>Branding Photos and Personal Milestones</h3>
              <p>
                A portrait session works just as well for your career as for your milestones —
                headshot-style frames and lifestyle branding photos for your website, profiles, and
                press, or portraits marking a birthday, a move, a new chapter, or simply wanting
                photos of yourself you actually like. Tell me what the photos are for and I&rsquo;ll
                plan the locations and pacing around it. See the{" "}
                <Link href="/pricing" className="fg-inline-link">pricing page</Link>{" "}
                for session options, or{" "}
                <Link href={PORTRAIT_CONTACT} className="fg-inline-link">reach out about a Bay Area portrait session</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY A SOLO SESSION IS DIFFERENT ────────────────────────────────── */}
      <section className="fg-section">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>Why hire a portrait specialist</p>
          <h2 className="fg-sec-title" data-reveal>What makes a solo session different</h2>
          <p className="fg-prose-lead" data-reveal>
            A great portrait gallery isn&rsquo;t about a nice preset — it comes from how the session
            is directed, and in a solo session every frame depends on that direction. These are the
            things I bring beyond the edit.
          </p>
          <div className="fg-diff">
            {differentiators.map((d) => (
              <div key={d.title} className="fg-diff-item" data-reveal data-delay="1">
                <span className="fg-diff-bar" aria-hidden="true" />
                <span className="fg-diff-emoji" aria-hidden="true">{d.emoji}</span>
                <h3 className="fg-diff-title">{d.title}</h3>
                <p className="fg-diff-text">{d.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CAMERA-SHY REASSURANCE ─────────────────────────────────────────── */}
      <section className="fg-section">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>Feeling camera-shy?</p>
          <h2 className="fg-sec-title" data-reveal>You don&rsquo;t need to be a model</h2>
          <p className="fg-prose-lead" data-reveal>
            Being photographed alone feels more exposed than being in a group — almost everyone says
            so, and the session is built around it. I guide you constantly with movement and simple
            prompts rather than rigid poses, so you always know what to do. You&rsquo;re not
            expected to perform the whole time; breaks and resets are normal, and looking at the
            camera is only one part of the session. The first few minutes feel a little awkward for
            everyone — that&rsquo;s normal, and it passes quickly once we get moving.
          </p>
        </div>
      </section>

      {/* ── BY LOCATION (hub-and-spoke) ────────────────────────────────────── */}
      <section className="fg-section fg-section--alt">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>By location</p>
          <h2 className="fg-sec-title" data-reveal>Portrait photo locations in San Francisco</h2>
          <p className="fg-prose-lead" data-reveal>
            The best location depends on you — the mood you want, how much privacy you&rsquo;d
            like, and whether you&rsquo;re drawn to nature, architecture, the coast, or city color.
            Here are a few favorites; the{" "}
            <Link href="/portrait-guide/locations" className="fg-inline-link">full locations guide</Link>{" "}
            covers the fit, light, and access for each.
          </p>
          <div className="fg-locs">
            {locations.map((loc) => (
              <Link key={loc.slug} href={loc.canonicalPath} className="fg-loc" data-reveal data-delay="1">
                <div className="fg-loc-media">
                  <div className="fg-loc-ph"><span aria-hidden="true">🙋</span><p>Photos coming soon</p></div>
                </div>
                <div className="fg-loc-body">
                  <span className="fg-loc-region">{loc.region}</span>
                  <h3 className="fg-loc-title">{locationDisplayName(loc)}</h3>
                  <p className="fg-loc-area">{loc.area}</p>
                  <p className="fg-loc-desc">{loc.cardSummary}</p>
                  <span className="fg-loc-link">View {locationDisplayName(loc)} portrait photography →</span>
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
          <h2 className="fg-sec-title" data-reveal>Bay Area portrait sessions</h2>
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
              <p style={{ fontWeight: 760, color: "var(--ink)" }}>Portrait session photos appear here soon.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── PORTRAIT JOURNAL (renders only when portrait posts exist) ──────── */}
      <PortraitJournalStrip />

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="fg-cta">
        <div className="fg-shell">
          <div className="fg-cta-card glass-shimmer" data-reveal>
            <h2 className="fg-cta-title">Let&rsquo;s plan your portraits.</h2>
            <p className="fg-cta-sub">
              Tell me your ideal date, what the photos are for, and the kind of scenery you have in
              mind. I&rsquo;ll guide the rest.
            </p>
            <div className="fg-cta-actions">
              <Link href={PORTRAIT_CONTACT} className="fg-btn fg-btn--ongreen">Inquire about a session →</Link>
              <Link href="/pricing" className="fg-btn fg-btn--onghost">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
