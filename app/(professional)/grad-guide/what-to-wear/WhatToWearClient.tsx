"use client";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GRAD_GUIDE_CSS, GG_SQUIGGLE_PATH } from "@/lib/gradGuide";

type OutfitTip = { id: number; title: string; tip: string; icon: string; order: number };

const DRAFT_OUTFITS: OutfitTip[] = [
  { id: 1, title: "Keep it simple — you're the focus", tip: "Your outfit should complement you, not compete with you. Solid colors, clean lines, and minimal patterns are always the right call. The more simple your outfit, the more timeless your photos will look.", icon: "✨", order: 1 },
  { id: 2, title: "Go lighter to contrast your stole and gown", tip: "Graduation gowns and stoles tend to be dark and color-heavy. Wearing something lighter underneath — ivory, cream, soft white, blush, or light neutrals — creates a natural contrast that makes the whole look more balanced in photos.", icon: "🎨", order: 2 },
  { id: 3, title: "Avoid busy prints entirely", tip: "Stripes, plaid, polka dots, florals, and anything with text or logos will fight for attention in your photos. The camera always finds the busiest thing in the frame — make sure that's you.", icon: "🚫", order: 3 },
  { id: 4, title: "Steam and hang everything the night before", tip: "Your gown will have fold lines from the package — take it out at least the night before. Hang it in the bathroom while you shower to let the steam work out the creases.", icon: "👔", order: 4 },
  { id: 5, title: "Try your full look together before the day", tip: "Put on your outfit, stole, gown, and shoes together at least once before your session. Make sure everything works as a complete look and nothing clashes.", icon: "🪞", order: 5 },
  { id: 6, title: "Bring comfortable shoes for walking", tip: "We'll cover a lot of ground during the session. If you're wearing heels, bring a pair of flip-flops or flats as backup. Heels that sink into grass affect your posture and energy.", icon: "👠", order: 6 },
  { id: 7, title: "Exaggerate your makeup slightly for camera", tip: "Outdoor light and camera sensors flatten features more than you'd expect. Add more definition to your brows, a bit more contour, and go with matte over glossy finishes.", icon: "💄", order: 7 },
  { id: 8, title: "Go with a hairstyle you already know", tip: "This isn't the day to experiment with something new. Pick a style you've worn before and feel confident in. If you're booking a blowout, schedule it for the morning of your session.", icon: "💇", order: 8 },
  { id: 10, title: "Get your haircut a few days before — not day of", tip: "A lot of guys don't love how they look immediately after a fresh cut. Get it done 2-3 days before your session so it has time to settle into its natural shape.", icon: "✂️", order: 10 },
  { id: 11, title: "Groom your facial hair before the shoot", tip: "If your beard or mustache is part of your look, keep it — just make sure it's clean and shaped. Trim it up a few days before.", icon: "🪒", order: 11 },
  { id: 12, title: "Jewelry works — smartwatches don't", tip: "Earrings, necklaces, rings, and bracelets all add to your look and photograph well. Leave the Apple Watch or Fitbit at home.", icon: "💍", order: 12 },
  { id: 13, title: "Plan ahead if you wear glasses", tip: "Lenses catch outdoor light and create glare in photos. If possible, remove the lenses from the frames before your session — that's the cleanest fix.", icon: "👓", order: 13 },
];

const categories = [
  { label: "General", ids: [1, 2, 3, 4, 5] },
  { label: "For Her", ids: [6, 7, 8, 9] },
  { label: "For Him", ids: [10, 11] },
  { label: "Accessories", ids: [12, 13] },
];

const MARQUEE = ["What to Wear", "Outfit Tips", "Colors That Pop", "Fit Matters", "Look Your Best", "Bay Area Shoots"];
const marquee = [...MARQUEE, ...MARQUEE];

export default function WhatToWearClient() {
  const [outfits, setOutfits] = useState<OutfitTip[]>(DRAFT_OUTFITS);

  useEffect(() => {
    async function fetchOutfits() {
      try {
        const { data, error } = await supabase.from("grad_outfits").select("*").order("order", { ascending: true });
        if (error) console.error(error);
        if (data && data.length > 0) setOutfits(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchOutfits();
  }, []);

  return (
    <main className="gg-page">
      <style>{GRAD_GUIDE_CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="gg-hero">
        <span className="gg-hero-corner" style={{ top: 18, left: 18, borderTop: "2px solid rgba(112,139,133,0.32)", borderLeft: "2px solid rgba(112,139,133,0.32)" }} />
        <span className="gg-hero-corner" style={{ bottom: 18, right: 18, borderBottom: "2px solid rgba(112,139,133,0.32)", borderRight: "2px solid rgba(112,139,133,0.32)" }} />
        <span className="gg-dot" style={{ position: "absolute", top: 28, left: 30, width: 8, height: 8, borderRadius: 999, background: "#5b8a7a" }} />
        <div className="gg-hero-squiggle gg-float">
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none">
            <path className="gg-sq" d={GG_SQUIGGLE_PATH} stroke="#5b8a7a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="gg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="gg-kicker gg-afu1"><span className="gg-kicker-dot gg-dot" /> 02 — What to Wear</p>
          <h1 className="gg-h1 gg-afu2">Outfits that</h1>
          <p className="gg-h1-script gg-afu3"><span className="gg-h1-accent">photograph.</span><span className="gg-cursor gg-blink" /></p>
          <p className="gg-sub gg-afu4">What looks great in a mirror and what looks great on camera are often different things. Here&rsquo;s exactly what works — broken down by category.</p>
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

      {/* ── TIPS BY CATEGORY ───────────────────────────────────────────────── */}
      <section className="gg-section">
        <div className="gg-shell">
          <div className="gg-cats">
            {categories.map((cat) => {
              const catTips = outfits.filter((o) => cat.ids.includes(o.id));
              if (catTips.length === 0) return null;
              return (
                <div key={cat.label} data-reveal>
                  <div className="gg-cat-head">
                    <span className="gg-cat-label">{cat.label}</span>
                    <span className="gg-cat-line" />
                  </div>
                  <div className="gg-tips">
                    {catTips.map((tip) => (
                      <div key={tip.id} className="gg-tip">
                        <span className="gg-tip-bar" />
                        <div className="gg-tip-row">
                          <span className="gg-tip-emoji">{tip.icon}</span>
                          <div>
                            <h3 className="gg-tip-title">{tip.title}</h3>
                            <p className="gg-tip-text">{tip.tip}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="gg-cta">
        <div className="gg-shell">
          <div className="gg-cta-card glass-shimmer" data-reveal>
            <div className="gg-cta-squiggle">
              <svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
            </div>
            <h2 className="gg-cta-title">Outfit locked in?</h2>
            <p className="gg-cta-sub">Now let&rsquo;s make sure you show up ready on shoot day.</p>
            <div className="gg-cta-actions">
              <Link href="/grad-guide/how-to-prepare" className="gg-btn gg-btn--ongreen">Next: How to Prepare →</Link>
              <Link href="/grad-guide/posing" className="gg-btn gg-btn--onghost">← Back to Posing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
