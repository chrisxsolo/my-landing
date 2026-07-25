"use client";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GRAD_GUIDE_CSS, GG_SQUIGGLE_PATH } from "@/lib/gradGuide";

type PrepTip = { id: number; title: string; description: string; icon: string; order: number };

const DRAFT_PREP_TIPS: PrepTip[] = [
  { id: 1, title: "Get a good night's sleep", description: "Tired eyes, dull skin, and low energy all show up on camera. Skip the late night before your shoot and get at least 7-8 hours. Drink water the morning of. You'll look and feel sharper.", icon: "😴", order: 1 },
  { id: 2, title: "Don't rush — give yourself extra time", description: "Prep your outfit, stole, and cap the night before. Factor in drive time, parking, and getting to the location — arriving stressed shows up in your first few shots. Get there 10-15 minutes early.", icon: "⏰", order: 2 },
  { id: 3, title: "Eat something before we shoot", description: "A hungry subject is a distracted subject. Eat a real meal 1-2 hours before your session. Bring a small snack and water to the shoot too. We'll be moving around a lot.", icon: "🥗", order: 3 },
  { id: 4, title: "Keep your outfit simple", description: "You are the focus — not what you're wearing. Solid colors photograph far better than busy prints, stripes, or logos. Lighter colors underneath your gown create a nice contrast.", icon: "👗", order: 4 },
  { id: 5, title: "Iron or steam everything the night before", description: "Your gown comes folded and will have visible crease lines. Take it out the night before. Hang it in the bathroom while you shower and the steam will smooth most of it out.", icon: "👔", order: 5 },
  { id: 6, title: "Wear your stole with your outfit before the shoot", description: "Try your full look together at least once before the day of — stole, gown, outfit, shoes. Make sure everything works together and nothing clashes.", icon: "🎓", order: 6 },
  { id: 7, title: "Bring comfortable shoes for walking", description: "If you're wearing heels, bring flip-flops or flats as a backup. We'll be walking across campus and standing for extended stretches. Comfort translates on camera.", icon: "👠", order: 7 },
  { id: 8, title: "Go slightly bolder with makeup than usual", description: "Outdoor light and camera settings tend to flatten features. Add a bit more contour, define your brows slightly more, and opt for matte finishes over glossy.", icon: "💄", order: 8 },
  { id: 9, title: "Stick with a hairstyle you know", description: "Grad shoot day is not the time to try something new. Go with a style you've worn before and feel confident in. If you're booking a blowout, schedule it the morning of your shoot.", icon: "💇", order: 9 },
  { id: 10, title: "Jewelry is great — lose the smartwatch", description: "Earrings, necklaces, rings, and bracelets all add to the look. But leave the Apple Watch or Fitbit at home — it reads as out of place in grad photos.", icon: "💍", order: 10 },
  { id: 11, title: "Glasses will glare — plan ahead", description: "If you wear glasses, the lenses will catch light and create glare in outdoor shots. If you can remove the lenses beforehand, that's the cleanest fix.", icon: "👓", order: 11 },
  { id: 12, title: "Props that actually work", description: "Bring all your stoles and honor cords, a bouquet of flowers, champagne if you want that shot, or a calligraphy board. Skip smoke bombs, sparklers, balloons, and confetti.", icon: "🌸", order: 12 },
  { id: 13, title: "Bring a small towel and stay hydrated", description: "We're going to be moving around a lot. You will sweat. A small handkerchief or face towel goes a long way between shots. Keep water on you.", icon: "💧", order: 13 },
  { id: 14, title: "Communicate your vision before the shoot", description: "Send me any poses, locations, or photos you love before we meet. The more I know going in, the more efficiently we can move through the session.", icon: "💬", order: 14 },
];

const categories = [
  { label: "Preparation", ids: [1, 2, 3] },
  { label: "Clothing", ids: [4, 5, 6] },
  { label: "Hair & Makeup", ids: [7, 8, 9] },
  { label: "Accessories & Props", ids: [10, 11, 12] },
  { label: "Day Of", ids: [13, 14] },
];

const MARQUEE = ["Show Up Ready", "Sleep Well", "Eat First", "Steam Your Gown", "Golden Hour", "Bay Area Grads"];
const marquee = [...MARQUEE, ...MARQUEE];

export default function HowToPrepareClient() {
  const [tips, setTips] = useState<PrepTip[]>(DRAFT_PREP_TIPS);

  useEffect(() => {
    async function fetchTips() {
      try {
        const { data, error } = await supabase.from("grad_prep_tips").select("*").order("order", { ascending: true });
        if (error) console.error(error);
        if (data && data.length > 0) setTips(data);
      } catch (err) {
        console.error(err);
      }
    }
    fetchTips();
  }, []);

  return (
    <main className="gg-page">
      <style>{GRAD_GUIDE_CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="gg-hero">
        <span className="gg-hero-corner" style={{ top: 18, left: 18, borderTop: "2px solid rgba(112,139,133,0.32)", borderLeft: "2px solid rgba(112,139,133,0.32)" }} />
        <span className="gg-hero-corner" style={{ bottom: 18, right: 18, borderBottom: "2px solid rgba(112,139,133,0.32)", borderRight: "2px solid rgba(112,139,133,0.32)" }} />
        <span className="gg-dot" style={{ position: "absolute", top: 28, right: 30, width: 8, height: 8, borderRadius: 999, background: "#5b8a7a" }} />
        <div className="gg-hero-squiggle gg-float">
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none">
            <path className="gg-sq" d={GG_SQUIGGLE_PATH} stroke="#5b8a7a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="gg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="gg-kicker gg-afu1"><span className="gg-kicker-dot gg-dot" /> 03 — How to Prepare</p>
          <h1 className="gg-h1 gg-afu2">Show up</h1>
          <p className="gg-h1-script gg-afu3"><span className="gg-h1-accent">ready.</span><span className="gg-cursor gg-blink" /></p>
          <p className="gg-sub gg-afu4">The difference between a good session and a great one usually comes down to preparation. Here&rsquo;s everything you need to know before shoot day — broken down by category.</p>
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
              const catTips = tips.filter((t) => cat.ids.includes(t.id));
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
                            <p className="gg-tip-text">{tip.description}</p>
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
            <h2 className="gg-cta-title">You&rsquo;re ready. Let&rsquo;s shoot.</h2>
            <p className="gg-cta-sub">You&rsquo;ve got the poses, the outfit, and the prep list. Time to book.</p>
            <div className="gg-cta-actions">
              <Link href="/contact?school=Graduation" className="gg-btn gg-btn--ongreen">Book your shoot →</Link>
              <Link href="/grad-guide/what-to-wear" className="gg-btn gg-btn--onghost">← Back to Outfits</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
