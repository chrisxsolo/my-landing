"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Shared FAQ building blocks — used by the general FAQ (FAQClient) and the
// graduation FAQ (GraduationFAQClient). Keeps both page files small and the
// styling identical across them.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";

export type FAQGroup = {
  topic: string;
  emoji: string;
  items: { q: string; a: string }[];
};

// ── ANIMATED ACCORDION ITEM ───────────────────────────────────────────────────

export function AccordionItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="faq-item" style={{ animationDelay: `${index * 0.045}s` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`faq-item-btn${open ? " faq-item-btn--open" : ""}`}
      >
        <span className="faq-item-q">{q}</span>
        <span className={`faq-item-icon${open ? " faq-item-icon--open" : ""}`} aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      <div className={`faq-item-body${open ? " faq-item-body--open" : ""}`} aria-hidden={!open}>
        <div className="faq-item-body-inner">
          <p className="faq-item-a">{a}</p>
        </div>
      </div>
    </div>
  );
}

// ── SHARED CSS ─────────────────────────────────────────────────────────────────

export const FAQ_CSS = `
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

  /* ── GRADUATION BANNER (top CTA) ─────────────────────────────────────────────── */
  .faq-grad-banner {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 28px;
    padding: 16px 20px;
    border: 1px solid rgba(112,139,133,0.22);
    border-radius: 14px;
    background: rgba(255,255,255,0.66);
    backdrop-filter: blur(8px);
    box-shadow: 0 8px 24px rgba(18,24,22,0.05);
    animation: faq-fade-up 0.6s 0.2s cubic-bezier(0.22,1,0.36,1) both;
  }
  .faq-grad-banner-text {
    flex: 1;
    min-width: 200px;
  }
  .faq-grad-banner-title {
    margin: 0;
    font-size: 15px;
    font-weight: 820;
    color: #101412;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .faq-grad-banner-sub {
    margin: 4px 0 0;
    font-size: 13.5px;
    color: #667f79;
    line-height: 1.5;
  }
  .faq-grad-banner-btn {
    flex-shrink: 0;
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 20px;
    border-radius: 999px;
    background: #101412;
    color: #fff;
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  }
  .faq-grad-banner-btn:hover {
    transform: translateY(-2px);
    background: #1d2a26;
    box-shadow: 0 12px 26px rgba(18,24,22,0.16);
  }
  .faq-grad-banner-btn svg { transition: transform 0.18s ease; }
  .faq-grad-banner-btn:hover svg { transform: translateX(3px); }

  /* ── TOPIC PILLS ROW ───────────────────────────────────────────────────────── */
  .faq-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 28px;
    animation: faq-fade-up 0.6s 0.24s cubic-bezier(0.22,1,0.36,1) both;
  }
  .faq-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
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
    animation: faq-fade-up 0.6s 0.28s cubic-bezier(0.22,1,0.36,1) both;
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

  .faq-item-body {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.32s cubic-bezier(0.4,0,0.2,1);
  }
  .faq-item-body--open { grid-template-rows: 1fr; }
  /* Padding lives on the inner content (not the grid item) so the row collapses
     fully to 0 — padding on the grid item itself would never shrink. */
  .faq-item-body-inner { overflow: hidden; min-height: 0; }
  .faq-item-a {
    margin: 0;
    font-size: 15px;
    color: #4b5a55;
    line-height: 1.74;
    padding: 0 62px 18px 16px;
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

  /* ── BACK LINK (graduation page) ─────────────────────────────────────────────── */
  .faq-back {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 18px;
    color: #667f79;
    font-size: 13px;
    font-weight: 720;
    text-decoration: none;
    transition: color 0.18s ease, transform 0.18s ease;
    animation: faq-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }
  .faq-back:hover { color: #101412; transform: translateX(-3px); }

  @media (max-width: 760px) {
    .faq-shell  { width: min(800px, calc(100% - 36px)); }
    .faq-hero   { padding: 100px 0 52px; }
    .faq-hero-ring { display: none; }
    .faq-hero-sub { font-size: 16px; }
    .faq-body   { padding: 52px 0 72px; }
    .faq-item-a { padding-right: 16px; }
    .faq-cta-card { padding: 36px 24px; }
    .faq-pills { gap: 6px; }
    .faq-grad-banner { padding: 14px 16px; }
    .faq-grad-banner-btn { width: 100%; justify-content: center; }
  }
`;
