// Server-rendered body for the grad-guide hub. All headings, prose, and internal
// links live here so they exist in the initial HTML for search engines and AI
// crawlers — no JS execution required to read the page. The only client island
// is <GradGallery />, which loads recent session photos from Supabase.

import Link from "next/link";
import GradGallery from "./GradGallery";
import { GRAD_GUIDE_CSS, GG_MARQUEE, GG_SQUIGGLE_PATH } from "@/lib/gradGuide";

const sections = [
  { href: "/grad-guide/posing",         num: "01", title: "Posing Guide",   desc: "Natural, flattering poses that actually look good on camera.", emoji: "📸" },
  { href: "/grad-guide/what-to-wear",   num: "02", title: "What to Wear",    desc: "Colors and fits that photograph beautifully in any Bay Area location.", emoji: "👗" },
  { href: "/grad-guide/how-to-prepare", num: "03", title: "How to Prepare",  desc: "Everything to do before your shoot so you show up confident and ready.", emoji: "✅" },
  { href: "/grad-guide/campus-spots",   num: "04", title: "Campus Spots",    desc: "Where we shoot at SJSU, Berkeley, SF State, CSUEB, USF, Santa Clara, and Stanford.", emoji: "📍" },
  { href: "/pricing/grads",             num: "05", title: "Grad Pricing",    desc: "Session lengths, rates, and exactly what every package includes.", emoji: "📋" },
  { href: "/availability",              num: "06", title: "My Availability", desc: "Check what dates are open and reach out to lock one in.", emoji: "📅" },
];

// Hub-and-spoke: short teaser per campus that links to the dedicated, deeper
// landing page (the real ranking target for "[school] graduation photographer").
const schools: Array<{ name: string; href: string; blurb: string }> = [
  {
    name: "UC Berkeley Graduation Photos",
    href: "/grads/uc-berkeley",
    blurb:
      "Sather Gate, the Campanile, and Memorial Glade give Berkeley grads landmark backdrops at any time of day. Mornings are best at Sather Gate before foot traffic builds.",
  },
  {
    name: "SJSU Graduation Photos",
    href: "/grads/sjsu",
    blurb:
      "Tower Hall, the Smith/Carlos statue, and the palm-lined paseo make San José State one of the most photogenic campuses in the South Bay. Late afternoon light is the sweet spot.",
  },
  {
    name: "USF Graduation Photos",
    href: "/grads/usf",
    blurb:
      "St. Ignatius Church, Lone Mountain, and the Welch Field views pair classic architecture with the San Francisco skyline. Overcast days keep the white gowns clean and even.",
  },
  {
    name: "SF State Graduation Photos",
    href: "/grads/sf-state",
    blurb:
      "The quad, Malcolm X Plaza, and the library steps give SF State sessions a modern, open feel. We route around the busiest walkways so your shots stay clean.",
  },
  {
    name: "CSU East Bay Graduation Photos",
    href: "/grads/csueb",
    blurb:
      "The Hayward hilltop campus has some of the best skyline and bay views in the system. Golden hour here is hard to beat for wide, editorial grad portraits.",
  },
  {
    name: "Santa Clara University Graduation Photos",
    href: "/grads/santa-clara",
    blurb:
      "Mission Santa Clara, the Rose Garden, and the palm-lined walkways give SCU grads a warm, timeless backdrop. Late afternoon light on the adobe Mission is the sweet spot.",
  },
  {
    name: "Stanford Graduation Photos",
    href: "/grads/stanford",
    blurb:
      "The Main Quad, Memorial Church, Palm Drive, and Hoover Tower make Stanford one of the most striking campuses on the Peninsula. Soft afternoon light fills the sandstone arches.",
  },
];

const marquee = [...GG_MARQUEE, ...GG_MARQUEE];

