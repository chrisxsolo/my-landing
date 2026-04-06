"use client";

import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";
import { theme } from "@/lib/theme";

export const dynamic = 'force-dynamic'

type PrepTip = {
  id: number;
  title: string;
  description: string;
  icon: string;
  order: number;
};

const DRAFT_PREP_TIPS: PrepTip[] = [
  { id: 1, title: "Get a good night's sleep", description: "This sounds obvious but it matters more than people think. Tired eyes, dull skin, and low energy all show up on camera. Skip the late night before your shoot and get at least 7-8 hours. Drink water the morning of. You'll look and feel sharper.", icon: "😴", order: 1 },
  { id: 2, title: "Don't rush — give yourself extra time", description: "Prep your outfit, stole, and cap the night before. Don't leave anything to the morning of. Factor in drive time, parking, and getting to the location — arriving stressed shows up in your first few shots. Get there 10-15 minutes early and give yourself a moment to breathe before we start.", icon: "⏰", order: 2 },
  { id: 3, title: "Eat something before we shoot", description: "A hungry subject is a distracted subject. Eat a real meal 1-2 hours before your session — not right before, but enough ahead that you have real energy. Bring a small snack and water to the shoot too. We'll be moving around a lot.", icon: "🥗", order: 3 },
  { id: 4, title: "Keep your outfit simple", description: "You are the focus — not what you're wearing. Solid colors photograph far better than busy prints, stripes, or logos. Since your gown and stole tend to be rich and bold, lighter colors underneath create a nice contrast. Think ivory, cream, light neutrals, or soft pastels.", icon: "👗", order: 4 },
  { id: 5, title: "Iron or steam everything the night before", description: "Your gown comes folded and will have visible crease lines. Take it out of the package the night before — don't wait until the morning of. Hang it in the bathroom while you shower and the steam will smooth most of it out. Same goes for whatever you're wearing underneath.", icon: "👔", order: 5 },
  { id: 6, title: "Wear your stole with your outfit before the shoot", description: "Try your full look together at least once before the day of — stole, gown, outfit, shoes. You want to make sure everything works together and nothing clashes. It also helps you spot anything you need to fix while you still have time.", icon: "🎓", order: 6 },
  { id: 7, title: "Bring comfortable shoes for walking", description: "If you're wearing heels, bring flip-flops or flats as a backup. We'll be walking across campus and standing for extended stretches. Heels that sink into grass or make you wince aren't going to give you relaxed, confident energy in your photos. Comfort translates on camera.", icon: "👠", order: 7 },
  { id: 8, title: "Go slightly bolder with makeup than usual", description: "Outdoor light and camera settings tend to flatten features. Your everyday makeup look will read as too subtle in photos. Add a bit more contour, define your brows slightly more, and opt for matte finishes over glossy. Test your look near a window in natural light a few days before to see how it photographs.", icon: "💄", order: 8 },
  { id: 9, title: "Stick with a hairstyle you know", description: "Grad shoot day is not the time to try something new. Go with a style you've worn before and feel confident in — something you'd do for a wedding or a formal event. If you're booking a blowout, schedule it the morning of your shoot.", icon: "💇", order: 9 },
  { id: 10, title: "Jewelry is great — lose the smartwatch", description: "Earrings, necklaces, rings, and bracelets all add to the look. But leave the Apple Watch or Fitbit at home — it reads as out of place in grad photos and pulls attention away from your outfit.", icon: "💍", order: 10 },
  { id: 11, title: "Glasses will glare — plan ahead", description: "If you wear glasses, the lenses will catch light and create glare in outdoor shots. If you can remove the lenses beforehand, that's the cleanest fix. Otherwise plan to take them off for most shots and put them back on between poses.", icon: "👓", order: 11 },
  { id: 12, title: "Props that actually work", description: "Most people don't bring props and that's completely fine. But if you want to add something: bring all your stoles and honor cords, a bouquet of flowers (a full bouquet, not a single stem), champagne if you want that shot, or a calligraphy board with a message to someone who helped you get here. Skip smoke bombs, sparklers, balloons, and confetti — they create mess and aren't worth the cleanup.", icon: "🌸", order: 12 },
  { id: 13, title: "Bring a small towel and stay hydrated", description: "We're going to be moving around a lot, especially if we hit multiple locations. You will sweat. A small handkerchief or face towel goes a long way between shots. Keep water on you — hydration affects your skin, your energy, and your mood.", icon: "💧", order: 13 },
  { id: 14, title: "Communicate your vision before the shoot", description: "Send me any poses, locations, or photos you love before we meet. The more I know going in, the more efficiently we can move through the session. And during the shoot — speak up. If something doesn't feel right or you want to try a different angle, say so. You know what you want better than anyone.", icon: "💬", order: 14 },
];

