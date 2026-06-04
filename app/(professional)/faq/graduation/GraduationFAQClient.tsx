"use client";

// ─────────────────────────────────────────────────────────────────────────────
// GRADUATION FAQ  →  soloxsnaps.com/faq/graduation
// Graduation-specific questions. General photography questions live at /faq.
// TO ADD/EDIT QUESTIONS: update the FAQS array below.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { AccordionItem, FAQ_CSS, type FAQGroup } from "../faqShared";

const FAQS: FAQGroup[] = [
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
        a: "Standard turnaround is up to two weeks from shoot day. If you need your photos faster, 72-hour full gallery delivery is available as an add-on for $150.",
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

// ── TOTAL QUESTION COUNT ──────────────────────────────────────────────────────

const TOTAL_Q = FAQS.reduce((sum, g) => sum + g.items.length, 0);

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default function GraduationFAQClient() {
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
          <Link href="/faq" className="faq-back">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            All FAQ
          </Link>
          <p className="faq-kicker">🎓 Graduation sessions</p>
          <h1 className="faq-hero-title">
            Grad photos,<br />
            <em>every detail covered.</em>
          </h1>
          <p className="faq-hero-sub">
            Caps, gowns, campus shoots, props, and grad-season timing — answered.
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
