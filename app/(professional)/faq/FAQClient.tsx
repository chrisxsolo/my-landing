"use client";

// ─────────────────────────────────────────────────────────────────────────────
// GENERAL FAQ  →  soloxsnaps.com/faq
// Covers portraits, couples, family, maternity, and creative/lifestyle sessions
// plus general booking. Graduation-specific questions live at /faq/graduation.
// TO ADD/EDIT QUESTIONS: update the FAQS array below.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { AccordionItem, FAQ_CSS } from "./faqShared";
import { FAQS } from "./faqData";

// ── TOTAL QUESTION COUNT ──────────────────────────────────────────────────────

const TOTAL_Q = FAQS.reduce((sum, g) => sum + g.items.length, 0);

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default function FAQClient() {
  // Scroll to group when a pill is clicked
  function scrollToGroup(topic: string) {
    const el = document.getElementById(`faq-group-${topic}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="faq-page">
      <style>{FAQ_CSS}</style>

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="faq-hero">
        {/* decorative elements */}
        <div className="faq-hero-blob faq-hero-blob--1" />
        <div className="faq-hero-blob faq-hero-blob--2" />
        <div className="faq-hero-ring" aria-hidden="true" />
        <div className="faq-hero-dot faq-hero-dot--a" aria-hidden="true" />
        <div className="faq-hero-dot faq-hero-dot--b" aria-hidden="true" />

        <div className="faq-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="faq-kicker">Common questions</p>
          <h1 className="faq-hero-title">
            Everything you&rsquo;ve<br />
            <em>probably wondered.</em>
          </h1>
          <p className="faq-hero-sub">
            Booking, sessions, outfits, delivery, locations — answered, for every
            kind of shoot. Still have something? The contact page is one click away.
          </p>

          {/* graduation FAQ CTA */}
          <div className="faq-grad-banner">
            <div className="faq-grad-banner-text">
              <p className="faq-grad-banner-title">
                <span aria-hidden="true">🎓</span> Looking for graduation photo questions?
              </p>
              <p className="faq-grad-banner-sub">
                Caps, gowns, campus shoots, and grad-season timing have their own page.
              </p>
            </div>
            <Link href="/faq/graduation" className="faq-grad-banner-btn">
              View Graduation FAQ
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>

          {/* quick-jump pills */}
          <div className="faq-pills" role="navigation" aria-label="Jump to topic">
            {FAQS.map((g) => (
              <button
                key={g.topic}
                className="faq-pill"
                onClick={() => scrollToGroup(g.topic)}
                type="button"
              >
                <span>{g.emoji}</span> {g.topic}
              </button>
            ))}
          </div>

          <div className="faq-count">
            <span className="faq-count-dot" />
            {TOTAL_Q} questions answered
          </div>
        </div>
      </section>

      {/* ── FAQ ACCORDION ─────────────────────────────────────────────────────── */}
      <section className="faq-body">
        <div className="faq-shell">
          {FAQS.map((group) => (
            <div
              key={group.topic}
              id={`faq-group-${group.topic}`}
              className="faq-group"
              style={{ scrollMarginTop: 96 }}
            >
              <div className="faq-group-header">
                <span className="faq-group-emoji" aria-hidden="true">{group.emoji}</span>
                <span className="faq-group-label">{group.topic}</span>
                <span className="faq-group-line" />
              </div>
              {group.items.map((item, i) => (
                <AccordionItem key={item.q} q={item.q} a={item.a} index={i} />
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────────── */}
      <section className="faq-cta">
        <div className="faq-shell faq-cta-inner">
          <div className="faq-cta-card">
            <h2 className="faq-cta-title">Still have a question?</h2>
            <p className="faq-cta-sub">
              Tell me what kind of session you&rsquo;re after, your ideal date and
              location, and anything you&rsquo;re unsure about. I reply within 24 hours.
            </p>
            <div className="faq-cta-buttons">
              <Link href="/contact" className="faq-link faq-link--primary">Send a message</Link>
              <Link href="/pricing" className="faq-link faq-link--ghost">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
