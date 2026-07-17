"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT FAQ  →  soloxsnaps.com/portrait-guide/faq
// Portrait-session questions. Reuses the shared FAQ accordion + styling so it
// looks identical to the general, graduation, family, and couples FAQ pages.
// TO ADD/EDIT QUESTIONS: update portraitFaqData.ts (also feeds FAQPage JSON-LD).
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { AccordionItem, FAQ_CSS } from "../../faq/faqShared";
import { FAQS } from "./portraitFaqData";

const TOTAL_Q = FAQS.reduce((sum, g) => sum + g.items.length, 0);
const PORTRAIT_CONTACT = "/contact?sessionType=Individual+Portrait";

export default function PortraitFaqClient() {
  function scrollToGroup(topic: string) {
    const el = document.getElementById(`faq-group-${topic}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="faq-page">
      <style>{FAQ_CSS}</style>

      <section className="faq-hero">
        <div className="faq-hero-blob faq-hero-blob--1" />
        <div className="faq-hero-blob faq-hero-blob--2" />
        <div className="faq-hero-ring" aria-hidden="true" />
        <div className="faq-hero-dot faq-hero-dot--a" aria-hidden="true" />
        <div className="faq-hero-dot faq-hero-dot--b" aria-hidden="true" />

        <div className="faq-shell" style={{ position: "relative", zIndex: 1 }}>
          <Link href="/portrait-guide" className="faq-back">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Portrait guide
          </Link>
          <p className="faq-kicker">🙋 Portrait sessions</p>
          <h1 className="faq-hero-title">
            Portrait photos,<br />
            <em>your questions answered.</em>
          </h1>
          <p className="faq-hero-sub">
            Booking, posing nerves, what to wear, locations, branding photos, delivery, and
            San Francisco fog — all in one place. Still wondering something? The contact page is one click away.
          </p>

          <div className="faq-pills" role="navigation" aria-label="Jump to topic">
            {FAQS.map((g) => (
              <button key={g.topic} className="faq-pill" onClick={() => scrollToGroup(g.topic)} type="button">
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

      <section className="faq-body">
        <div className="faq-shell">
          {FAQS.map((group) => (
            <div key={group.topic} id={`faq-group-${group.topic}`} className="faq-group" style={{ scrollMarginTop: 96 }}>
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

      <section className="faq-cta">
        <div className="faq-shell faq-cta-inner">
          <div className="faq-cta-card">
            <h2 className="faq-cta-title">Still have a question?</h2>
            <p className="faq-cta-sub">
              Send your date, what the photos are for, and the location you have in mind. I reply within 24 hours.
            </p>
            <div className="faq-cta-buttons">
              <Link href={PORTRAIT_CONTACT} className="faq-link faq-link--primary">Inquire about a session</Link>
              <Link href="/portrait-guide" className="faq-link faq-link--ghost">Read the portrait guide</Link>
              <Link href="/pricing" className="faq-link faq-link--ghost">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
