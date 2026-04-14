// ─────────────────────────────────────────────────────────────────────────────
// ABOUT PAGE  →  soloxsnaps.com/about
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Hero      — light gray/glass header with "I'm Chris." title
//   2. Bio       — portrait photo (left) + bio text (right) on white
//   3. Approach  — 2-column: label/heading left, paragraphs right
//   4. Process   — numbered steps (Planning, Session, Delivery), glass cards
//   5. CTA strip — "Ready to work together?" frosted glass panel
//
// QUICK EDITS:
//   → Portrait photo:   change the `portrait` URL constant below
//   → Process steps:    edit the `process` array below
//   → Bio paragraphs:   find the Bio section in JSX and edit the <p> tags
//   → Approach text:    find the Approach section in JSX and edit the <p> tags
//   → Hero title:       find "I'm Chris." in the hero JSX
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About | soloxsnaps",
  description: "Meet Chris Solorzano, the San Francisco based photographer behind soloxsnaps.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About | soloxsnaps",
    description: "Meet Chris Solorzano, the San Francisco based photographer behind soloxsnaps.",
    type: "profile",
  },
};

// ── PORTRAIT PHOTO ────────────────────────────────────────────────────────────
// To change: upload to Supabase Storage and paste the URL here.
const portrait =
  "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/DSC02593_(2).jpg";

// ── PROCESS STEPS ─────────────────────────────────────────────────────────────
// Format: ["number", "Step name", "Description"]
const process = [
  ["01", "Planning",  "Location, timing, outfit notes, and the reason for the session get set before we shoot."],
  ["02", "Session",   "I give clear direction, then leave enough room for the in-between moments to happen naturally."],
  ["03", "Delivery",  "The final gallery is edited cleanly and delivered in a private online space, ready to share."],
];

const CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.97); }
    to   { opacity: 1; transform: scale(1); }
  }

  /* ── PAGE ─────────────────────────────────────────────────────────────────── */
  .about-page {
    background: #f5f6f4;
    color: #101412;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .about-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }

  /* ── HERO ─────────────────────────────────────────────────────────────────────
     Light gradient hero — clean and airy.
     padding-top: 120px clears the fixed nav bar + breathing room. */
  .about-hero {
    padding: 120px 0 72px;
    background:
      radial-gradient(ellipse 65% 60% at 5% 15%, rgba(162, 210, 196, 0.16) 0%, transparent 60%),
      radial-gradient(ellipse 55% 50% at 95% 85%, rgba(130, 185, 175, 0.12) 0%, transparent 55%),
      linear-gradient(to bottom, #eaf0ec 0%, #f5f6f4 100%);
    border-bottom: 1px solid rgba(18, 24, 22, 0.07);
  }
  .about-kicker {
    margin: 0 0 16px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
    animation: fadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .about-hero-title {
    margin: 0;
    color: #101412;
    font-size: clamp(3.5rem, 9vw, 8rem);
    font-weight: 900;
    letter-spacing: -0.035em;
    line-height: 0.88;
    text-wrap: balance;
    animation: fadeUp 0.65s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .about-hero-sub {
    margin: 22px 0 0;
    color: #4b5a55;
    font-size: 18px;
    line-height: 1.7;
    max-width: 460px;
    animation: fadeUp 0.65s 0.16s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* ── BIO SECTION ─────────────────────────────────────────────────────────── */
  .about-bio {
    background: #ffffff;
    padding: 80px 0 90px;
  }
  .about-bio-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 52px;
    align-items: start;
  }

  /* Portrait photo */
  .about-portrait-wrap {
    overflow: hidden;
    border-radius: 12px;
    background: #dfe8e4;
    box-shadow: 0 20px 60px rgba(18, 24, 22, 0.1);
  }
  .about-portrait-wrap img {
    width: 100%; max-height: 680px;
    object-fit: cover; display: block;
    transition: transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .about-portrait-wrap:hover img { transform: scale(1.03); }

  .about-bio-text { padding-top: 8px; }
  .about-section-kicker {
    margin: 0 0 16px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
  }
  .about-section-title {
    margin: 0 0 24px;
    color: #101412;
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 880;
    letter-spacing: -0.02em;
    line-height: 0.98;
    text-wrap: balance;
  }
  .about-body {
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.76;
    margin: 0 0 20px;
  }
  .about-body:last-of-type { margin-bottom: 34px; }

  /* ── BUTTON (shared) ─────────────────────────────────────────────────────── */
  .about-link {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    box-shadow: 0 8px 24px rgba(112, 139, 133, 0.05);
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .about-link:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
    box-shadow: 0 12px 28px rgba(112, 139, 133, 0.07);
  }
  .about-link[data-ghost] {
    border-color: rgba(18, 24, 22, 0.12);
    background: rgba(255, 255, 255, 0.72);
    color: #101412;
    box-shadow: none;
  }
  .about-link[data-ghost]:hover {
    background: #ffffff;
    box-shadow: 0 10px 22px rgba(18, 24, 22, 0.06);
  }

  /* ── APPROACH SECTION ────────────────────────────────────────────────────── */
  .about-approach {
    background: #f5f6f4;
    padding: 90px 0;
    border-top: 1px solid rgba(18, 24, 22, 0.07);
  }
  .about-approach-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.65fr) minmax(0, 1.35fr);
    gap: 72px;
    align-items: start;
  }
  .about-approach-label { position: sticky; top: 110px; }
  .about-approach-body p {
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.76;
    margin: 0 0 22px;
  }
  .about-approach-body p:last-child { margin-bottom: 0; }

  /* ── PROCESS SECTION ─────────────────────────────────────────────────────── */
  .about-process {
    background: #ffffff;
    padding: 90px 0;
    border-top: 1px solid rgba(18, 24, 22, 0.07);
  }
  .about-process-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.65fr) minmax(0, 1.35fr);
    gap: 72px;
    align-items: start;
  }
  .about-process-label { position: sticky; top: 110px; }

  /* Each numbered step — glass card with shimmer */
  .about-step {
    display: grid;
    grid-template-columns: 80px 1fr;
    gap: 20px;
    padding: 28px;
    margin-bottom: 12px;
    border: 1px solid rgba(18, 24, 22, 0.08);
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 6px 20px rgba(18, 24, 22, 0.05);
    position: relative;
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    align-items: start;
  }
  .about-step::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.38) 50%, transparent 70%);
    transform: translateX(-100%);
    transition: transform 0.65s cubic-bezier(0.22,1,0.36,1);
    pointer-events: none;
    z-index: 1;
  }
  .about-step:hover::before { transform: translateX(100%); }
  .about-step:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(18, 24, 22, 0.08);
  }
  .about-step:last-child { margin-bottom: 0; }
  .about-step-num {
    color: rgba(18, 24, 22, 0.15);
    font-size: 2.2rem;
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.04em;
  }
  .about-step-name {
    margin: 0 0 8px;
    color: #101412;
    font-size: 18px;
    font-weight: 860;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }
  .about-step-body {
    margin: 0;
    color: #4b5a55;
    font-size: 15px;
    line-height: 1.68;
  }

  /* ── BOTTOM CTA ──────────────────────────────────────────────────────────── */
  .about-cta {
    background: #f5f6f4;
    padding: 80px 0 100px;
    border-top: 1px solid rgba(18, 24, 22, 0.07);
    text-align: center;
  }
  /* Glass CTA card */
  .about-cta-card {
    display: inline-block;
    padding: 48px 56px;
    border: 1px solid rgba(18, 24, 22, 0.09);
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 12px 40px rgba(18, 24, 22, 0.07);
    text-align: center;
    max-width: 580px;
  }
  .about-cta-title {
    margin: 0 0 10px;
    color: #101412;
    font-size: clamp(1.6rem, 3.5vw, 2.6rem);
    font-weight: 880;
    letter-spacing: -0.02em;
    line-height: 1.05;
    text-wrap: balance;
  }
  .about-cta-sub {
    margin: 0 0 28px;
    color: #4b5a55;
    font-size: 16px;
    line-height: 1.65;
  }
  .about-cta-buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }

  /* ── RESPONSIVE ──────────────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .about-bio-grid,
    .about-approach-grid,
    .about-process-grid { grid-template-columns: 1fr; gap: 40px; }
    .about-approach-label,
    .about-process-label { position: static; }
  }
  @media (max-width: 760px) {
    .about-shell { width: min(1180px, calc(100% - 36px)); }
    .about-bio, .about-approach, .about-process { padding: 62px 0 70px; }
    .about-hero { padding: 100px 0 56px; }
    .about-hero-title { font-size: clamp(2.6rem, 12vw, 4rem); }
    .about-hero-sub { font-size: 16px; }
    .about-body, .about-approach-body p { font-size: 16px; }
    .about-section-title { font-size: 26px; }
    .about-step { grid-template-columns: 52px 1fr; padding: 20px; }
    .about-step-num { font-size: 1.6rem; }
    .about-cta-card { padding: 36px 28px; }
  }
`;

export default function ProfessionalAboutPage() {
  return (
    <main className="about-page">
      <style>{CSS}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────────────
           Light gradient header — airy and clean.
           TO CHANGE: edit h1 and p.about-hero-sub text below. */}
      <section className="about-hero">
        <div className="about-shell">
          <p className="about-kicker">About</p>
          <h1 className="about-hero-title">I&rsquo;m Chris.</h1>
          <p className="about-hero-sub">
            Bay Area photographer. Graduation portraits, families, and people worth documenting.
          </p>
        </div>
      </section>

      {/* ── BIO ───────────────────────────────────────────────────────────────────
           Portrait photo (left) + bio paragraphs (right).
           Portrait URL: change the `portrait` constant at the top of this file. */}
      <section className="about-bio">
        <div className="about-shell about-bio-grid">
          <div className="about-portrait-wrap" data-reveal="scale">
            <img src={portrait} alt="Chris Solorzano" loading="eager" decoding="async" />
          </div>
          <div className="about-bio-text" data-reveal data-delay="2">
            <p className="about-section-kicker">Photographer, Bay Area</p>
            <h2 className="about-section-title">Clean direction. Real moments.</h2>
            {/* ── Edit bio text here ── */}
            <p className="about-body">
              I photograph people with a clean, direct style built around light, timing, and calm
              direction. The work is polished, but the session should still feel like a real person
              made space for you.
            </p>
            <p className="about-body">
              My work spans Bay Area graduation portraits, families, individual portraits, and creative
              sessions. The common thread: strong light, clean composition, and images that still feel
              like the moment.
            </p>
            <Link href="/contact" className="about-link">Work with me</Link>
          </div>
        </div>
      </section>

      {/* ── APPROACH ─────────────────────────────────────────────────────────────
           2-column layout: sticky label (left), paragraphs (right).
           To change text: edit the <p> tags inside about-approach-body. */}
      <section className="about-approach">
        <div className="about-shell about-approach-grid">
          <div className="about-approach-label" data-reveal="left">
            <p className="about-section-kicker">Approach</p>
            <h2 className="about-section-title">Direction without the stiffness.</h2>
          </div>
          <div className="about-approach-body" data-reveal data-delay="2">
            {/* ── Edit approach paragraphs here ── */}
            <p>
              Sessions are built to feel clear and easy. I help with posing, pacing, location choices,
              and small adjustments so the final gallery feels intentional without flattening the person
              in front of the camera.
            </p>
            <p>
              My work spans Bay Area graduation portraits, individual portraits, small events, and
              creative sessions. The common thread: strong light, clean composition, and images that
              still feel like the moment.
            </p>
            <p>
              soloxsnaps is the professional home for that work. The warmer guides and behind-the-scenes
              journal live on the fun side of the site.
            </p>
          </div>
        </div>
      </section>

      {/* ── PROCESS ───────────────────────────────────────────────────────────────
           Numbered glass cards. Defined in the `process` array at top of file.
           To add a step: add another entry to `process`. */}
      <section className="about-process">
        <div className="about-shell about-process-grid">
          <div className="about-process-label">
            <p className="about-section-kicker">How it works</p>
            <h2 className="about-section-title">A simple rhythm from first note to final gallery.</h2>
          </div>
          <div>
            {process.map(([number, name, body], i) => (
              <div key={name} className="about-step" data-reveal data-delay={String(i + 1)}>
                <span className="about-step-num">{number}</span>
                <div>
                  <h3 className="about-step-name">{name}</h3>
                  <p className="about-step-body">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA STRIP ─────────────────────────────────────────────────────────────
           Frosted glass card centered on light gray background. */}
      <section className="about-cta">
        <div className="about-shell">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="about-cta-card glass-shimmer" data-reveal>
              <h2 className="about-cta-title">Ready to see what this could look like for you?</h2>
              <p className="about-cta-sub">Share your date and session idea. I&rsquo;ll handle the rest.</p>
              <div className="about-cta-buttons">
                <Link href="/contact"  className="about-link">Get in touch</Link>
                <Link href="/portfolio" className="about-link" data-ghost="">View the work</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
