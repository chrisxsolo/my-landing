"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FAQClient — animated accordion FAQ page.
// TO ADD/EDIT QUESTIONS: update the FAQS array below.
// Each group: { topic, emoji, items: { q, a }[] }
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const FAQS: { topic: string; emoji: string; items: { q: string; a: string }[] }[] = [
  {
    topic: "Booking & Logistics",
    emoji: "📅",
    items: [
      {
        q: "How do I book a session?",
        a: "Send an inquiry through the contact page with your date, campus, and how many people. I'll reply within 24 hours with availability, pricing, and next steps. A 50% deposit reserves your date — the remaining balance is due on shoot day.",
      },
      {
        q: "How far in advance should I book?",
        a: "As early as possible — especially for May graduation season. Spring dates at UC Berkeley, SJSU, SF State, USF, and CSUEB fill up fast. If you have a specific date near your ceremony, reach out at least 3–4 weeks ahead.",
      },
      {
        q: "What's the deposit and when is it due?",
        a: "The deposit is 50% of the session total. It's due when you confirm your date and is non-refundable but transferable — it can be applied toward rescheduling or a future session with advance notice.",
      },
      {
        q: "What happens if I need to reschedule?",
        a: "Life happens. If you need to reschedule, reach out as early as possible. Your deposit transfers to the new date as long as I have availability. Last-minute cancellations (same day or day before) are not eligible for rescheduling.",
      },
      {
        q: "What if the weather is bad?",
        a: "Light overcast is actually great for portraits — it acts as a giant softbox and removes harsh shadows. Heavy rain or storms are the only reason to reschedule. We'll coordinate based on the forecast and both agree before moving anything.",
      },
    ],
  },
  {
    topic: "The Session",
    emoji: "📸",
    items: [
      {
        q: "I'm not photogenic / I hate being on camera. Will that be a problem?",
        a: "This is the most common thing I hear, and it's never actually a problem. I give clear, specific direction throughout — where to stand, where to look, how to hold yourself. You don't need to know how to pose. That's my job. Most clients are relaxed within the first 10 minutes.",
      },
      {
        q: "How long is the session?",
        a: "Standard sessions are 1 hour. Groups of 3 or more usually need at least 90 minutes to cover individual portraits plus group combinations. 2-hour sessions are available if you want more locations or more time.",
      },
      {
        q: "How many photos will I receive?",
        a: "You'll receive 50+ professionally edited images in your private gallery. The exact number depends on session length and group size — longer sessions and larger groups typically produce more deliverables.",
      },
      {
        q: "Can family members join the session?",
        a: "Yes. Family members are welcome to join for a portion of the session for group shots. Just let me know in advance so we can plan time for it. Note that family members don't count toward group pricing — group rates apply only to graduates shooting together.",
      },
      {
        q: "Can I bring my pet?",
        a: "Yes, as long as the campus allows it. Let me know in advance and we'll plan a few shots with them. Outdoor campus settings work well — just bring someone to hold the pet between shots so we can keep things moving.",
      },
      {
        q: "What props work well?",
        a: "Great options: all your stoles and honor cords, a bouquet of flowers, champagne (if you want that shot), or a custom calligraphy board. Skip the smoke bombs, sparklers, balloons, and confetti — they're messy on campus and distract from the portrait.",
      },
      {
        q: "Can I do a champagne pop shot?",
        a: "Yes — it's available as an add-on for $15. I'll plan it at the right moment in the session so it doesn't interrupt the flow. Just give me a heads-up when you book so we're both prepared.",
      },
    ],
  },
  {
    topic: "Outfits & Preparation",
    emoji: "👗",
    items: [
      {
        q: "How many outfits can I wear?",
        a: "Every session includes one outfit look. You can add a second outfit change for $75. If you do change, I'll build a short break into the session routing — just factor in 5–10 minutes for the swap.",
      },
      {
        q: "What should I wear under my gown?",
        a: "Solid colors photograph far better than busy prints, stripes, or logos. Lighter colors under your gown create a nice contrast. Avoid all-black if you can — it can flatten in certain lighting conditions.",
      },
      {
        q: "Should I steam my gown?",
        a: "Yes. Your gown comes folded and will have visible crease lines. Take it out the night before and hang it in the bathroom while you shower — steam will smooth most of it out. Iron stubborn creases if needed.",
      },
      {
        q: "Any tips for makeup and hair?",
        a: "Outdoor light and camera settings tend to flatten features slightly. Go a little bolder than your everyday look — add more contour, define your brows slightly, and opt for matte finishes over glossy. For hair, stick with a style you've worn before and feel confident in. Don't try something new on shoot day.",
      },
      {
        q: "What about glasses glare?",
        a: "Glasses lenses will catch light and create glare in outdoor shots. If you can remove just the lenses beforehand, that's the cleanest fix. If you can't, I'll angle your head slightly to minimize the reflection — it's manageable, just let me know.",
      },
    ],
  },
  {
    topic: "Delivery & Files",
    emoji: "🖼️",
    items: [
      {
        q: "How long until I receive my photos?",
        a: "Standard turnaround is up to two weeks from shoot day. If you need your photos faster, 72-hour expedited delivery is available as an add-on for $75.",
      },
      {
        q: "How are the photos delivered?",
        a: "You'll receive a link to a private online gallery. From there you can download all images directly — high resolution, ready to print or share. The gallery link is shareable if you want family members to download as well.",
      },
      {
        q: "Do you provide RAW files?",
        a: "RAW files are not included in standard sessions. The edited gallery is the deliverable. RAW files can be licensed separately starting at $500 — reach out if that's something you need.",
      },
      {
        q: "How many photos are edited?",
        a: "All delivered images are fully edited — color corrected, retouched, and export-ready. You won't receive unedited selects or a contact sheet. Every image in the gallery is finished.",
      },
    ],
  },
  {
    topic: "Locations & Travel",
    emoji: "📍",
    items: [
      {
        q: "Which campuses do you shoot at?",
        a: "I regularly shoot at UC Berkeley, SJSU, SF State, USF, CSU East Bay, and Santa Clara. I also cover other Bay Area locations — reach out with your campus or location and I'll confirm availability and any travel fees.",
      },
      {
        q: "Is there a travel fee?",
        a: "San Francisco locations (SF State, USF, and anywhere within SF city limits) have no travel fee. Travel fees apply for campuses outside SF: UC Berkeley ($35), CSU East Bay ($30), Santa Clara ($70), SJSU ($75). Palo Alto / Stanford is TBD — reach out to confirm.",
      },
      {
        q: "Can we shoot at multiple locations?",
        a: "Yes. Multiple on-campus locations are included in every session as part of the planned route. If you want to add a second distinct location (a different campus or off-campus spot), that's available as an add-on for $125.",
      },
    ],
  },
];

