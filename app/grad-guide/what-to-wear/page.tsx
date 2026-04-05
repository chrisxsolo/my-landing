"use client";
import { supabase } from '@/lib/supabase'

import Link from "next/link";
import { useEffect, useState } from "react";

type OutfitTip = {
  id: number;
  title: string;
  image_url: string;
  tip: string;
  order: number;
};

const DRAFT_OUTFITS: OutfitTip[] = [
  {
    id: 1,
    title: "Solid, Rich Colors",
    image_url: "",
    tip: "Solid colors photograph far better than busy patterns. Rich jewel tones — navy, emerald, burgundy, dusty rose — look stunning in photos and stand out against most Bay Area backdrops. Avoid neon, white, or very light pastels which tend to wash out in bright outdoor light.",
    order: 1,
  },
  {
    id: 2,
    title: "Dress or Skirt Length Matters",
    image_url: "",
    tip: "If you're wearing a dress or skirt under your gown, aim for midi length (hits below the knee). It shows elegantly when the gown opens or blows in the wind, and photographs well from every angle. Mini lengths can look unintentionally short in seated or step poses.",
    order: 2,
  },
  {
    id: 3,
    title: "Shoes You Can Actually Walk In",
    image_url: "",
    tip: "You'll be walking, standing, and posing on uneven terrain for 1-2 hours. Block heels, wedges, or dressy flats are your best friends. Stilettos sink into grass and make candid walking shots look uncomfortable. The most important thing is that you feel confident moving in them.",
    order: 3,
  },
  {
    id: 4,
    title: "Avoid Busy Prints",
    image_url: "",
    tip: "Florals, stripes, plaid, and logos compete with your face in photos. The camera draws your eye to the busiest part of the frame — you want that to be you, not your outfit. Subtle texture (linen, chiffon, satin) adds visual interest without distraction.",
    order: 4,
  },
  {
    id: 5,
    title: "Coordinate, Don't Match",
    image_url: "",
    tip: "If you're shooting with family or a partner, you don't need to match exactly. Pick a color palette (earth tones, blues, neutrals) and let everyone dress within it. Coordinated outfits look intentional and pull together beautifully in group shots without looking like a uniform.",
    order: 5,
  },
  {
    id: 6,
    title: "Hair and Makeup for Camera",
    image_url: "",
    tip: "Camera flash and bright outdoor light flatten features. Go slightly bolder than your everyday look — a touch more contour, slightly more defined brows. Matte finishes photograph better than glossy. Bring a small touch-up kit for shine control. If you're doing a blowout, book it the morning of your shoot.",
    order: 6,
  },
];

export default function WhatToWearPage() {
  const [outfits, setOutfits] = useState<OutfitTip[]>(DRAFT_OUTFITS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchOutfits() {
      try {
        // TODO: Replace with Supabase call:
        // const { data } = await supabase.from('grad_outfits').select('*').order('order')
        // if (data && data.length > 0) setOutfits(data)
        setLoading(false);
      } catch (err) {
        console.error(err);
      }
    }
    fetchOutfits();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FF]">

      {/* ── NAVBAR ──────────────────────────────────────────────── */}
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

      {/* ── HERO ────────────────────────────────────────────────── */}
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
            What looks great in a mirror and what looks great on camera are often 
            different things. Here's exactly what works — and what to avoid — for 
            Bay Area grad shoots.
          </p>
        </div>
      </section>

      {/* ── OUTFIT TIPS ─────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto space-y-5">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-slate-200 animate-pulse h-48" />
            ))
          ) : (
            outfits.map((outfit, index) => (
              <div
                key={outfit.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              >
                <div className={`grid ${outfit.image_url ? "sm:grid-cols-2" : "grid-cols-1"}`}>

                  {outfit.image_url && (
                    <div className="aspect-square sm:aspect-auto bg-slate-100 overflow-hidden">
                      <img
                        src={outfit.image_url}
                        alt={outfit.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {!outfit.image_url && (
                    <div className="hidden sm:flex aspect-square sm:aspect-auto bg-gradient-to-br from-violet-50 to-purple-50 items-center justify-center">
                      <div className="text-center">
                        <p className="text-4xl mb-2">👗</p>
                        <p className="text-xs text-slate-400 font-medium">Photo via Supabase</p>
                      </div>
                    </div>
                  )}

                  <div className="p-7 flex flex-col justify-center">
                    <span className="text-xs font-bold tracking-widest text-violet-600 bg-violet-50 px-2.5 py-1 rounded-full w-fit mb-3">
                      TIP {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2 className="text-xl font-bold text-slate-900 mb-3 leading-tight">
                      {outfit.title}
                    </h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      {outfit.tip}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
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

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>

    </div>
  );
}
