"use client";

import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";

type OutfitTip = {
  id: number;
  title: string;
  tip: string;
  icon: string;
  order: number;
};

const DRAFT_OUTFITS: OutfitTip[] = [
  {
    id: 1,
    title: "Keep it simple — you're the focus",
    tip: "Your outfit should complement you, not compete with you. The camera should land on your face first, not your clothes. Solid colors, clean lines, and minimal patterns are always the right call. The more simple your outfit, the more timeless your photos will look.",
    icon: "✨",
    order: 1,
  },
  {
    id: 2,
    title: "Go lighter to contrast your stole and gown",
    tip: "Graduation gowns and stoles tend to be dark and color-heavy. Wearing something lighter underneath — ivory, cream, soft white, blush, or light neutrals — creates a natural contrast that makes the whole look more balanced in photos. Bold outfit colors can work but save them as a second outfit option.",
    icon: "🎨",
    order: 2,
  },
  {
    id: 3,
    title: "Avoid busy prints entirely",
    tip: "Stripes, plaid, polka dots, florals, and anything with text or logos will fight for attention in your photos. The camera always finds the busiest thing in the frame — make sure that's you. If you want texture, go for subtle fabric texture like linen, chiffon, or satin rather than printed patterns.",
    icon: "🚫",
    order: 3,
  },
  {
    id: 4,
    title: "Steam and hang everything the night before",
    tip: "Your gown will have fold lines from the package — take it out at least the night before, not the morning of. Hang it in the bathroom while you shower to let the steam work out the creases. Do the same for your outfit. Wrinkled clothes are one of the most common things people wish they'd handled before their shoot.",
    icon: "👔",
    order: 4,
  },
  {
    id: 5,
    title: "Try your full look together before the day",
    tip: "Put on your outfit, stole, gown, and shoes together at least once before your session. Make sure everything works as a complete look and nothing clashes. This also gives you time to swap something out if it doesn't feel right — which is much harder to do the morning of.",
    icon: "🪞",
    order: 5,
  },
  {
    id: 6,
    title: "Bring comfortable shoes for walking",
    tip: "We'll cover a lot of ground during the session, so if you're wearing heels, bring a pair of flip-flops or flats as backup. Heels that sink into grass or make you wince are going to affect your posture and your energy. Wedges and block heels are solid options if you want height without the instability.",
    icon: "👠",
    order: 6,
  },
  {
    id: 7,
    title: "Exaggerate your makeup slightly for camera",
    tip: "Outdoor light and camera sensors flatten features more than you'd expect. Your everyday makeup will look too subtle in photos. A few days before your shoot, apply your makeup near a window in natural light and take a few test photos. You'll likely need to add more definition to your brows, a bit more contour, and go with matte over glossy finishes.",
    icon: "💄",
    order: 7,
  },
  {
    id: 8,
    title: "Go with a hairstyle you already know",
    tip: "This isn't the day to experiment with something new. Pick a style you've worn before and feel confident in — something you'd wear to a formal event or a wedding. If you're booking a blowout, schedule it for the morning of your session so it's fresh.",
    icon: "💇",
    order: 8,
  },
  {
    id: 9,
    title: "Match your undergarments to your outfit",
    tip: "If you're wearing light-colored clothing, make sure what's underneath matches in tone — otherwise it will be visible in photos. You don't necessarily need strapless (the stole covers a lot) but it definitely helps for a cleaner look.",
    icon: "👙",
    order: 9,
  },
  {
    id: 10,
    title: "Get your haircut a few days before — not the day of",
    tip: "A lot of guys don't love how they look immediately after a fresh cut. Get it done 2-3 days before your session so it has time to settle into its natural shape. Stick with your usual style — something you're already comfortable with.",
    icon: "✂️",
    order: 10,
  },
  {
    id: 11,
    title: "Groom your facial hair before the shoot",
    tip: "If your beard or mustache is part of your look, keep it — just make sure it's clean and shaped. Trim it up a few days before. Showing up with ungroomed facial hair is one of those small details that shows up clearly in photos.",
    icon: "🪒",
    order: 11,
  },
  {
    id: 12,
    title: "Jewelry works — smartwatches don't",
    tip: "Earrings, necklaces, rings, and bracelets all add to your look and photograph well. Leave the Apple Watch or Fitbit at home though — it reads as out of place and pulls attention away from your outfit.",
    icon: "💍",
    order: 12,
  },
  {
    id: 13,
    title: "Plan ahead if you wear glasses",
    tip: "Lenses catch outdoor light and create glare in photos. If possible, remove the lenses from the frames before your session — that's the cleanest fix. Otherwise plan to take them off for most shots. We can work around it but it's easier to plan for it ahead of time.",
    icon: "👓",
    order: 13,
  },
];