const categories = [
  { label: "Preparation", ids: [1, 2, 3] },
  { label: "Clothing", ids: [4, 5, 6] },
  { label: "Hair & Makeup", ids: [7, 8, 9] },
  { label: "Accessories & Props", ids: [10, 11, 12] },
  { label: "Day Of", ids: [13, 14] },
];

export default function HowToPreparePage() {
  const [tips, setTips] = useState<PrepTip[]>(DRAFT_PREP_TIPS);
  const [loading, setLoading] = useState(false);
  const t = theme.prepare;

  useEffect(() => {
    async function fetchTips() {
      try {
        const { data, error } = await supabase
          .from('grad_prep_tips')
          .select('*')
          .order('order', { ascending: true })
        if (error) console.error(error)
        if (data && data.length > 0) setTips(data)
      } catch (err) {
        console.error(err)
      } finally {}
    }
    fetchTips()
  }, []);

  return (
    <div className="min-h-screen bg-white">

      {/* ── NAVBAR ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className={`font-black text-lg tracking-tight bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
            Chris.
          </Link>
          <Link href="/grad-guide" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            ← Grad Guide
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-14 pb-10">
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute rounded-full blur-[120px] opacity-15 w-[400px] h-[400px] -top-20 -left-10 ${t.blob}`} />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${t.pill} mb-4`}>
            <div className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
            <p className={`text-xs font-semibold tracking-[0.12em] uppercase ${t.label}`}>03 — How to Prepare</p>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-4 leading-tight">
            Show up{" "}
            <span className={`bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
              ready.
            </span>
          </h1>
          <p className="text-base text-slate-500 font-light leading-relaxed max-w-xl">
            The difference between a good session and a great one usually comes down to preparation. Here's everything you need to know before shoot day — broken down by category.
          </p>
        </div>
      </section>

      {/* ── TIPS BY CATEGORY ────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto space-y-12">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-slate-100 animate-pulse h-48" />
            ))
          ) : (
            categories.map((cat) => {
              const catTips = tips.filter((tip) => cat.ids.includes(tip.id));
              if (catTips.length === 0) return null;
              return (
                <div key={cat.label}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className={`text-xs font-bold tracking-[0.15em] uppercase ${t.divider}`}>{cat.label}</h2>
                    <div className="flex-1 h-px bg-black/[0.06]" />
                  </div>
                  <div className="space-y-3">
                    {catTips.map((tip) => (
                      <div key={tip.id} className={`bg-white rounded-2xl border border-black/[0.08] p-6 transition-all duration-200 ${t.hover}`}>
                        <div className="flex items-start gap-4">
                          <span className="text-2xl flex-shrink-0">{tip.icon}</span>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 mb-1.5 leading-tight">{tip.title}</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">{tip.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <div className={`bg-gradient-to-br ${t.cta} rounded-2xl p-8 text-white text-center`}>
            <h3 className="text-2xl font-black mb-2">You're ready. Let's shoot.</h3>
            <p className="text-white/70 mb-6 text-sm">You've got the poses, the outfit, and the prep list. Time to book.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <a href="https://www.soloxsnaps.com/contact/" className={`px-6 py-3 rounded-full bg-white ${t.ctaText} font-semibold text-sm hover:bg-white/90 transition-colors shadow-lg`}>
                Book your shoot →
              </a>
              <Link href="/grad-guide" className="px-5 py-2.5 rounded-full bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors border border-white/20">
                ← Back to guide
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="border-t border-black/[0.06] bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className={`font-black text-lg bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}