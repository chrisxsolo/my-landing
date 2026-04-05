"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// ── TYPES ─────────────────────────────────────────────────────────────
type GradPhoto = {
  id: number;
  image_url: string;
  caption: string | null;
};

// ── NAV CARDS ─────────────────────────────────────────────────────────
const sections = [
  {
    href: "/grad-guide/posing",
    number: "01",
    title: "Posing Guide",
    desc: "Natural, flattering poses that actually look good on camera — no stiff yearbook vibes.",
    emoji: "📸",
    color: "from-blue-600 to-indigo-600",
    shadow: "shadow-blue-500/20",
  },
  {
    href: "/grad-guide/what-to-wear",
    number: "02",
    title: "What to Wear",
    desc: "Colors, fabrics, and outfit combos that photograph beautifully in any Bay Area location.",
    emoji: "👗",
    color: "from-violet-600 to-purple-600",
    shadow: "shadow-violet-500/20",
  },
  {
    href: "/grad-guide/how-to-prepare",
    number: "03",
    title: "How to Prepare",
    desc: "Everything to do before your shoot so you show up relaxed, confident, and ready.",
    emoji: "✅",
    color: "from-indigo-600 to-blue-700",
    shadow: "shadow-indigo-500/20",
  },
];

export default function GradGuidePage() {
  const [photos, setPhotos] = useState<GradPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  // ── FETCH PHOTOS FROM SUPABASE ───────────────────────────────────
  // Once you set up Supabase, replace this with:
  // import { createClient } from '@supabase/supabase-js'
  // const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  // const { data } = await supabase.from('grad_photos').select('*').order('created_at', { ascending: false })
  useEffect(() => {
    async function fetchPhotos() {
      try {
        // TODO: Replace with real Supabase call once connected
        // For now renders empty grid with placeholder message
        setPhotos([]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchPhotos();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FF]">

      {/* ── NAVBAR ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Chris.
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            ← Back to hub
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-16 pb-12">
        {/* gradient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute rounded-full blur-[100px] opacity-25 w-[500px] h-[500px] -top-20 -left-20 bg-gradient-to-br from-blue-400 to-indigo-500" />
          <div className="absolute rounded-full blur-[120px] opacity-20 w-[400px] h-[400px] -top-10 -right-20 bg-gradient-to-br from-violet-400 to-purple-500" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-blue-600 mb-4">
            Bay Area Grad Photography
          </p>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 mb-5">
            Your Complete{" "}
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Graduation
            </span>
            <br />Photo Guide
          </h1>
          <p className="text-lg text-slate-500 font-light leading-relaxed max-w-lg mx-auto mb-8">
            Everything you need to know before, during, and after your graduation shoot — from posing to outfits to showing up confident.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/grad-guide/posing"
              className="px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              Start with posing →
            </Link>
            <a
              href="mailto:you@email.com"
              className="px-6 py-3 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
            >
              Book a shoot
            </a>
          </div>
        </div>
      </section>

      {/* ── SECTION CARDS ───────────────────────────────────────── */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`group relative rounded-2xl p-6 bg-gradient-to-br ${s.color} text-white shadow-xl ${s.shadow} hover:-translate-y-1 hover:shadow-2xl transition-all duration-250 cursor-pointer`}
            >
              <span className="text-3xl mb-3 block">{s.emoji}</span>
              <p className="text-xs font-bold tracking-widest opacity-60 mb-1 uppercase">{s.number}</p>
              <h3 className="text-lg font-bold mb-2 leading-tight">{s.title}</h3>
              <p className="text-sm opacity-80 leading-relaxed">{s.desc}</p>
              <span className="absolute bottom-5 right-5 text-lg opacity-40 group-hover:opacity-100 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-200">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── PHOTO GRID ──────────────────────────────────────────── */}
      <section className="px-6 pb-20 border-t border-slate-200">
        <div className="max-w-3xl mx-auto pt-14">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-blue-600 mb-3">
              Portfolio
            </p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Recent grad shoots
            </h2>
            <p className="text-slate-500 mt-2 text-sm">
              Real sessions, real results.
            </p>
          </div>

          {loading ? (
            /* Loading skeleton */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl bg-slate-200 animate-pulse"
                />
              ))}
            </div>
          ) : photos.length > 0 ? (
            /* Photo grid from Supabase */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100"
                >
                  <img
                    src={photo.image_url}
                    alt={photo.caption || "Graduation photo"}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {photo.caption && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end">
                      <p className="text-white text-sm font-medium p-4 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                        {photo.caption}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* Empty state — shows when Supabase not connected yet */
            <div className="border-2 border-dashed border-slate-300 rounded-2xl p-16 text-center">
              <p className="text-4xl mb-4">📷</p>
              <p className="text-slate-500 font-medium">Photos load here from Supabase</p>
              <p className="text-slate-400 text-sm mt-1">
                Add rows to the <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">grad_photos</code> table to populate this grid
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Chris.
          </span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>

    </div>
  );
}
