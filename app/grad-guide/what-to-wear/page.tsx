"use client";

import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";

export const dynamic = 'force-dynamic'

type OutfitTip = {
  id: number;
  title: string;
  tip: string;
  icon: string;
  order: number;
};

const DRAFT_OUTFITS: OutfitTip[] = [
  { id:1,  title:"Keep it simple — you're the focus",           tip:"Your outfit should complement you, not compete with you. The camera should land on your face first, not your clothes. Solid colors, clean lines, and minimal patterns are always the right call. The more simple your outfit, the more timeless your photos will look.", icon:"✨", order:1 },
  { id:2,  title:"Go lighter to contrast your stole and gown",  tip:"Graduation gowns and stoles tend to be dark and color-heavy. Wearing something lighter underneath — ivory, cream, soft white, blush, or light neutrals — creates a natural contrast that makes the whole look more balanced in photos.", icon:"🎨", order:2 },
  { id:3,  title:"Avoid busy prints entirely",                   tip:"Stripes, plaid, polka dots, florals, and anything with text or logos will fight for attention in your photos. The camera always finds the busiest thing in the frame — make sure that's you.", icon:"🚫", order:3 },
  { id:4,  title:"Steam and hang everything the night before",   tip:"Your gown will have fold lines from the package — take it out at least the night before, not the morning of. Hang it in the bathroom while you shower to let the steam work out the creases.", icon:"👔", order:4 },
  { id:5,  title:"Try your full look together before the day",   tip:"Put on your outfit, stole, gown, and shoes together at least once before your session. Make sure everything works as a complete look and nothing clashes.", icon:"🪞", order:5 },
  { id:6,  title:"Bring comfortable shoes for walking",          tip:"We'll cover a lot of ground during the session, so if you're wearing heels, bring a pair of flip-flops or flats as backup. Heels that sink into grass or make you wince are going to affect your posture and your energy.", icon:"👠", order:6 },
  { id:7,  title:"Exaggerate your makeup slightly for camera",   tip:"Outdoor light and camera sensors flatten features more than you'd expect. Your everyday makeup will look too subtle in photos. Add more definition to your brows, a bit more contour, and go with matte over glossy finishes.", icon:"💄", order:7 },
  { id:8,  title:"Go with a hairstyle you already know",         tip:"This isn't the day to experiment with something new. Pick a style you've worn before and feel confident in. If you're booking a blowout, schedule it for the morning of your session so it's fresh.", icon:"💇", order:8 },
  { id:9,  title:"Match your undergarments to your outfit",      tip:"If you're wearing light-colored clothing, make sure what's underneath matches in tone — otherwise it will be visible in photos.", icon:"👙", order:9 },
  { id:10, title:"Get your haircut a few days before — not day of", tip:"A lot of guys don't love how they look immediately after a fresh cut. Get it done 2-3 days before your session so it has time to settle into its natural shape.", icon:"✂️", order:10 },
  { id:11, title:"Groom your facial hair before the shoot",      tip:"If your beard or mustache is part of your look, keep it — just make sure it's clean and shaped. Trim it up a few days before.", icon:"🪒", order:11 },
  { id:12, title:"Jewelry works — smartwatches don't",           tip:"Earrings, necklaces, rings, and bracelets all add to your look and photograph well. Leave the Apple Watch or Fitbit at home — it reads as out of place.", icon:"💍", order:12 },
  { id:13, title:"Plan ahead if you wear glasses",               tip:"Lenses catch outdoor light and create glare in photos. If possible, remove the lenses from the frames before your session — that's the cleanest fix.", icon:"👓", order:13 },
];

const categories = [
  { label:"General",      ids:[1,2,3,4,5],  accent:"#db2777", accentBg:"rgba(249,168,212,0.12)" },
  { label:"For Her",      ids:[6,7,8,9],    accent:"#7c3aed", accentBg:"rgba(124,58,237,0.08)"  },
  { label:"For Him",      ids:[10,11],      accent:"#d97706", accentBg:"rgba(252,211,77,0.15)"  },
  { label:"Accessories",  ids:[12,13],      accent:"#db2777", accentBg:"rgba(249,168,212,0.12)" },
];

const STYLES = `
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
  @keyframes blobFloat{0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(12px,-8px)scale(1.02);}66%{transform:translate(-8px,10px)scale(0.98);}}
  @keyframes pulseRing{0%,100%{opacity:0.5;transform:scale(1);}50%{opacity:0.15;transform:scale(1.25);}}
  .afu1{animation:fadeUp 0.5s 0.05s ease both;}
  .afu2{animation:fadeUp 0.5s 0.12s ease both;}
  .afu3{animation:fadeUp 0.5s 0.19s ease both;}
  .blob1{animation:blobFloat 10s ease-in-out infinite;}
  .pdot{animation:pulseRing 2.5s ease-in-out infinite;}
  .tip-card{transition:transform 0.2s ease,box-shadow 0.2s ease;}
  .tip-card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(219,39,119,0.08);}
  .btn-lift{transition:transform 0.18s ease,box-shadow 0.18s ease;}
  .btn-lift:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.12);}
`;