const categories = [
  { label: "General", ids: [1, 2, 3, 4, 5], color: "text-violet-600" },
  { label: "For Her", ids: [6, 7, 8, 9], color: "text-violet-600" },
  { label: "For Him", ids: [10, 11], color: "text-violet-600" },
  { label: "Accessories", ids: [12, 13], color: "text-violet-600" },
];

export default function WhatToWearPage() {
  const [outfits, setOutfits] = useState<OutfitTip[]>(DRAFT_OUTFITS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchOutfits() {
      try {
        const { data, error } = await supabase
          .from('grad_outfits')
          .select('*')
          .order('order', { ascending: true })
        if (error) console.error(error)
        if (data && data.length > 0) setOutfits(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchOutfits()
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FF]">

      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Chris.
          </Link>
          <Link href="/grad-guide" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            ← Grad Guide
          </Link>
        </div>
      </nav>

      <section className="relative overflow-hidden px-6 pt-14 pb-10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute rounded-full blur-[100px] opacity-20 w-[400px] h-[400px] -top-20 -right-10 bg-gradient-to-br from-violet-400 to-purple-500" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-violet-600 mb-3">
            02 — What to Wear
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-4 leading-tight">
            Outfits that{" "}
            <span className="bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              photograph.
            </span>
          </h1>
          <p className="text-base text-slate-500 font-light leading-relaxed max-w-xl">
            What looks great in a mirror and what looks great on camera are often different things.
            Here's exactly what works — broken down by category — so you show up looking your best.
          </p>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto space-y-12">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-slate-200 animate-pulse h-48" />
            ))
          ) : (
            categories.map((cat) => {
              const catTips = outfits.filter((t) => cat.ids.includes(t.id));
              if (catTips.length === 0) return null;
              return (
                <div key={cat.label}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-xs font-bold tracking-[0.15em] uppercase text-violet-600">
                      {cat.label}
                    </h2>
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                  <div className="space-y-3">
                    {catTips.map((tip) => (
                      <div
                        key={tip.id}
                        className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-violet-200 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="flex items-start gap-4">
                          <span className="text-2xl flex-shrink-0">{tip.icon}</span>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 mb-1.5 leading-tight">
                              {tip.title}
                            </h3>
                            <p className="text-slate-500 text-sm leading-relaxed">
                              {tip.tip}
                            </p>
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

      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <div className="bg-gradient-to-br from-violet-600 to-purple-600 rounded-2xl p-8 text-white text-center">
            <h3 className="text-2xl font-black mb-2">Outfit locked in?</h3>
            <p className="text-violet-100 mb-6 text-sm">
              Now let's make sure you show up ready on shoot day.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/grad-guide/how-to-prepare"
                className="px-5 py-2.5 rounded-full bg-white text-violet-600 font-semibold text-sm hover:bg-violet-50 transition-colors"
              >
                Next: How to Prepare →
              </Link>
              <Link
                href="/grad-guide/posing"
                className="px-5 py-2.5 rounded-full bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors border border-white/20"
              >
                ← Back to Posing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>

    </div>
  );
}