// ── ANIMATED ACCORDION ITEM ───────────────────────────────────────────────────

function AccordionItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!bodyRef.current) return;
    setHeight(open ? bodyRef.current.scrollHeight : 0);
  }, [open]);

  return (
    <div
      className="faq-item"
      style={{ animationDelay: `${index * 0.045}s` }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`faq-item-btn${open ? " faq-item-btn--open" : ""}`}
      >
        <span className="faq-item-q">{q}</span>
        <span className={`faq-item-icon${open ? " faq-item-icon--open" : ""}`} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      <div
        className="faq-item-body"
        style={{ height, overflow: "hidden", transition: "height 0.32s cubic-bezier(0.4,0,0.2,1)" }}
        aria-hidden={!open}
      >
        <div ref={bodyRef} className="faq-item-body-inner">
          <p className="faq-item-a">{a}</p>
        </div>
      </div>
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
  @keyframes faq-fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes faq-item-in {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes faq-float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-12px) rotate(4deg); }
  }
  @keyframes faq-float2 {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-8px) rotate(-3deg); }
  }
  @keyframes faq-spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .faq-page {
    background: #f5f6f4;
    color: #101412;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, sans-serif;
    overflow-x: hidden;
  }
  .faq-shell {
    width: min(800px, calc(100% - 48px));
    margin: 0 auto;
  }

  /* ── HERO ──────────────────────────────────────────────────────────────────── */
  .faq-hero {
    position: relative;
    padding: 118px 0 72px;
    background:
      radial-gradient(ellipse 70% 65% at 8% 20%, rgba(162,210,196,0.22) 0%, transparent 58%),
      radial-gradient(ellipse 55% 50% at 92% 80%, rgba(130,185,175,0.16) 0%, transparent 55%),
      linear-gradient(to bottom, #e6efea 0%, #f5f6f4 100%);
    border-bottom: 1px solid rgba(18,24,22,0.07);
    overflow: hidden;
  }

  /* floating decorative blobs in hero */
  .faq-hero-blob {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }
  .faq-hero-blob--1 {
    width: 340px; height: 340px;
    top: -120px; right: -80px;
    background: radial-gradient(circle, rgba(130,185,175,0.18) 0%, transparent 70%);
    animation: faq-float 8s ease-in-out infinite;
  }
  .faq-hero-blob--2 {
    width: 220px; height: 220px;
    bottom: -60px; left: 10%;
    background: radial-gradient(circle, rgba(162,210,196,0.14) 0%, transparent 70%);
    animation: faq-float2 6s ease-in-out infinite;
  }
  /* spinning ring in hero top-right */
  .faq-hero-ring {
    position: absolute;
    top: 40px; right: 60px;
    width: 90px; height: 90px;
    border: 1.5px dashed rgba(112,139,133,0.22);
    border-radius: 50%;
    animation: faq-spin-slow 18s linear infinite;
    pointer-events: none;
  }
  /* small dot accent */
  .faq-hero-dot {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
  }
  .faq-hero-dot--a { width:8px; height:8px; background:#8fbdb5; opacity:0.5; top:72px; left:18%; animation: faq-float 5s ease-in-out infinite; }
  .faq-hero-dot--b { width:5px; height:5px; background:#6fa89f; opacity:0.4; bottom:40px; right:22%; animation: faq-float2 7s ease-in-out infinite 1s; }

  .faq-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    animation: faq-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }
  .faq-hero-title {
    margin: 0;
    color: #101412;
    font-size: clamp(2.4rem, 5.5vw, 3.8rem);
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 0.94;
    text-wrap: balance;
    animation: faq-fade-up 0.6s 0.07s cubic-bezier(0.22,1,0.36,1) both;
  }
  .faq-hero-title em {
    font-style: normal;
    color: #4f8a7e;
  }
  .faq-hero-sub {
    margin: 20px 0 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.72;
    max-width: 500px;
    text-wrap: pretty;
    animation: faq-fade-up 0.6s 0.14s cubic-bezier(0.22,1,0.36,1) both;
  }

  /* ── TOPIC PILLS ROW ───────────────────────────────────────────────────────── */
  .faq-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 28px;
    animation: faq-fade-up 0.6s 0.2s cubic-bezier(0.22,1,0.36,1) both;
  }
  .faq-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border: 1px solid rgba(112,139,133,0.2);
    border-radius: 999px;
    background: rgba(255,255,255,0.7);
    backdrop-filter: blur(8px);
    color: #4b5a55;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, color 0.18s ease;
    text-decoration: none;
    font-family: inherit;
    border: none;
  }
  .faq-pill:hover {
    background: rgba(255,255,255,0.95);
    border: 1px solid rgba(112,139,133,0.35);
    transform: translateY(-2px);
    color: #101412;
  }

  /* ── COUNT BADGE ───────────────────────────────────────────────────────────── */
  .faq-count {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 20px;
    padding: 8px 16px;
    border-radius: 999px;
    background: rgba(18,24,22,0.05);
    font-size: 13px;
    font-weight: 700;
    color: #667f79;
    animation: faq-fade-up 0.6s 0.24s cubic-bezier(0.22,1,0.36,1) both;
  }
  .faq-count-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #8fbdb5;
  }

  /* ── BODY ──────────────────────────────────────────────────────────────────── */
  .faq-body { padding: 72px 0 96px; }

  /* ── GROUP ─────────────────────────────────────────────────────────────────── */
  .faq-group { margin-bottom: 56px; }
  .faq-group:last-child { margin-bottom: 0; }

  .faq-group-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }
  .faq-group-emoji {
    font-size: 20px;
    line-height: 1;
  }
  .faq-group-label {
    font-size: 12px;
    font-weight: 820;
    color: #667f79;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    flex: 1;
  }
  .faq-group-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(18,24,22,0.1), transparent);
  }

  /* ── ACCORDION ITEMS ───────────────────────────────────────────────────────── */
  .faq-item {
    border-radius: 10px;
    margin-bottom: 4px;
    border: 1px solid transparent;
    transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
    animation: faq-item-in 0.45s cubic-bezier(0.22,1,0.36,1) both;
  }
  .faq-item:hover {
    background: rgba(255,255,255,0.72);
    border-color: rgba(112,139,133,0.14);
    box-shadow: 0 4px 16px rgba(18,24,22,0.05);
  }

  .faq-item-btn {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 18px 16px;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    border-radius: 10px;
  }
  .faq-item-btn--open {
    background: rgba(255,255,255,0.88);
  }

  .faq-item-q {
    font-size: 15.5px;
    font-weight: 720;
    color: #101412;
    line-height: 1.38;
    flex: 1;
    transition: color 0.18s ease;
  }
  .faq-item-btn:hover .faq-item-q,
  .faq-item-btn--open .faq-item-q {
    color: #0d1a17;
  }

  .faq-item-icon {
    flex-shrink: 0;
    width: 30px; height: 30px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    border: 1px solid rgba(18,24,22,0.1);
    background: rgba(247,250,248,0.9);
    color: #667f79;
    transition: background 0.22s ease, color 0.22s ease, border-color 0.22s ease, transform 0.32s cubic-bezier(0.4,0,0.2,1);
  }
  .faq-item-btn:hover .faq-item-icon {
    background: #fff;
    border-color: rgba(112,139,133,0.3);
    color: #4f6d67;
  }
  .faq-item-icon--open {
    background: #101412 !important;
    border-color: #101412 !important;
    color: #fff !important;
    transform: rotate(180deg);
  }

  .faq-item-body-inner { padding: 0 16px 18px 16px; }
  .faq-item-a {
    margin: 0;
    font-size: 15px;
    color: #4b5a55;
    line-height: 1.74;
    padding-right: 46px;
  }

  /* ── CTA ───────────────────────────────────────────────────────────────────── */
  .faq-cta {
    position: relative;
    background: #ffffff;
    border-top: 1px solid rgba(18,24,22,0.06);
    padding: 80px 0 100px;
    overflow: hidden;
  }
  .faq-cta::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 80% at 80% 50%, rgba(162,210,196,0.1) 0%, transparent 60%),
      radial-gradient(ellipse 40% 60% at 20% 50%, rgba(130,185,175,0.08) 0%, transparent 55%);
    pointer-events: none;
  }
  .faq-cta-inner {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .faq-cta-card {
    position: relative;
    padding: 52px 56px;
    border: 1px solid rgba(18,24,22,0.09);
    border-radius: 20px;
    background: #f5f6f4;
    box-shadow: 0 16px 48px rgba(18,24,22,0.08);
    max-width: 540px;
    width: 100%;
    overflow: hidden;
  }
  /* shimmer sweep on cta card */
  .faq-cta-card::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.45) 50%, transparent 70%);
    transform: translateX(-100%);
    transition: transform 0.7s cubic-bezier(0.22,1,0.36,1);
    pointer-events: none;
  }
  .faq-cta-card:hover::after { transform: translateX(100%); }

  .faq-cta-title {
    margin: 0 0 10px;
    color: #101412;
    font-size: clamp(1.6rem, 3.5vw, 2.2rem);
    font-weight: 880;
    letter-spacing: -0.02em;
    line-height: 1.05;
    text-wrap: balance;
  }
  .faq-cta-sub {
    margin: 0 0 30px;
    color: #4b5a55;
    font-size: 16px;
    line-height: 1.65;
  }
  .faq-cta-buttons {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .faq-link {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 22px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 820;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    text-decoration: none;
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .faq-link--primary {
    border: 1px solid rgba(112,139,133,0.22);
    background: rgba(246,250,248,0.94);
    color: #4f6d67;
    box-shadow: 0 8px 24px rgba(112,139,133,0.05);
  }
  .faq-link--primary:hover {
    transform: translateY(-2px);
    background: rgba(239,246,244,0.98);
    box-shadow: 0 14px 30px rgba(112,139,133,0.1);
  }
  .faq-link--ghost {
    border: 1px solid rgba(18,24,22,0.12);
    background: rgba(255,255,255,0.72);
    color: #101412;
  }
  .faq-link--ghost:hover {
    transform: translateY(-2px);
    background: #ffffff;
    box-shadow: 0 10px 22px rgba(18,24,22,0.06);
  }

  @media (max-width: 760px) {
    .faq-shell  { width: min(800px, calc(100% - 36px)); }
    .faq-hero   { padding: 100px 0 52px; }
    .faq-hero-ring { display: none; }
    .faq-hero-sub { font-size: 16px; }
    .faq-body   { padding: 52px 0 72px; }
    .faq-item-a { padding-right: 0; }
    .faq-cta-card { padding: 36px 24px; }
    .faq-pills { gap: 6px; }
  }
`;

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
      <style>{CSS}</style>

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
            Booking, sessions, outfits, delivery, locations — answered.
            Still have something? The contact page is one click away.
          </p>

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
              Send the date, campus, and anything you&rsquo;re not sure about.
              I reply within 24 hours.
            </p>
            <div className="faq-cta-buttons">
              <Link href="/contact" className="faq-link faq-link--primary">Send a message</Link>
              <Link href="/pricing/grads" className="faq-link faq-link--ghost">See grad pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