export default function GradGuideContent() {
  return (
    <main className="gg-page">
      <style>{GRAD_GUIDE_CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="gg-hero">
        <span className="gg-hero-corner" style={{ top: 18, left: 18, borderTop: "2px solid rgba(112,139,133,0.32)", borderLeft: "2px solid rgba(112,139,133,0.32)" }} />
        <span className="gg-hero-corner" style={{ top: 18, right: 18, borderTop: "2px solid rgba(112,139,133,0.20)", borderRight: "2px solid rgba(112,139,133,0.20)" }} />
        <span className="gg-hero-corner" style={{ bottom: 18, left: 18, borderBottom: "2px solid rgba(112,139,133,0.20)", borderLeft: "2px solid rgba(112,139,133,0.20)" }} />
        <span className="gg-hero-corner" style={{ bottom: 18, right: 18, borderBottom: "2px solid rgba(112,139,133,0.32)", borderRight: "2px solid rgba(112,139,133,0.32)" }} />
        <span className="gg-dot" style={{ position: "absolute", top: 28, right: 30, width: 8, height: 8, borderRadius: 999, background: "#5b8a7a" }} />
        <div className="gg-spin gg-hero-ring">
          <svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="60" stroke="#3d6b5e" strokeWidth="1" fill="none" strokeDasharray="8 6" /></svg>
        </div>
        <div className="gg-hero-squiggle gg-float">
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none">
            <path className="gg-sq" d={GG_SQUIGGLE_PATH} stroke="#5b8a7a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        <div className="gg-shell" style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
          <p className="gg-kicker gg-afu1" style={{ margin: "0 auto 18px" }}>
            <span className="gg-kicker-dot gg-dot" /> Bay Area Grad Photography
          </p>
          <h1 className="gg-h1 gg-afu2" style={{ margin: "0 auto", maxWidth: 720 }}>
            Your complete <span className="gg-h1-accent">graduation</span>
          </h1>
          <p className="gg-h1-script gg-afu3">
            photo guide<span className="gg-cursor gg-blink" />
          </p>
          <p className="gg-sub gg-afu4" style={{ margin: "22px auto 30px" }}>
            Everything you need before, during, and after your graduation shoot — posing, outfits, prep, and the best campus spots in the Bay.
          </p>
          <div className="gg-actions gg-afu4" style={{ justifyContent: "center" }}>
            <Link href="/grad-guide/posing" className="gg-btn gg-btn--primary">Start with posing →</Link>
            <Link href="/contact?school=Graduation" className="gg-btn gg-btn--ghost">Book a shoot</Link>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ────────────────────────────────────────────────────────── */}
      <div className="gg-marquee">
        <div className="gg-marquee-track">
          {marquee.map((item, i) => (
            <span key={i} className="gg-marquee-item">{item}<span className="gg-marquee-sep" /></span>
          ))}
        </div>
      </div>

      {/* ── THE GUIDE (NAV CARDS) ──────────────────────────────────────────── */}
      <section className="gg-section">
        <div className="gg-shell">
          <p className="gg-sec-kicker" data-reveal>The guide</p>
          <h2 className="gg-sec-title" data-reveal>Everything you need</h2>
          <div className="gg-cards">
            {sections.map((s, i) => (
              <Link key={s.href} href={s.href} className="gg-card glass-shimmer" data-reveal data-delay={String((i % 5) + 1)}>
                <span className="gg-card-bar" />
                <span className="gg-card-arrow" aria-hidden="true">↗</span>
                <span className="gg-card-emoji">{s.emoji}</span>
                <p className="gg-card-num">{s.num}</p>
                <h3 className="gg-card-title">{s.title}</h3>
                <p className="gg-card-desc">{s.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── WRITTEN GUIDE (topical H2 sections) ────────────────────────────── */}
      <section className="gg-section gg-section--alt">
        <div className="gg-shell">
          <p className="gg-sec-kicker" data-reveal>Read first</p>
          <h2 className="gg-sec-title" data-reveal>Planning your graduation photos</h2>
          <p className="gg-prose-lead" data-reveal>
            Graduation photos move fast and the best campus spots book up early. This guide walks you
            through what to wear, where to shoot, how to prepare, and the posing and timing details
            that make Bay Area grad portraits feel natural instead of stiff. Each section links to a
            deeper walkthrough.
          </p>

          <div className="gg-prose">
            <div className="gg-topic" data-reveal>
              <h2>What to Wear</h2>
              <p>
                Solid, mid-tone colors photograph best against Bay Area greenery and stone — avoid
                tight patterns and bright neons that fight your cap and gown. Bring one polished
                outfit for after the gown comes off so you leave with two distinct looks.{" "}
                <Link href="/grad-guide/what-to-wear" className="gg-inline-link">See the full what-to-wear guide →</Link>
              </p>
            </div>

            <div className="gg-topic" data-reveal>
              <h2>Best Graduation Photo Locations</h2>
              <p>
                Every campus has a few signature backdrops plus quieter corners that photograph
                better without crowds. We plan a short route so you get landmark shots and clean,
                uncluttered frames in one session.{" "}
                <Link href="/grad-guide/campus-spots" className="gg-inline-link">Browse campus spots</Link>{" "}
                or explore{" "}
                <Link href="/bay-area-locations" className="gg-inline-link">Bay Area locations</Link>{" "}
                beyond campus.
              </p>
            </div>

            <div className="gg-topic" data-reveal>
              <h2>How to Prepare</h2>
              <p>
                Steam the gown the night before, charge your phone for the shot list, and confirm
                parking and meeting points so the session starts on time. A little prep means more
                of your hour goes to actual photos.{" "}
                <Link href="/grad-guide/how-to-prepare" className="gg-inline-link">Read the full prep checklist →</Link>
              </p>
            </div>

            <div className="gg-topic" data-reveal>
              <h2>Graduation Posing Tips</h2>
              <p>
                You don&rsquo;t need to know how to pose — I direct every frame. Still, a few basics
                (weight on your back foot, chin slightly forward, hands with a job) make a big
                difference, and the cap and tassel have their own tricks.{" "}
                <Link href="/grad-guide/posing" className="gg-inline-link">See posing examples →</Link>
              </p>
            </div>

            <div className="gg-topic" data-reveal>
              <h2>Best Time for Graduation Photos</h2>
              <p>
                Golden hour — the hour after sunrise or before sunset — gives the softest, most
                flattering light and the thinnest crowds. Midday sessions work too; we lean on shade
                and campus architecture to keep light even. Booking outside ceremony weekends means
                emptier landmarks and a calmer pace.{" "}
                <Link href="/availability" className="gg-inline-link">Check open dates</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── BY CAMPUS (hub-and-spoke H2 sections) ──────────────────────────── */}
      <section className="gg-section">
        <div className="gg-shell">
          <p className="gg-sec-kicker" data-reveal>By campus</p>
          <h2 className="gg-sec-title" data-reveal>Graduation photos by Bay Area campus</h2>
          <p className="gg-prose-lead" data-reveal>
            I shoot grad portraits across the Bay Area&rsquo;s biggest campuses. Each school has its
            own best spots, light, and crowd patterns — tap through for the full location breakdown.
          </p>
          <div className="gg-schools">
            {schools.map((s) => (
              <div key={s.href} className="gg-school" data-reveal data-delay="1">
                <h2>{s.name}</h2>
                <p>{s.blurb}</p>
                <Link href={s.href} className="gg-school-link">Full {s.name.replace(" Graduation Photos", "")} guide →</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PORTFOLIO (client island) ──────────────────────────────────────── */}
      <section className="gg-section gg-section--alt">
        <div className="gg-shell" style={{ textAlign: "center" }}>
          <p className="gg-kicker" style={{ margin: "0 auto 14px" }} data-reveal>
            <span className="gg-kicker-dot gg-dot" /> Portfolio
          </p>
          <h2 className="gg-sec-title" data-reveal>Recent grad shoots</h2>
          <p className="gg-sec-sub" data-reveal>Real sessions, real results.</p>
          <GradGallery />
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="gg-cta">
        <div className="gg-shell">
          <div className="gg-cta-card glass-shimmer" data-reveal>
            <div className="gg-cta-squiggle">
              <svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
            </div>
            <h2 className="gg-cta-title">Lock in your date.</h2>
            <p className="gg-cta-sub">Grad season books up fast. Reach out early and we&rsquo;ll make it happen.</p>
            <div className="gg-cta-actions">
              <Link href="/contact?school=Graduation" className="gg-btn gg-btn--ongreen">Book your shoot →</Link>
              <Link href="/pricing/grads" className="gg-btn gg-btn--onghost">See grad pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