export default function WhatToWearPage() {
  const [outfits, setOutfits] = useState<OutfitTip[]>(DRAFT_OUTFITS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchOutfits() {
      try {
        const { data, error } = await supabase.from('grad_outfits').select('*').order('order', { ascending: true })
        if (error) console.error(error)
        if (data && data.length > 0) setOutfits(data)
      } catch (err) { console.error(err) }
    }
    fetchOutfits()
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{STYLES}</style>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-black/[0.06]" style={{ background:"rgba(255,255,255,0.9)" }}>
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight" style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Chris.</Link>
          <Link href="/grad-guide" className="text-sm font-bold text-slate-700 hover:text-slate-400 transition-colors">← Grad Guide</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-14 pb-10 border-b border-black/[0.06]">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:`linear-gradient(rgba(219,39,119,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(219,39,119,0.03) 1px,transparent 1px)`, backgroundSize:"40px 40px" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background:"radial-gradient(ellipse at 60% 50%, transparent 30%, white 75%)" }} />
        <div className="absolute top-5 left-5 w-4 h-4 pointer-events-none" style={{ borderTop:"1.5px solid rgba(219,39,119,0.3)",borderLeft:"1.5px solid rgba(219,39,119,0.3)" }} />
        <div className="absolute bottom-5 right-5 w-4 h-4 pointer-events-none" style={{ borderBottom:"1.5px solid rgba(219,39,119,0.3)",borderRight:"1.5px solid rgba(219,39,119,0.3)" }} />
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{ background:"linear-gradient(135deg,#db2777,#f59e0b)" }} />
        <div className="blob1 absolute rounded-full pointer-events-none" style={{ width:440,height:440,top:-100,right:-100,background:"radial-gradient(circle,rgba(219,39,119,0.1),transparent 70%)" }} />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{ background:"rgba(219,39,119,0.08)",border:"1px solid rgba(219,39,119,0.18)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-pink-600" />
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-pink-700">02 — What to Wear</p>
          </div>
          <h1 className="afu2 text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-4 leading-tight">
            Outfits that{" "}
            <span style={{ background:"linear-gradient(135deg,#db2777,#f59e0b)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>photograph.</span>
          </h1>
          <p className="afu3 text-base text-slate-600 font-light leading-relaxed max-w-xl">
            What looks great in a mirror and what looks great on camera are often different things. Here's exactly what works — broken down by category.
          </p>
        </div>
      </section>

      {/* TIPS */}
      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto space-y-12">
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="rounded-2xl animate-pulse h-40" style={{ background:"linear-gradient(135deg,#fce7f3,#fef3c7)" }} />)
          ) : (
            categories.map((cat) => {
              const catTips = outfits.filter((o) => cat.ids.includes(o.id));
              if (catTips.length === 0) return null;
              return (
                <div key={cat.label}>
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-xs font-black tracking-[0.15em] uppercase px-3 py-1 rounded-full" style={{ color:cat.accent, background:cat.accentBg }}>
                      {cat.label}
                    </span>
                    <div className="flex-1 h-px" style={{ background:`linear-gradient(90deg,${cat.accentBg},transparent)` }} />
                  </div>
                  <div className="space-y-3">
                    {catTips.map((tip) => (
                      <div key={tip.id} className="tip-card rounded-2xl p-5 overflow-hidden relative" style={{ background:"#fff", border:"1px solid rgba(219,39,119,0.12)" }}>
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ background:`linear-gradient(180deg,${cat.accent},transparent)` }} />
                        <div className="flex items-start gap-4 pl-2">
                          <span className="text-2xl flex-shrink-0">{tip.icon}</span>
                          <div>
                            <h3 className="text-base font-black text-slate-900 mb-1.5 leading-tight">{tip.title}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">{tip.tip}</p>
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

      {/* CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-8 text-white text-center relative overflow-hidden" style={{ background:"linear-gradient(135deg,#db2777,#f59e0b)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`, backgroundSize:"24px 24px" }} />
          <h3 className="relative text-2xl font-black mb-2">Outfit locked in?</h3>
          <p className="relative text-white/75 mb-6 text-sm">Now let's make sure you show up ready on shoot day.</p>
          <div className="relative flex flex-wrap justify-center gap-3">
            <Link href="/grad-guide/how-to-prepare" className="btn-lift px-5 py-2.5 rounded-full bg-white font-bold text-sm" style={{ color:"#db2777" }}>
              Next: How to Prepare →
            </Link>
            <Link href="/grad-guide/posing" className="btn-lift px-5 py-2.5 rounded-full font-bold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors">
              ← Back to Posing
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/[0.06] bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}