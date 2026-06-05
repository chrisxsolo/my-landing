"use client";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GRAD_GUIDE_CSS, GG_MARQUEE, GG_SQUIGGLE_PATH } from "@/lib/gradGuide";

type GradPhoto = { id: number; image_url: string; caption: string | null };

const sections = [
  { href: "/grad-guide/posing",        num: "01", title: "Posing Guide",   desc: "Natural, flattering poses that actually look good on camera.", emoji: "📸" },
  { href: "/grad-guide/what-to-wear",  num: "02", title: "What to Wear",    desc: "Colors and fits that photograph beautifully in any Bay Area location.", emoji: "👗" },
  { href: "/grad-guide/how-to-prepare", num: "03", title: "How to Prepare", desc: "Everything to do before your shoot so you show up confident and ready.", emoji: "✅" },
  { href: "/grad-guide/campus-spots",  num: "04", title: "Campus Spots",    desc: "Where we shoot at SJSU, Berkeley, SF State, CSUEB, and USF.", emoji: "📍" },
  { href: "/pricing/grads",            num: "05", title: "Grad Pricing",    desc: "Session lengths, rates, and exactly what every package includes.", emoji: "📋" },
  { href: "/availability",             num: "06", title: "My Availability", desc: "Check what dates are open and reach out to lock one in.", emoji: "📅" },
];

const marquee = [...GG_MARQUEE, ...GG_MARQUEE];

export default function GradGuideClient() {
  const [photos, setPhotos] = useState<GradPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const { data, error } = await supabase.from("grad_photos").select("*").order("created_at", { ascending: false });
        if (error) console.error(error);
        if (data) setPhotos(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPhotos();
  }, []);

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

      {/* ── THE GUIDE ──────────────────────────────────────────────────────── */}
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

      {/* ── PORTFOLIO ──────────────────────────────────────────────────────── */}
      <section className="gg-section gg-section--alt">
        <div className="gg-shell" style={{ textAlign: "center" }}>
          <p className="gg-kicker" style={{ margin: "0 auto 14px" }} data-reveal>
            <span className="gg-kicker-dot gg-dot" /> Portfolio
          </p>
          <h2 className="gg-sec-title" data-reveal>Recent grad shoots</h2>
          <p className="gg-sec-sub" data-reveal>Real sessions, real results.</p>
          {loading ? (
            <div className="gg-gallery">{[...Array(6)].map((_, i) => <div key={i} className="gg-gallery-skel" />)}</div>
          ) : photos.length > 0 ? (
            <div className="gg-gallery">
              {photos.map((photo) => (
                <div key={photo.id} className="gg-photo" data-reveal data-delay="1">
                  <img src={photo.image_url} alt={photo.caption || "Graduation photo"} loading="lazy" decoding="async" />
                  {photo.caption && <div className="gg-photo-cap"><span>{photo.caption}</span></div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="gg-empty" data-reveal>
              <p style={{ fontSize: 34, margin: "0 0 10px" }}>📷</p>
              <p style={{ margin: 0, fontWeight: 760, color: "var(--ink)" }}>Recent sessions appear here soon.</p>
            </div>
          )}
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
